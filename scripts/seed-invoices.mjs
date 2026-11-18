// ローカル確認用：請求書ツールの請求書をエミュレータに入れる（エミュレータ専用）
//   npm run seed:invoices
import { createRequire } from "node:module";

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8188";
const db = getFirestore(initializeApp({ projectId: "inclue-invoice" }, "invoice"));

const base = { type: "invoice", issueDate: "2026-11-10", subject: "", clientName: "", totals: { total: 0 } };
const docs = {
  "inv-jp-license": { ...base, number: "INV-2026-0101", status: "issued", clientName: "株式会社サンプル雑貨", dueDate: "2026-11-30", totals: { total: 330_000 },
    pl: { country: "JP", kind: "license", character: "スタジオハヌル", type: "ロイヤリティ", venue: "", content: "" } },
  "inv-cn-offline": { ...base, number: "INV-2026-0102", status: "paid", clientName: "上海サンプル文化", dueDate: "2026-12-31", totals: { total: 105_000 },
    pl: { country: "JP", kind: "offline", character: "ふにゅ", type: "委託販売", venue: "上海 POP UP", content: "" } },
  "inv-draft": { ...base, number: "INV-2026-0103", status: "draft", dueDate: "2026-11-30", totals: { total: 999_999 },
    pl: { country: "JP", kind: "other", character: "", type: "", venue: "", content: "下書き" } },
  "inv-nopl": { ...base, number: "INV-2026-0104", status: "issued", dueDate: "2026-11-30", totals: { total: 888_888 }, pl: null },
};
for (const [id, d] of Object.entries(docs)) await db.doc(`documents/${id}`).set(d);
console.log("請求書のサンプルを入れました（反映されるのは 2 件）");
