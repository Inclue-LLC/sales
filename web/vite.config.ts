import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const AUTH_EMULATOR = "http://127.0.0.1:9199";

export default defineConfig(({ mode }) => {
  // 本番ビルドで Firebase の設定が無いと、真っ白な画面が公開されてしまうので止める
  if (mode === "production") {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    const missing = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"].filter((k) => !env[k]);
    if (missing.length) {
      throw new Error(`web/.env.production.local に Firebase の設定がありません（${missing.join(", ")}）。web/.env.example を参考に作成してください。`);
    }
  }
  return config;
});

const config = {
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
};
