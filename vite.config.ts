import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env (all vars, not just VITE_*) so we can use WC creds in the dev proxy
  // without exposing them in the client bundle.
  const env = loadEnv(mode, process.cwd(), "");
  const WC_BASE = env.WC_BASE_URL || env.VITE_WC_BASE_URL || "https://timob10.sg-host.com";
  const WC_KEY = env.WC_CONSUMER_KEY || env.VITE_WC_CONSUMER_KEY || "";
  const WC_SECRET = env.WC_CONSUMER_SECRET || env.VITE_WC_CONSUMER_SECRET || "";

  // Strip a trailing /wp-json/wc/v3 if the user pasted the full REST URL into env
  const wcTarget = WC_BASE.replace(/\/wp-json\/wc\/v3\/?$/, "");

  if (mode === "development") {
    console.log(
      `[vite] WC proxy → ${wcTarget}  auth=${WC_KEY && WC_SECRET ? "yes" : "MISSING"}`,
    );
  }
  const wcAuth =
    WC_KEY && WC_SECRET
      ? "Basic " + Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64")
      : "";

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        // /api/wc/* → WooCommerce REST, auth injected here so creds stay off the client
        "/api/wc": {
          target: wcTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/wc/, "/wp-json/wc/v3"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (wcAuth) proxyReq.setHeader("Authorization", wcAuth);
            });
          },
        },
        // NOTE: /api/* (non-WC) is handled by netlify dev directly on port 8888.
        // Do NOT add a proxy here — it would create a loop.
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            stripe: ["@stripe/react-stripe-js", "@stripe/stripe-js"],
            fabric: ["fabric"],
            framer: ["framer-motion"],
            charts: ["recharts"],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  };
});
