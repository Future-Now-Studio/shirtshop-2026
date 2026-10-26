import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  // Load .env (all vars, not just VITE_*) so we can use WC creds in the dev proxy
  // without exposing them in the client bundle. WC keys must never carry a VITE_ prefix.
  const env = loadEnv(mode, process.cwd(), "");
  const WC_BASE = env.WC_BASE_URL || "https://timob10.sg-host.com";
  const WC_KEY = env.WC_CONSUMER_KEY || "";
  const WC_SECRET = env.WC_CONSUMER_SECRET || "";

  // Allowlist of variables that reach the browser. zustand reads the bare
  // `import.meta.env`, which makes Vite inline the whole env object into the
  // bundle — with the default "VITE_" prefix every VITE_* variable of the build
  // environment would be public. The placement-zones password (local dev tool,
  // see App.tsx) is only exposed to the dev server, never to a build.
  const publicEnv = ["VITE_STRIPE_PUBLISHABLE_KEY", "VITE_SENTRY_DSN"];
  const envPrefix = command === "serve" ? [...publicEnv, "VITE_ADMIN_PZ_PASSWORD"] : publicEnv;

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
    envPrefix,
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
