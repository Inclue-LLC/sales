// ローカル動作確認用のサンプルデータを投入する（エミュレータ専用）。
//   npm run seed
// ログイン: demo@example.com / password123

import { initAdmin } from "./lib.mjs";

const { auth, db, prod } = initAdmin(process.argv.slice(2));
if (prod) {
  console.error("seed はエミュレータ専用です");
  process.exit(1);
}

const email = "demo@example.com";
let user;
try {
  user = await auth.getUserByEmail(email);
} catch {
  user = await auth.createUser({ email, password: "password123", displayName: "デモユーザー" });
}
await db.doc(`members/${user.uid}`).set({ email, displayName: "デモユーザー" });
await db.doc("settings/app").set({
  startMonth: "2026-11",
  endMonth: "2027-12",
  jpyPerCny: 21,
  characters: ["スタジオハヌル", "Lovely MongMong", "ふにゅ"],
});

// 既存のサンプルを消してから入れ直す
for (const col of ["entries", "targets", "onlineWeekly", "weeks"]) {
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

entry("license", { country: "CN", character: "Lovely MongMong", type: "MG", amount: 60_000, month: "2026-11" });
entry("license", { country: "CN", character: "ふにゅ", type: "ロイヤリティ", amount: 15_000, month: "2026-12" });
entry("license", { country: "JP", character: "スタジオハヌル", type: "ロイヤリティ", amount: 480_000, month: "2026-11" });
entry("license", { country: "JP", character: "スタジオハヌル", type: "MG", amount: 1_000_000, month: "2027-01" });
entry("offline", { country: "JP", character: "ふにゅ", type: "POP UP", venue: "渋谷PARCO", amount: 850_000, month: "2026-11" });
entry("offline", { country: "CN", character: "Lovely MongMong", type: "委託販売", venue: "上海 サンプル書店", amount: 9_000, month: "2026-12" });
entry("other", { country: "JP", content: "イラスト制作費", amount: 150_000, month: "2026-11" });

const target = (lineId, month, amount) => batch.set(db.doc(`targets/${lineId}_${month}`), { lineId, month, amount });
// 目標は元
for (const m of ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]) {
  target("CN_LICENSE", m, 50_000);
  target("CN_ONLINE", m, 30_000);
  target("CN_OFFLINE", m, 10_000);
  target("JP_LICENSE", m, 40_000);
  target("JP_OFFLINE", m, 30_000);
  target("JP_OTHER", m, 5_000);
}

const weeks = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07"];
weeks.forEach((w, i) =>
  batch.set(db.doc(`onlineWeekly/${w}`), { weekStart: w, currency: "CNY", xiaohongshu: 4_000 + i * 500, taobao: 3_000 + (i % 3) * 700 }),
);
await batch.commit();

console.log("サンプルデータを投入しました。ログイン: demo@example.com / password123");
