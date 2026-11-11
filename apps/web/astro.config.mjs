import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import csp from "./integrations/csp.mjs";
import serviceWorker from "./integrations/service-worker.mjs";

const typstPackages = [
  "@myriaddreamin/typst.ts",
  "@myriaddreamin/typst-ts-web-compiler",
  "@myriaddreamin/typst-ts-renderer",
];

// The build that the desktop app (apps/desktop) wraps: no service worker, since the app already has every file and
// updates with its installer, and a CSP that lets the page talk to the app.
const desktop = process.env.FOJA_DESKTOP === "1";

export default defineConfig({
  // GitHub Pages serves the site under /foja/; the dev server, the desktop app and a custom domain use /.
  base: process.env.FOJA_BASE ?? "/",
  // For the absolute links between the Spanish and English landing pages.
  site: "https://bafif.github.io",
  // csp first: the service worker caches the pages as they end up.
  integrations: [react(), csp({ desktop }), ...(desktop ? [] : [serviceWorker()])],
  devToolbar: { enabled: false },
  vite: {
    // A production build next to a running dev server uses its own cache, or it would leave the
    // dev server's optimized dependencies outdated (scripts/e2e-pwa.sh sets it).
    cacheDir: process.env.FOJA_VITE_CACHE,
    plugins: [tailwindcss()],
    // typst.ts loads its WASM by URL; pre-bundling would break those URLs.
    optimizeDeps: { exclude: typstPackages },
    worker: { format: "es" },
  },
});
