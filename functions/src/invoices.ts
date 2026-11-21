// 請求書ツール（別の Firebase プロジェクト）の請求書を読み取り、PL の売上として扱う。
//
// - 読み取り専用。請求書ツールの Firestore に、この関数の実行アカウントの「Cloud Datastore 閲覧者」権限が必要
// - 対象: 種別が請求書で、状態が 発行済 / 入金済、かつ「PL管理に反映する」区分（pl）が付いているもの
// - 国: すべて日本（請求書ツールは日本の売上だけを扱う）
// - ライセンシー（ライセンス）・会社名（その他）: 取引先マスタの会社名（なければ請求書の宛名）から「株式会社」などを除いたもの
// - 金額: 税込合計（円）。計上月: お支払期限の月（未入力なら発行日の月）
// - 請求書ツールのプロジェクトID は functions/.env の INVOICE_PROJECT_ID（空なら連携しない）

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { stripCompanyType } from "./domain/company";
import type { Entry, EntryKind } from "./domain/types";

const KINDS: EntryKind[] = ["license", "offline", "other"];

function invoiceDb() {
  const projectId = process.env.INVOICE_PROJECT_ID?.trim();
  if (!projectId) return null;
  const app = getApps().find((a) => a.name === "invoice") ?? initializeApp({ projectId }, "invoice");
  return getFirestore(app);
}

/**
 * 請求書ツールの1件を PL の案件に変換する（反映対象でなければ null）。
 * clientMasterName: 取引先マスタの会社名（宛名には部署名が付くことがあるため、あればこちらを使う）
 */
export function invoiceToEntry(id: string, d: FirebaseFirestore.DocumentData, clientMasterName?: string): Entry | null {
  const pl = d.pl;
  if (d.type !== "invoice" || !pl) return null;
  if (d.status !== "issued" && d.status !== "paid") return null;
  if (!KINDS.includes(pl.kind)) return null;
  const month = String(d.dueDate || d.issueDate || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const amount = Number(d.totals?.total ?? 0);
  if (!Number.isSafeInteger(amount)) return null;
  const company = stripCompanyType(clientMasterName || d.clientName || "");
  return {
    id: `inv_${id}`,
    kind: pl.kind,
    source: "invoice",
    invoiceId: id,
    invoiceNumber: d.number ?? "",
    clientName: d.clientName ?? "",
    country: "JP", // 請求書ツールの売上はすべて日本
    month,
    amount,
    currency: "JPY", // 請求書は円建て
    amountCny: 0, // 呼び出し側でレートを使って計算する
    licensee: pl.kind === "license" ? company || undefined : undefined,
    company: pl.kind === "other" ? company || undefined : undefined,
    character: pl.character || undefined,
    type: pl.type || undefined,
    venue: pl.venue || undefined,
    content: pl.content || d.subject || undefined,
    createdAt: d.issueDate ?? "",
    updatedAt: "",
  };
}

export interface InvoiceLoad {
  entries: Entry[];
  /** 読み込めなかったときの理由（画面に表示する） */
  error?: string;
}

export async function listInvoiceEntries(): Promise<InvoiceLoad> {
  const db = invoiceDb();
  if (!db) return { entries: [] };
  try {
    const [snap, clients] = await Promise.all([db.collection("documents").where("type", "==", "invoice").get(), db.collection("clients").get()]);
    const clientNames = new Map(clients.docs.map((c) => [c.id, String(c.data().name ?? "")]));
    const entries = snap.docs
      .map((doc) => invoiceToEntry(doc.id, doc.data(), clientNames.get(doc.data().clientId)))
      .filter((e): e is Entry => e !== null);
    return { entries };
  } catch (e) {
    console.error("請求書ツールの読み込みに失敗しました", e);
    const denied = (e as { code?: number }).code === 7;
    return {
      entries: [],
      error: denied
        ? "請求書ツールのデータを読み込む権限がありません（請求書ツール側のプロジェクトで権限の設定が必要です）。請求書の分は売上に含まれていません。"
        : "請求書ツールのデータを読み込めませんでした。請求書の分は売上に含まれていません。",
    };
  }
}
