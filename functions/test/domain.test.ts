import { describe, expect, it } from "vitest";
import { buildOnline, buildSummary, targetKey, type RawData } from "../src/domain/aggregate";
import { summaryCsv } from "../src/domain/csv";
import { listMonths, listWeeks } from "../src/domain/period";
import { DEFAULT_SETTINGS, type Entry } from "../src/domain/types";
import { entry, ValidationError } from "../src/domain/validate";

const e = (p: Partial<Entry>): Entry => ({
  id: Math.random().toString(),
  kind: "license",
  country: "CN",
  month: "2026-11",
  amount: 0,
  createdAt: "",
  updatedAt: "",
  ...p,
});

const raw = (): RawData => ({
  settings: DEFAULT_SETTINGS,
  entries: [],
  targets: new Map(),
  online: new Map(),
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
      e({ kind: "offline", country: "JP", amount: 300 }),
      e({ kind: "other", country: "JP", amount: 20, month: "2026-12" }),
    ];
    r.online.set("2026-11-02", { xiaohongshu: 100, taobao: 50 });
    r.online.set("2026-11-30", { xiaohongshu: 7 }); // → 12月
    r.targets.set(targetKey("CN_LICENSE", "2026-11"), 2000);
    r.targets.set(targetKey("JP_OFFLINE", "2026-11"), 400);

    const s = buildSummary(r);
    const row = (k: string) => s.rows.find((x) => x.key === k)!;
    expect(row("CN_LICENSE").sales["2026-11"]).toBe(1500);
    expect(row("CN_ONLINE").sales["2026-11"]).toBe(150);
    expect(row("CN_ONLINE_xiaohongshu").sales["2026-11"]).toBe(100);
    expect(row("CN_ONLINE_taobao").sales["2026-11"]).toBe(50);
    expect(row("CN_ONLINE").sales["2026-12"]).toBe(7);
    expect(row("CN_TOTAL").sales["2026-11"]).toBe(1650);
    expect(row("CN_TOTAL").target!["2026-11"]).toBe(2000);
    expect(row("JP_TOTAL").sales["2026-11"]).toBe(300);
    expect(row("JP_OTHER").sales["2026-12"]).toBe(20);
    expect(row("GRAND_TOTAL").sales["2026-11"]).toBe(1950);
    expect(row("GRAND_TOTAL").target!["2026-11"]).toBe(2400);

    r.weekOverrides["2026-11-30"] = "2026-11";
    expect(buildSummary(r).rows.find((x) => x.key === "CN_ONLINE")!.sales["2026-11"]).toBe(157);
  });

  it("orders rows China first, then Japan", () => {
    expect(buildSummary(raw()).rows.map((r) => r.label)).toEqual([
      "中国", "ライセンス", "オンライン", "小红书", "淘宝", "オフライン", "その他", "中国 計",
      "日本", "ライセンス", "オフライン", "その他", "日本 計",
      "合計",
    ]);
  });

  it("online view groups weeks by booking month", () => {
    const r = raw();
    r.online.set("2026-11-09", { taobao: 30 });
    const v = buildOnline(r);
    expect(v.groups[0].weeks).toHaveLength(4);
    expect(v.groups[0].subtotal.taobao).toBe(30);
    expect(v.groups[0].total).toBe(30);
  });
});

describe("validate", () => {
  it("requires the fields for each kind", () => {
    expect(entry("license", { country: "JP", month: "2026-11", amount: "1,000", character: "ふにゅ", type: "MG" })).toMatchObject({ amount: 1000 });
    expect(() => entry("license", { country: "JP", month: "2026-11", amount: 1, character: "ふにゅ", type: "一括" })).toThrow(ValidationError);
    expect(() => entry("offline", { country: "CN", month: "2026-11", amount: 1, character: "x", type: "POP UP" })).toThrow(/お店/);
    expect(() => entry("other", { country: "CN", month: "2026-11", amount: 1.5, content: "x" })).toThrow(/整数/);
  });
});

describe("csv", () => {
  it("has a BOM and two columns per month", () => {
    const csv = summaryCsv(buildSummary(raw()));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split("\r\n")[1].split(",")).toHaveLength(1 + 14 * 2);
  });
});
