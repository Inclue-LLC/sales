// web/.env.production.local のプロジェクトIDを使って Firebase に公開する。
//   npm run deploy
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const path = new URL("../web/.env.production.local", import.meta.url);
if (!existsSync(path)) {
  console.error("設定ファイルがありません。先に npm run setup-firebase を実行してください。");
  process.exit(1);
}
const projectId = readFileSync(path, "utf8").match(/^VITE_FIREBASE_PROJECT_ID=(.+)$/m)?.[1]?.trim();
if (!projectId) {
  console.error("設定ファイルにプロジェクトIDがありません。npm run setup-firebase をやり直してください。");
  process.exit(1);
}
const win = process.platform === "win32";

// ログインの有効期限が切れていたら、先にログインし直す（ブラウザが開く）
const check = spawnSync("npx", ["firebase", "projects:list", "--json"], { encoding: "utf8", shell: win });
if (check.status !== 0) {
  console.log("Firebase へのログインが必要です。ブラウザが開いたら、Google アカウントを選んで「許可」を押してください。");
  const login = spawnSync("npx", ["firebase", "login", "--reauth"], { stdio: "inherit", shell: win });
  if (login.status !== 0) {
    console.error("ログインできませんでした。もう一度 npm run deploy を実行してください。");
    process.exit(1);
  }
}

console.log(`プロジェクト ${projectId} に公開します…`);
const r = spawnSync("npx", ["firebase", "deploy", "--project", projectId], { stdio: "inherit", shell: win });
process.exit(r.status ?? 1);
