import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { readFileSync } from "node:fs";

// In Docker the page is opened through a proxy: Caddy at https://calculator.local, or Tailscale at
// https://<machine>.ts.net from a phone. Hot reload then connects back to whatever address and port the page came
// from (VITE_HMR_HOST is set in docker-compose.dev.yml).
const hmrHost = process.env.VITE_HMR_HOST;
const version = (JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string }).version;

export default defineConfig({
  plugins: [vue()],
  define: { "import.meta.env.VITE_VERSION": JSON.stringify(version) },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ["calculator.local", "localhost", ".ts.net"],
    // Polling notices edits that replace the file (editors, sed -i), which file events in a container can miss.
    watch: process.env.WATCH_POLL ? { usePolling: true, interval: 300 } : undefined,
    hmr: hmrHost ? { protocol: "wss" } : undefined,
  },
});
