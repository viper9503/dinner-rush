import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In production the app is served behind an nginx that proxies `/api/` to the
// dashboard-api, so all runtime calls use relative `/api/...` paths. For local
// `vite` dev we proxy `/api` to the dashboard-api running on :8005.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8005",
        changeOrigin: true,
        // SSE needs the connection kept open and not buffered.
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Accept-Encoding", "identity");
          });
        },
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
