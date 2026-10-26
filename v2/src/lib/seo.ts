// Per-page <head> tags for the SPA (title, description, canonical, OG, robots, JSON-LD).
const SITE = "https://private-shirt.de";
/** Default share image (1200×630, public/og-image.jpg). */
export const DEFAULT_OG_IMAGE = `${SITE}/og-image.jpg`;

function tag(selector: string, create: () => HTMLElement): HTMLElement {
  return (document.head.querySelector(selector) as HTMLElement | null) ?? document.head.appendChild(create());
}

function meta(attr: "name" | "property", key: string, content: string) {
  tag(`meta[${attr}="${key}"]`, () => {
    const m = document.createElement("meta");
    m.setAttribute(attr, key);
    return m;
  }).setAttribute("content", content);
}

/** Netlify preview/staging hosts must never be indexed (the canonical host is private-shirt.de). */
const isPreviewHost = () => /\.netlify\.app$/i.test(window.location.hostname);

export function setPageMeta({ title, description, path, image, noindex, jsonLd }: {
  title: string;
  description?: string;
  path: string;
  image?: string;       // absolute URL; defaults to DEFAULT_OG_IMAGE
  noindex?: boolean;    // 404, checkout, order and other private pages
  jsonLd?: object | null;
}) {
  document.title = title;
  meta("property", "og:title", title);
  meta("property", "og:url", SITE + path);
  meta("property", "og:image", image || DEFAULT_OG_IMAGE);
  if (description) {
    meta("name", "description", description);
    meta("property", "og:description", description);
  }

  const hide = noindex || isPreviewHost();
  if (hide) meta("name", "robots", "noindex");
  else document.head.querySelector('meta[name="robots"]')?.remove();

  // no canonical for pages that must not be indexed (e.g. /bestellung/<id>)
  if (noindex) document.head.querySelector('link[rel="canonical"]')?.remove();
  else
    tag('link[rel="canonical"]', () => {
      const l = document.createElement("link");
      l.rel = "canonical";
      return l;
    }).setAttribute("href", SITE + path);

  document.head.querySelector("script[data-page-jsonld]")?.remove();
  if (jsonLd) {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.dataset.pageJsonld = "";
    s.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(s);
  }
}
