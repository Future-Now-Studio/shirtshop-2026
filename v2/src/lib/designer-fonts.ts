// Fonts offered in the designer. Only Outfit is bundled (@fontsource, see
// main.tsx); the others are common system fonts with a generic fallback and
// are only offered when this device really has them. The print file is
// rendered from the same canvas, so preview and print always match.

export interface FontOption { label: string; family: string }

export const DEFAULT_FONT = "Outfit";
const BUNDLED = new Set([DEFAULT_FONT]);

const FONT_OPTIONS: FontOption[] = [
  { label: "Outfit", family: DEFAULT_FONT },
  { label: "Arial", family: "Arial, Helvetica, sans-serif" },
  { label: "Verdana", family: "Verdana, sans-serif" },
  { label: "Georgia", family: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", family: "'Times New Roman', Times, serif" },
  { label: "Courier New", family: "'Courier New', Courier, monospace" },
  { label: "Impact", family: "Impact, 'Arial Black', sans-serif" },
  { label: "Brush Script", family: "'Brush Script MT', cursive" },
];

const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);
const families = (stack: string) => stack.split(",").map((f) => f.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);

const known = new Map<string, boolean>();
/** True when the device can render `name` (canvas width probe against generic fonts). */
function hasFont(name: string): boolean {
  if (BUNDLED.has(name) || GENERIC.has(name.toLowerCase())) return true;
  const hit = known.get(name);
  if (hit !== undefined) return hit;
  let ok = false;
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    const sample = "mmmmmmmmmwwwwwlli1|WQ@#";
    ok = !!ctx && ["monospace", "serif", "sans-serif"].some((base) => {
      ctx.font = `64px ${base}`;
      const a = ctx.measureText(sample).width;
      ctx.font = `64px "${name}", ${base}`;
      return ctx.measureText(sample).width !== a;
    });
  } catch { /* treat as missing */ }
  known.set(name, ok);
  return ok;
}

let available: FontOption[] | null = null;
/** Font options whose first-choice font is bundled or installed on this device. */
export function availableFonts(): FontOption[] {
  if (!available) available = FONT_OPTIONS.filter((f) => hasFont(families(f.family)[0]));
  return available;
}

/** Name of the font this device actually renders for a font stack (for the print manifest). */
export function renderedFont(stack?: string): string | undefined {
  if (!stack) return undefined;
  return families(stack).find((f) => hasFont(f)) ?? "Standardschrift des Browsers";
}

/** Makes sure the bundled font (regular + bold) is loaded before the canvas draws text. */
export async function loadBundledFonts(): Promise<void> {
  try {
    await Promise.all(["400", "700"].map((w) => document.fonts?.load(`${w} 32px ${DEFAULT_FONT}`)));
  } catch { /* fallback font is used */ }
}
