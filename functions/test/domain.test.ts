import { describe, expect, it } from "vitest";
import { buildOnline, buildSummary, type RawData } from "../src/domain/aggregate";
import { listMonths, listWeeks } from "../src/domain/period";
import { DEFAULT_SETTINGS, toCny, type Entry } from "../src/domain/types";
import { entry, ValidationError } from "../src/domain/validate";

const e = (p: Partial<Entry>): Entry => ({
  id: Math.random().toString(),
  kind: "license",
  country: "CN",
  currency: p.country === "JP" ? "JPY" : "CNY",
  month: "2026-11",
  amount: 0,
  amountCny: 0,
  createdAt: "",
  updatedAt: "",
  ...p,
});

const raw = (): RawData => ({
  settings: DEFAULT_SETTINGS,
  entries: [],
  online: { CN: new Map(), JP: new Map() },
  weekOverrides: {},
});

describe("period", () => {
  it("starts in 2026-11 and runs 14 months", () => {
    const m = listMonths("2026-11", "2027-12");
    expect(m[0]).toBe("2026-11");
    expect(m).toHaveLength(14);
  });
  it("weeks follow the Thursday rule", () => {
    const w = listWeeks("2026-11", "2027-12");
    expect(w[0]).toMatchObject({ weekStart: "2026-11-02", weekEnd: "2026-11-08", bookingMonth: "2026-11" });
    expect(w.find((x) => x.weekStart === "2026-11-30")!.bookingMonth).toBe("2026-12");
    expect(w[w.length - 1].weekStart).toBe("2027-12-27");
  });
});

describe("summary", () => {
  it("rolls entries and online weeks into rows, with targets and totals", () => {
    const r = raw();
    r.entries = [
      e({ kind: "license", country: "CN", amount: 1000 }),
      e({ kind: "license", country: "CN", amount: 500 }),
      e({ kind: "offline", country: "JP", amount: 6300 }), // 6300円 ÷ 21 = 300元
      e({ kind: "other", country: "JP", amount: 420, month: "2026-12" }), // 20元
    ];
    r.online.CN.set("2026-11-02", { xiaohongshu: 100, taobao: 50 });
    r.online.CN.set("2026-11-30", { xiaohongshu: 7 }); // → 12月

    const s = buildSummary(r);
    const row = (k: string) => s.rows.find((x) => x.key === k)!;
    expect(row("CN_LICENSE").sales["2026-11"]).toBe(1500);
    expect(row("CN_ONLINE").sales["2026-11"]).toBe(150);
    expect(row("CN_ONLINE_xiaohongshu").sales["2026-11"]).toBe(100);
    expect(row("CN_ONLINE_taobao").sales["2026-11"]).toBe(50);
    expect(row("CN_ONLINE").sales["2026-12"]).toBe(7);
    expect(row("CN").sales["2026-11"]).toBe(1650);
    expect(row("CN").target!["2026-11"]).toBe(100_000);
    expect(row("JP").target!["2027-12"]).toBe(100_000);
    expect(row("CN_LICENSE").target).toBeNull();
    expect(row("JP").sales["2026-11"]).toBe(300);
    expect(row("JP_OFFLINE").sales["2026-11"]).toBe(300);
    expect(row("JP_OTHER").sales["2026-12"]).toBe(20);
    expect(row("GRAND_TOTAL").sales["2026-11"]).toBe(1950);
    expect(row("GRAND_TOTAL").target!["2026-11"]).toBe(200_000);

    r.weekOverrides["2026-11-30"] = "2026-11";
    expect(buildSummary(r).rows.find((x) => x.key === "CN_ONLINE")!.sales["2026-11"]).toBe(157);
  });

  it("orders rows China first, then Japan", () => {
    expect(buildSummary(raw()).rows.map((r) => r.label)).toEqual([
      "中国", "ライセンス", "オンライン", "小红书", "淘宝", "オフライン", "その他",
      "日本", "ライセンス", "オンライン", "スタジオハヌル", "Lovely MongMong", "ふにゅ", "オフライン", "その他",
      "合計",
    ]);
  });

  it("online view groups weeks by booking month", () => {
    const r = raw();
    r.online.CN.set("2026-11-09", { taobao: 30 });
    const v = buildOnline(r, "CN");
    expect(v.groups[0].weeks).toHaveLength(4);
    expect(v.groups[0].subtotal.taobao).toBe(30);
    expect(v.groups[0].total).toBe(30);
  });

  it("Japan online is entered in yen per character and shown in yuan on the summary", () => {
    const r = raw();
    r.online.JP.set("2026-11-02", { hanul: 2100, funyu: 4200 }); // 100元 + 200元
    r.online.JP.set("2026-11-09", { hanul: 2100 });
    const v = buildOnline(r, "JP");
    expect(v.currency).toBe("JPY");
    expect(v.groups[0].subtotal.hanul).toBe(4200);
    expect(v.groups[0].total).toBe(8400);
    expect(v.groups[0].totalCny).toBe(400);
    const s = buildSummary(r);
    const row = (k: string) => s.rows.find((x) => x.key === k)!;
    expect(row("JP_ONLINE").sales["2026-11"]).toBe(400);
    expect(row("JP_ONLINE_hanul").sales["2026-11"]).toBe(200);
    expect(row("JP_ONLINE_mongmong").sales["2026-11"]).toBe(0);
    expect(row("JP").sales["2026-11"]).toBe(400);
    expect(row("CN_ONLINE").sales["2026-11"]).toBe(0);
  });
});

describe("validate", () => {
  it("requires the fields for each kind", () => {
    expect(entry("license", { country: "JP", month: "2026-11", amount: "1,000", licensee: "株式会社サンプル", character: "ふにゅ", type: "MG" })).toMatchObject({
      amount: 1000,
      licensee: "サンプル",
    });
    expect(() => entry("license", { country: "JP", month: "2026-11", amount: 1, character: "ふにゅ", type: "MG" })).toThrow(/ライセンシー/);
    expect(() => entry("license", { country: "JP", month: "2026-11", amount: 1, licensee: "x", character: "ふにゅ", type: "一括" })).toThrow(ValidationError);
    expect(() => entry("offline", { country: "CN", month: "2026-11", amount: 1, character: "x", type: "POP UP" })).toThrow(/お店/);
    expect(() => entry("other", { country: "CN", month: "2026-11", amount: 1.5, company: "x", content: "x" })).toThrow(/整数/);
    expect(() => entry("other", { country: "CN", month: "2026-11", amount: 1, content: "x" })).toThrow(/会社名/);
    expect(entry("other", { country: "JP", month: "2026-11", amount: 1, company: "サンプル（株）", content: "x" }).company).toBe("サンプル");
  });
});

describe("currency", () => {
  it("converts yen to yuan with the configured rate", () => {
    expect(toCny(10000, "JPY", 21)).toBe(476);
    expect(toCny(10000, "CNY", 21)).toBe(10000);
  });
});
