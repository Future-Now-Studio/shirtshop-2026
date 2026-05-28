// Sentry stub – install @sentry/react and uncomment to enable.
// Set VITE_SENTRY_DSN in Netlify env vars.
//
// import * as Sentry from "@sentry/react";
//
// export function initMonitoring() {
//   const dsn = import.meta.env.VITE_SENTRY_DSN;
//   if (!dsn || !import.meta.env.PROD) return;
//   Sentry.init({
//     dsn,
//     tracesSampleRate: 0.1,
//     replaysSessionSampleRate: 0,
//     replaysOnErrorSampleRate: 1.0,
//   });
// }
//
// export function captureError(err: unknown, context?: Record<string, unknown>) {
//   Sentry.captureException(err, { extra: context });
// }

export function initMonitoring() {
  if (import.meta.env.PROD && !import.meta.env.VITE_SENTRY_DSN) {
    console.info("[monitoring] Sentry disabled – set VITE_SENTRY_DSN to enable.");
  }
}

export function captureError(err: unknown, context?: Record<string, unknown>) {
  console.error("[monitoring]", err, context);
}
