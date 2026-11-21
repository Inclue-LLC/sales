// ローカル動作確認用のサンプルデータを投入する（エミュレータ専用）。
//   npm run seed
// ログイン: パスワード password123

import { initAdmin } from "./lib.mjs";

const { auth, db, prod } = initAdmin(process.argv.slice(2));
if (prod) {
  console.error("seed はエミュレータ専用です");
  process.exit(1);
}

// 共有ログインアカウント（画面ではパスワードだけを入力する）
const email = "login@sales.internal";
try {
  const u = await auth.getUserByEmail(email);
  await auth.updateUser(u.uid, { password: "password123" });
} catch {
  await auth.createUser({ email, password: "password123" });
}
await db.doc("settings/app").set({
  startMonth: "2026-11",
  endMonth: "2027-12",
  jpyPerCny: 21,
  characters: ["スタジオハヌル", "Lovely MongMong", "ふにゅ"],
});

// 既存のサンプルを消してから入れ直す
for (const col of ["entries", "onlineWeekly", "onlineWeeklyJP", "weeks"]) {
  const snap = await db.collection(col).get();
  const b = db.batch();
  snap.docs.forEach((d) => b.delete(d.ref));
  await b.commit();
}

const batch = db.batch();
const now = new Date();
// 金額は中国=元、日本=円
const entry = (kind, e) =>
  batch.set(db.collection("entries").doc(), { kind, currency: e.country === "JP" ? "JPY" : "CNY", createdAt: now, updatedAt: now, ...e });

entry("license", { country: "CN", licensee: "上海示例文化", character: "Lovely MongMong", type: "MG", amount: 60_000, month: "2026-11" });
entry("license", { country: "CN", licensee: "北京示例", character: "ふにゅ", type: "ロイヤリティ", amount: 15_000, month: "2026-12" });
entry("license", { country: "JP", licensee: "サンプル商事", character: "スタジオハヌル", type: "ロイヤリティ", amount: 480_000, month: "2026-11" });
entry("license", { country: "JP", licensee: "サンプルトイズ", character: "スタジオハヌル", type: "MG", amount: 1_000_000, month: "2027-01" });
entry("offline", { country: "JP", character: "ふにゅ", type: "POP UP", venue: "渋谷PARCO", amount: 850_000, month: "2026-11" });
entry("offline", { country: "CN", character: "Lovely MongMong", type: "委託販売", venue: "上海 サンプル書店", amount: 9_000, month: "2026-12" });
entry("other", { country: "JP", company: "サンプル出版", content: "イラスト制作費", amount: 150_000, month: "2026-11" });

const weeks = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07"];
weeks.forEach((w, i) =>
  batch.set(db.doc(`onlineWeekly/${w}`), { weekStart: w, currency: "CNY", xiaohongshu: 4_000 + i * 500, taobao: 3_000 + (i % 3) * 700 }),
);
// 日本オンラインは円
weeks.slice(0, 4).forEach((w, i) =>
  batch.set(db.doc(`onlineWeeklyJP/${w}`), { weekStart: w, currency: "JPY", hanul: 42_000 + i * 2_100, mongmong: 21_000, funyu: 10_500 * (i % 2) }),
);
await batch.commit();

console.log("サンプルデータを投入しました。ログインパスワード: password123");
