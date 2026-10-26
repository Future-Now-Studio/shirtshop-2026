// Netlify Function V2 – proxies WooCommerce API requests server-side.
// Solves:  1) CORS (browser sees same-origin)
//          2) Security (WC credentials stay in Netlify env vars, not in frontend bundle)
//
// SECURITY: the WooCommerce keys can read EVERYTHING (orders, customers, …),
// so only the public catalogue routes used by the frontends are forwarded:
//   products, products/<id>, products/<id>/variations, products/<id>/variations/<id>,
//   products/categories, products/attributes, products/attributes/<id>/terms
// Everything else gets a 403. Product listings are forced to status=publish and
// single products / variations that are not published are answered with 404.
// (Same as netlify/functions/wc-proxy.mjs, except that here WC_BASE_URL is
// required: the portal's catalogue is switched off, and without a configured
// shop the keys must never be sent to the staging host.)
//
// Env: WC_BASE_URL (https REST base, e.g. https://shop.example.de/wp-json/wc/v3),
// WC_CONSUMER_KEY, WC_CONSUMER_SECRET.

const ALLOWED_ROUTES = [
  /^products$/,
  /^products\/\d+$/,
  /^products\/\d+\/variations$/,
  /^products\/\d+\/variations\/\d+$/,
  /^products\/categories$/,
  /^products\/attributes$/,
  /^products\/attributes\/\d+\/terms$/,
];

// Query parameters the apps actually send (plus harmless list/paging ones).
const ALLOWED_PARAMS = new Set([
  'per_page', 'page', 'category', 'search', 'tag', 'status', 'context', '_fields',
  'orderby', 'order', 'include', 'featured', 'hide_empty', 'parent', 'slug',
]);

const jsonResponse = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });

export default async (req) => {
  // Only allow GET (product reads)
  if (req.method !== 'GET') return jsonResponse(405, { error: 'Method not allowed' });

  const WC_KEY = process.env.WC_CONSUMER_KEY;
  const WC_SECRET = process.env.WC_CONSUMER_SECRET;
  if (!WC_KEY || !WC_SECRET) {
    return jsonResponse(500, { error: 'WooCommerce credentials not configured' });
  }
  // Credentials are sent along, so only an https base is accepted.
  if (!process.env.WC_BASE_URL) return jsonResponse(503, { error: 'Katalog nicht konfiguriert' });
  const WC_BASE = process.env.WC_BASE_URL.trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/]+\/\S*$/.test(`${WC_BASE}/`)) {
    return jsonResponse(500, { error: 'WC_BASE_URL must be an https URL' });
  }

  // e.g. /api/wc/products?per_page=100 → products
  const url = new URL(req.url);
  const wcPath = url.pathname.replace(/^\/api\/wc\/?/, '').replace(/\/+$/, '');
  if (!ALLOWED_ROUTES.some((re) => re.test(wcPath))) {
    return jsonResponse(403, { error: 'Route not allowed' });
  }

  const params = new URLSearchParams();
  for (const [k, v] of url.searchParams) {
    if (ALLOWED_PARAMS.has(k)) params.append(k, v);
  }
  // Never expose drafts/private products through the proxy.
  if (wcPath === 'products' || /^products\/\d+\/variations$/.test(wcPath)) {
    params.set('status', 'publish');
  } else {
    params.delete('status');
  }
  const qs = params.toString();
  const targetUrl = `${WC_BASE}/${wcPath}${qs ? `?${qs}` : ''}`;

  // Basic Auth from server-side env vars
  const credentials = btoa(`${WC_KEY}:${WC_SECRET}`);

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await response.text();

    // Single product / variation: hide anything that is not published.
    if (response.ok && /^products\/\d+(\/variations\/\d+)?$/.test(wcPath)) {
      try {
        const data = JSON.parse(body);
        if (data && typeof data === 'object' && data.status && data.status !== 'publish') {
          return jsonResponse(404, { error: 'Not found' });
        }
      } catch {
        return jsonResponse(502, { error: 'Invalid upstream response' });
      }
    }

    const headers = new Headers({
      'Content-Type': 'application/json',
      // Only successful public catalogue responses may be cached publicly.
      'Cache-Control': response.ok ? 'public, max-age=60, s-maxage=300' : 'no-store',
    });

    // Forward WooCommerce pagination headers
    const totalPages = response.headers.get('x-wp-totalpages');
    const totalItems = response.headers.get('x-wp-total');
    if (totalPages) headers.set('x-wp-totalpages', totalPages);
    if (totalItems) headers.set('x-wp-total', totalItems);

    return new Response(body, { status: response.status, headers });
  } catch (error) {
    console.error('WC proxy error:', error);
    return jsonResponse(502, { error: 'Failed to reach WooCommerce API' });
  }
};

// Netlify Functions V2: declare the URL path this function handles
export const config = {
  path: '/api/wc/*',
};
