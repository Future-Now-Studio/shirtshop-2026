import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const wcBase = env.WC_BASE_URL || 'https://timob10.sg-host.com/wp-json/wc/v3'
  const wcAuth =
    env.WC_CONSUMER_KEY && env.WC_CONSUMER_SECRET
      ? 'Basic ' +
        Buffer.from(`${env.WC_CONSUMER_KEY}:${env.WC_CONSUMER_SECRET}`).toString('base64')
      : ''
  const wcOrigin = new URL(wcBase).origin
  const wcPath = new URL(wcBase).pathname // e.g. /wp-json/wc/v3

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        // Browser calls /api/wc/* → WooCommerce REST, credentials injected here.
        '/api/wc': {
          target: wcOrigin,
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/wc/, wcPath),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (wcAuth) proxyReq.setHeader('Authorization', wcAuth)
            })
          },
        },
      },
    },
  }
})
