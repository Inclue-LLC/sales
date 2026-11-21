// スクリプト共通: firebase-admin を functions の依存から読み込み、既定ではエミュレータに接続する。

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

export function initAdmin(argv) {
  const args = [...argv];
  const prod = args.includes("--prod");
  let projectId;
  const pi = args.indexOf("--project");
  if (pi >= 0) {
    projectId = args[pi + 1];
    args.splice(pi, 2);
  }
  const rest = args.filter((a) => a !== "--prod");

  if (!prod) {
    process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8188";
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9199";
    projectId ??= JSON.parse(readFileSync(new URL("../.firebaserc", import.meta.url), "utf8")).projects.default;
  } else if (!projectId) {
    console.error("本番に接続するときは --project <projectId> を指定してください");
    process.exit(1);
  }
  console.log(prod ? `本番プロジェクト ${projectId} に接続します` : `エミュレータ (${projectId}) に接続します`);
  initializeApp({ projectId });
  return { auth: getAuth(), db: getFirestore(), args: rest, prod };
}
