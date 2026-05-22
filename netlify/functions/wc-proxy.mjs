// Netlify Function V2 – proxies WooCommerce API requests server-side.
// Solves:  1) CORS (browser sees same-origin)
//          2) Security (WC credentials stay in Netlify env vars, not in frontend bundle)

const WC_BASE = 'https://timob10.sg-host.com/wp-json/wc/v3';

export default async (req) => {
  // Only allow GET (product reads)
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const WC_KEY = process.env.WC_CONSUMER_KEY;
  const WC_SECRET = process.env.WC_CONSUMER_SECRET;

  if (!WC_KEY || !WC_SECRET) {
    return new Response(JSON.stringify({ error: 'WooCommerce credentials not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract the WC path from the request URL
  // e.g. /api/wc/products?per_page=100 → products
  const url = new URL(req.url);
  const wcPath = url.pathname.replace(/^\/api\/wc\/?/, '');
  const queryString = url.search || '';
  const targetUrl = `${WC_BASE}/${wcPath}${queryString}`;

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

    // Build response headers
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    });

    // Forward WooCommerce pagination headers
    const totalPages = response.headers.get('x-wp-totalpages');
    const totalItems = response.headers.get('x-wp-total');
    if (totalPages) headers.set('x-wp-totalpages', totalPages);
    if (totalItems) headers.set('x-wp-total', totalItems);

    return new Response(body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error('WC proxy error:', error);
    return new Response(JSON.stringify({ error: 'Failed to reach WooCommerce API' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Netlify Functions V2: declare the URL path this function handles
export const config = {
  path: '/api/wc/*',
};
