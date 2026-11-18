import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

// 開発時（npm run dev）はエミュレータに接続する。本番ビルドでは .env.production.local の値を使う。
const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== "false";

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
  const host = window.location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFunctionsEmulator(functions, host, 5001);
}
