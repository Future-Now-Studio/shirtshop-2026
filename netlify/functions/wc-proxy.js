// Netlify serverless function to proxy WooCommerce API requests.
// Solves two problems:
//   1. CORS – browser sees same-origin requests (no preflight)
//   2. Security – WC consumer key / secret stay server-side

const WC_BASE = 'https://timob10.sg-host.com/wp-json/wc/v3';
const WC_KEY = process.env.WC_CONSUMER_KEY;
const WC_SECRET = process.env.WC_CONSUMER_SECRET;

export async function handler(event) {
  // Only allow GET requests (product reads)
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Build the target WooCommerce URL
  // event.path looks like: /.netlify/functions/wc-proxy/products
  // We need the part after "wc-proxy/"
  const proxyPath = event.path.replace(/^\/?\.netlify\/functions\/wc-proxy\/?/, '');
  const queryString = event.rawQuery || '';
  const separator = queryString ? '?' : '';
  const targetUrl = `${WC_BASE}/${proxyPath}${separator}${queryString}`;

  // Create Basic Auth header from server-side env vars
  const credentials = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await response.text();

    // Forward WooCommerce response headers we care about
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, s-maxage=300', // cache products for 5 min on CDN
    };

    // Forward pagination headers if present
    const totalPages = response.headers.get('x-wp-totalpages');
    const totalItems = response.headers.get('x-wp-total');
    if (totalPages) headers['x-wp-totalpages'] = totalPages;
    if (totalItems) headers['x-wp-total'] = totalItems;

    return {
      statusCode: response.status,
      headers,
      body,
    };
  } catch (error) {
    console.error('WC proxy error:', error);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Failed to reach WooCommerce API' }),
    };
  }
}
