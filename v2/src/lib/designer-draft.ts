// Local design drafts: the designer autosaves the current design per product
// in IndexedDB, so a reload, the back button or a crashed tab doesn't lose the
// work. Uploaded images are stored as Blobs in their own store (they can be
// large). Everything here is best effort: private mode, a full disk or a
// missing IndexedDB just disable the feature.

const DB_NAME = "privateshirt-designer";
const DRAFTS = "drafts";
const ASSETS = "assets";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface DraftAsset { id: string; blob: Blob; name: string; type: string }

export interface Draft {
  slug: string;
  savedAt: number;
  variantId: string | null;
  /** Fabric JSON per view; image src is "asset:<id>". */
  views: Record<string, any>;
  assetIds: string[];
  /** Some images did not fit into the browser storage and are missing. */
  imagesDropped?: boolean;
}

export type DraftSaveStatus = "saved" | "noImages" | "off";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS);
          if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("IndexedDB blockiert"));
      } catch (e) {
        reject(e);
      }
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

/** Runs `fn` in one transaction; resolves when it is committed. */
async function run<T>(mode: IDBTransactionMode, fn: (drafts: IDBObjectStore, assets: IDBObjectStore) => T | Promise<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction([DRAFTS, ASSETS], mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("abgebrochen"));
    const fail = (e: unknown) => {
      try { tx.abort(); } catch { /* already finished */ }
      reject(e);
    };
    try {
      Promise.resolve(fn(tx.objectStore(DRAFTS), tx.objectStore(ASSETS))).then((r) => { result = r; }, fail);
    } catch (e) {
      fail(e); // e.g. DataCloneError from put(): nothing of this transaction may commit
    }
  });
}

const req = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

/** Number of design elements in a draft. */
export const draftElementCount = (d: Pick<Draft, "views">) =>
  Object.values(d.views ?? {}).reduce((n: number, v: any) => n + ((v?.objects ?? []) as any[]).filter((o) => !o.__zone).length, 0);

/** Draft for a product incl. its images (null when none, expired or storage unavailable). */
export async function loadDraft(slug: string): Promise<{ draft: Draft; assets: Map<string, DraftAsset> } | null> {
  try {
    const draft = await run("readonly", (d) => req<Draft | undefined>(d.get(slug)));
    if (!draft) return null;
    if (Date.now() - draft.savedAt > MAX_AGE_MS) {
      await deleteDraft(slug);
      return null;
    }
    const assets = new Map<string, DraftAsset>();
    await run("readonly", async (_d, a) => {
      const found = await Promise.all((draft.assetIds ?? []).map((id) => req<DraftAsset | undefined>(a.get(id))));
      for (const asset of found) if (asset) assets.set(asset.id, asset);
    });
    return { draft, assets };
  } catch {
    return null;
  }
}

/**
 * Saves a draft. `newAssets` are images not stored yet, `orphans` stored images
 * the design no longer uses. When the images don't fit (quota), the draft is
 * saved without them. Returns the status and the asset ids now stored for it.
 */
export async function saveDraft(draft: Draft, newAssets: DraftAsset[], orphans: string[]): Promise<{ status: DraftSaveStatus; assetIds: string[] }> {
  try {
    await run("readwrite", (d, a) => {
      for (const id of orphans) a.delete(id);
      for (const asset of newAssets) a.put(asset, asset.id);
      d.put(draft, draft.slug);
    });
    return { status: draft.imagesDropped ? "noImages" : "saved", assetIds: draft.assetIds };
  } catch {
    if (!newAssets.length) return { status: "off", assetIds: [] };
  }
  // Retry without the new images (usually QuotaExceededError).
  const skip = new Set(newAssets.map((a) => a.id));
  const views: Record<string, any> = {};
  for (const [v, json] of Object.entries(draft.views)) {
    views[v] = { ...json, objects: ((json?.objects ?? []) as any[]).filter((o) => !(typeof o.src === "string" && skip.has(o.src.replace(/^asset:/, "")))) };
  }
  const reduced: Draft = { ...draft, views, assetIds: draft.assetIds.filter((id) => !skip.has(id)), imagesDropped: true };
  try {
    await run("readwrite", (d, a) => {
      for (const id of orphans) a.delete(id);
      d.put(reduced, reduced.slug);
    });
    return { status: "noImages", assetIds: reduced.assetIds };
  } catch {
    return { status: "off", assetIds: [] };
  }
}

/** Removes a draft and its images. */
export async function deleteDraft(slug: string): Promise<void> {
  try {
    await run("readwrite", async (d, a) => {
      const draft = await req<Draft | undefined>(d.get(slug));
      for (const id of draft?.assetIds ?? []) a.delete(id);
      d.delete(slug);
    });
  } catch { /* nothing to clean up */ }
}
