import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const AUTH_EMULATOR = "http://127.0.0.1:9199";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    // functions/src/domain/types.ts を共有するため親ディレクトリの読み込みを許可
    fs: { allow: [".."] },
    // エミュレータへの通信を中継（画面と同じポートだけで動かすため）
    proxy: {
      "/identitytoolkit.googleapis.com": AUTH_EMULATOR,
      "/securetoken.googleapis.com": AUTH_EMULATOR,
      "/emulator": AUTH_EMULATOR,
      "/__fn": { target: "http://127.0.0.1:5101", rewrite: (p) => p.replace(/^\/__fn/, "") },
    },
  },
  build: { chunkSizeWarningLimit: 2000 },
});
