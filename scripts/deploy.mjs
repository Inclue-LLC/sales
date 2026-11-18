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
console.log(`プロジェクト ${projectId} に公開します…`);
const r = spawnSync("npx", ["firebase", "deploy", "--project", projectId], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
