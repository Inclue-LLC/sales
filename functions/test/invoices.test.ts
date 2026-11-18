import { describe, expect, it } from "vitest";
import { buildSummary } from "../src/domain/aggregate";
import { DEFAULT_SETTINGS } from "../src/domain/types";
import { invoiceToEntry } from "../src/invoices";

const inv = (p: Record<string, unknown> = {}) => ({
  type: "invoice",
  status: "issued",
  number: "INV-2026-0001",
  clientName: "株式会社サンプル",
  subject: "ライセンス料",
  issueDate: "2026-11-20",
  dueDate: "2026-12-31",
  totals: { total: 210_000 },
  pl: { country: "JP", kind: "license", character: "ふにゅ", type: "MG", venue: "", content: "" },
  ...p,
});

describe("invoiceToEntry", () => {
  it("maps an issued invoice to a JPY entry in the due-date month", () => {
    expect(invoiceToEntry("abc", inv())).toMatchObject({
      id: "inv_abc",
      source: "invoice",
      kind: "license",
      country: "JP",
      month: "2026-12",
      amount: 210_000,
      currency: "JPY",
      character: "ふにゅ",
      type: "MG",
      invoiceNumber: "INV-2026-0001",
    });
  });

  it("skips drafts, cancelled invoices, other document types and invoices without a PL link", () => {
    expect(invoiceToEntry("a", inv({ status: "draft" }))).toBeNull();
    expect(invoiceToEntry("a", inv({ status: "cancelled" }))).toBeNull();
    expect(invoiceToEntry("a", inv({ type: "receipt" }))).toBeNull();
    expect(invoiceToEntry("a", inv({ pl: null }))).toBeNull();
    expect(invoiceToEntry("a", inv({ status: "paid" }))).not.toBeNull();
  });

  it("falls back to the issue-date month when there is no due date", () => {
    expect(invoiceToEntry("a", inv({ dueDate: "" }))!.month).toBe("2026-11");
  });

  it("counts a yen invoice for China in yuan on the summary", () => {
    const e = invoiceToEntry("a", inv({ pl: { country: "CN", kind: "other", character: "", type: "", venue: "", content: "監修料" } }))!;
    const s = buildSummary({ settings: DEFAULT_SETTINGS, entries: [e], online: new Map(), weekOverrides: {} });
    // 210,000円 ÷ 21 = 10,000元
    expect(s.rows.find((r) => r.key === "CN_OTHER")!.sales["2026-12"]).toBe(10_000);
    expect(s.rows.find((r) => r.key === "CN")!.sales["2026-12"]).toBe(10_000);
  });
});
