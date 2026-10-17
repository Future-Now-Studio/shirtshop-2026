// Per-page <head> tags for the SPA (title, description, canonical, OG, JSON-LD).
const SITE = "https://private-shirt.de";

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

export function setPageMeta({ title, description, path, jsonLd }: {
  title: string;
  description?: string;
  path: string;
  jsonLd?: object | null;
}) {
  document.title = title;
  meta("property", "og:title", title);
  meta("property", "og:url", SITE + path);
  if (description) {
    meta("name", "description", description);
    meta("property", "og:description", description);
  }
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
