import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // functions/src/domain/types.ts を共有するため親ディレクトリの読み込みを許可
  server: { port: 5173, fs: { allow: [".."] } },
  build: { chunkSizeWarningLimit: 2000 },
});
