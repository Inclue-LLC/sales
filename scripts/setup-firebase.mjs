// Firebase コンソールに表示される firebaseConfig を貼り付けると、
// web/.env.production.local（本番用の設定ファイル）を作る。
//   npm run setup-firebase

import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

console.log(`
Firebase コンソールの「プロジェクトの設定」→「マイアプリ」に表示されている
const firebaseConfig = { ... }; の部分をコピーして、ここに貼り付けてください。
貼り付けたら Enter を押してください。
`);

const rl = createInterface({ input: process.stdin });
const lines = [];
const keys = ["apiKey", "authDomain", "projectId", "appId"];
const pick = (text, key) => text.match(new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`))?.[1];

rl.on("line", (line) => {
  lines.push(line);
  const text = lines.join("\n");
  // 必要な値がそろったら（または閉じかっこが来たら）終了
  if (keys.every((k) => pick(text, k)) || /}\s*;?\s*$/.test(line)) rl.close();
});

rl.on("close", () => {
  const text = lines.join("\n");
  const v = Object.fromEntries(keys.map((k) => [k, pick(text, k)]));
  const missing = keys.filter((k) => !v[k]);
  if (missing.length) {
    console.error(`\n見つからない項目があります: ${missing.join(", ")}\nfirebaseConfig の { から } までをすべてコピーして、もう一度実行してください。`);
    process.exit(1);
  }
  const path = new URL("../web/.env.production.local", import.meta.url);
  writeFileSync(
    path,
    [
      "# Firebase の本番設定（npm run setup-firebase で作成）",
      `VITE_FIREBASE_API_KEY=${v.apiKey}`,
      `VITE_FIREBASE_AUTH_DOMAIN=${v.authDomain}`,
      `VITE_FIREBASE_PROJECT_ID=${v.projectId}`,
      `VITE_FIREBASE_APP_ID=${v.appId}`,
      "",
    ].join("\n"),
  );
  console.log(`\n設定ファイルを作成しました（プロジェクトID: ${v.projectId}）`);
  console.log("次は npm run deploy で公開できます。");
});
