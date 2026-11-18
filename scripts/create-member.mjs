// メンバー（ログインユーザー）を作成する。最初の 1 人目はこのスクリプトで作り、
// 2 人目以降は画面の「設定 > メンバー」から追加できる。
//
// ローカル（エミュレータ）:
//   npm run create-member -- you@example.com password123 "表示名"
// 本番（gcloud auth application-default login 済みであること）:
//   npm run create-member -- --prod --project <projectId> you@example.com password123 "表示名"

import { initAdmin } from "./lib.mjs";

const { auth, db, args } = initAdmin(process.argv.slice(2));
const [email, password, displayName = ""] = args;
if (!email || !password) {
  console.error("使い方: npm run create-member -- <email> <password> [表示名]");
  process.exit(1);
}

let user;
try {
  user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password });
  console.log(`既存ユーザーのパスワードを更新しました: ${email}`);
} catch {
  user = await auth.createUser({ email, password, displayName: displayName || undefined });
  console.log(`ユーザーを作成しました: ${email}`);
}
await db.doc(`members/${user.uid}`).set({ email, displayName });
console.log(`メンバーに登録しました (uid: ${user.uid})`);
