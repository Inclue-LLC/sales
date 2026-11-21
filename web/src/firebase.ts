import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

// 開発時（npm run dev）はエミュレータに接続する。本番ビルドでは .env.production.local の値を使う。
export const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== "false";

const config = useEmulators
  ? { apiKey: "demo-key", authDomain: "localhost", projectId: "demo-sales-pl", appId: "demo" }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

export const app = initializeApp(config);
export const auth = getAuth(app);
export const functions = getFunctions(app, "asia-northeast1");

if (useEmulators) {
  // エミュレータへの通信は Vite の開発サーバー経由（vite.config.ts の proxy）で中継する。
  // 画面と同じ URL だけで動くので、別の端末やプレビュー画面からも開ける。
  connectAuthEmulator(auth, window.location.origin, { disableWarnings: true });
}
