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

await db.doc("settings/app").set({ startMonth: "2026-11", endMonth: "2027-12", currencyLabel: "円" });

const batch = db.batch();
const months = ["2026-11", "2026-12", "2027-01"];
months.forEach((m, i) => {
  const k = i + 1;
  const put = (cat, t, p, pd) =>
    batch.set(db.doc(`monthlyEntries/${cat}_${m}`), {
      categoryId: cat,
      month: m,
      currency: "JPY",
      target: t,
      plan: p,
      paid: pd,
    });
  put("JP_LICENSE", 1_000_000 * k, 900_000 * k, i === 0 ? 900_000 : 0);
  put("JP_OFFLINE", 300_000, 250_000, i === 0 ? 240_000 : 0);
  put("JP_OTHER", 50_000, 0, 0);
  put("CN_LICENSE", 500_000, 400_000, 0);
  put("CN_OFFLINE", 100_000, 80_000, 0);
});
const weeks = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07"];
weeks.forEach((w, i) => {
  for (const [cat, base] of [
    ["JP_ONLINE", 120_000],
    ["CN_ONLINE", 60_000],
  ]) {
    batch.set(db.doc(`weeklyEntries/${w}_${cat}`), {
      categoryId: cat,
      weekStart: w,
      currency: "JPY",
      target: base,
      plan: base - 10_000 * (i % 3),
      paid: i < 2 ? base - 15_000 : 0,
    });
  }
});
await batch.commit();

const deals = [
  {
    country: "JP",
    character: "スタジオハヌル",
    licensee: "株式会社サンプル雑貨",
    title: "アクリルスタンド",
    productCategory: "雑貨",
    contractType: "ロイヤリティ",
    status: "進行中",
    startDate: "2026-10-01",
    endDate: "2027-09-30",
    royaltyRate: 8,
    amount: null,
    owner: "佐藤",
    note: "",
  },
  {
    country: "CN",
    character: "Lovely MongMong",
    licensee: "上海サンプル文化",
    title: "POP UP ストア",
    productCategory: "イベント",
    contractType: "POP UP",
    status: "交渉中",
    startDate: null,
    endDate: null,
    royaltyRate: null,
    amount: 2_000_000,
    owner: "鈴木",
    note: "2027年春開催予定",
  },
];
const existing = await db.collection("deals").limit(1).get();
if (existing.empty) {
  let no = 0;
  for (const d of deals) {
    no++;
    await db.collection("deals").add({ ...d, no, createdAt: new Date(), updatedAt: new Date() });
  }
  await db.doc("counters/deals").set({ last: no });
}

console.log("サンプルデータを投入しました。ログイン: demo@example.com / password123");
