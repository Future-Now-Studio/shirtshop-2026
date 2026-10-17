// Writes public/sitemap.xml with the static pages plus every published product
// (runs before `vite build`). Without DB access it keeps the existing file, so
// a build never fails because of the sitemap.
import { writeFile } from 'node:fs/promises';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SITE = process.env.SITE_URL || 'https://private-shirt.de';
const STATIC = ['/', '/produkte', '/selbst-gestalten', '/leistungen', '/unternehmen', '/filialen',
  '/grossbestellung', '/kontakt', '/impressum', '/agb', '/datenschutz', '/widerruf'];

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log('[sitemap] no VITE_SUPABASE_URL/ANON_KEY — keeping existing public/sitemap.xml');
  process.exit(0);
}

try {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from('products').select('slug, updated_at').eq('status', 'published');
  if (error) throw error;
  const entry = (path, lastmod) =>
    `  <url><loc>${SITE}${path}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...STATIC.map((p) => entry(p)),
    ...(data ?? []).map((p) => entry(`/produkt/${p.slug}`, p.updated_at)),
    '</urlset>',
    '',
  ].join('\n');
  await writeFile(new URL('../public/sitemap.xml', import.meta.url), xml);
  console.log(`[sitemap] ${STATIC.length + (data?.length ?? 0)} URLs`);
} catch (e) {
  console.warn('[sitemap] skipped:', e.message);
}
