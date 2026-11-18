import { describe, expect, it } from "vitest";
import { buildMonthlyPl, buildWeekly, monthlyKey, weeklyKey, type RawData } from "../src/domain/aggregate";
import { defaultCategories } from "../src/domain/categories";
import { monthlyPlCsv } from "../src/domain/csv";
import { listMonths, listWeeks } from "../src/domain/period";
import { DEFAULT_SETTINGS } from "../src/domain/types";

describe("period", () => {
  it("lists 14 months from 2026-11 to 2027-12", () => {
    const m = listMonths("2026-11", "2027-12");
    expect(m).toHaveLength(14);
    expect(m[0]).toBe("2026-11");
    expect(m[13]).toBe("2027-12");
  });

  it("first week is the first week whose Thursday is in the start month", () => {
    const w = listWeeks("2026-11", "2027-12");
    expect(w[0]).toMatchObject({ no: 1, weekStart: "2026-11-02", weekEnd: "2026-11-08", autoMonth: "2026-11" });
  });

  it("last week is the last week whose Thursday is in the end month", () => {
    const w = listWeeks("2026-11", "2027-12");
    const last = w[w.length - 1];
    expect(last).toMatchObject({ weekStart: "2027-12-27", weekEnd: "2028-01-02", autoMonth: "2027-12" });
  });

  it("assigns cross-month weeks to the month holding Thursday", () => {
    // 2026-11-30(月)〜12-06(日): 木曜は 12/3 → 12月
    const w = listWeeks("2026-11", "2027-12").find((x) => x.weekStart === "2026-11-30")!;
    expect(w.autoMonth).toBe("2026-12");
  });

  it("applies overrides only within the period", () => {
    const w = listWeeks("2026-11", "2027-12", { "2026-11-30": "2026-11", "2026-11-02": "2025-01" });
    expect(w.find((x) => x.weekStart === "2026-11-30")!.bookingMonth).toBe("2026-11");
    expect(w.find((x) => x.weekStart === "2026-11-02")).toMatchObject({ overrideMonth: null, bookingMonth: "2026-11" });
  });
});

function raw(): RawData {
  return {
    settings: DEFAULT_SETTINGS,
    categories: defaultCategories(),
    monthly: new Map(),
    weekly: new Map(),
    weekOverrides: {},
  };
}

describe("aggregate", () => {
  it("rolls weekly online into monthly PL by booking month and totals everything", () => {
    const r = raw();
    r.monthly.set(monthlyKey("JP_LICENSE", "2026-11"), { target: 100, plan: 80, paid: 50 });
    r.monthly.set(monthlyKey("JP_OFFLINE", "2026-11"), { target: 10, plan: 10, paid: 10 });
    r.monthly.set(monthlyKey("JP_OTHER", "2026-11"), { target: 1, plan: 1, paid: 1 });
    r.monthly.set(monthlyKey("CN_LICENSE", "2026-11"), { target: 1000, plan: 0, paid: 0 });
    // 月次入力されたオンラインは無視される（週次が正）
    r.monthly.set(monthlyKey("JP_ONLINE", "2026-11"), { target: 999999, plan: 0, paid: 0 });
    r.weekly.set(weeklyKey("2026-11-02", "JP_ONLINE"), { target: 5, plan: 4, paid: 3 });
    r.weekly.set(weeklyKey("2026-11-30", "JP_ONLINE"), { target: 7, plan: 0, paid: 0 }); // → 12月
    r.weekly.set(weeklyKey("2026-11-09", "CN_ONLINE"), { target: 2, plan: 2, paid: 2 });

    const pl = buildMonthlyPl(r);
    const row = (k: string) => pl.rows.find((x) => x.key === k)!;
    expect(row("JP_ONLINE").values["2026-11"]).toEqual({ target: 5, plan: 4, paid: 3 });
    expect(row("JP_ONLINE").values["2026-12"].target).toBe(7);
    expect(row("JP_goods_TOTAL").values["2026-11"]).toEqual({ target: 15, plan: 14, paid: 13 });
    expect(row("JP_TOTAL").values["2026-11"]).toEqual({ target: 116, plan: 95, paid: 64 });
    expect(row("CN_TOTAL").values["2026-11"]).toEqual({ target: 1002, plan: 2, paid: 2 });
    expect(row("GRAND_TOTAL").values["2026-11"]).toEqual({ target: 1118, plan: 97, paid: 66 });

    // 計上月を上書きすると移動する
    r.weekOverrides["2026-11-30"] = "2026-11";
    const pl2 = buildMonthlyPl(r);
    expect(pl2.rows.find((x) => x.key === "JP_ONLINE")!.values["2026-11"].target).toBe(12);
    expect(pl2.rows.find((x) => x.key === "JP_ONLINE")!.values["2026-12"].target).toBe(0);
  });

  it("produces rows in the specified order", () => {
    const labels = buildMonthlyPl(raw()).rows.map((r) => r.label);
    expect(labels).toEqual([
      "日本",
      "ライセンス",
      "商品販売 オンライン",
      "商品販売 オフライン",
      "商品販売 計",
      "その他",
      "日本 計",
      "中国",
      "ライセンス",
      "商品販売 オンライン",
      "商品販売 オフライン",
      "商品販売 計",
      "その他",
      "中国 計",
      "合計",
    ]);
  });

  it("weekly view groups weeks by booking month with subtotals", () => {
    const r = raw();
    r.weekly.set(weeklyKey("2026-11-02", "JP_ONLINE"), { target: 5, plan: 0, paid: 0 });
    r.weekly.set(weeklyKey("2026-11-02", "CN_ONLINE"), { target: 3, plan: 0, paid: 0 });
    const v = buildWeekly(r);
    expect(v.categories.map((c) => c.id)).toEqual(["JP_ONLINE", "CN_ONLINE"]);
    const nov = v.groups[0];
    expect(nov.month).toBe("2026-11");
    expect(nov.weeks.map((w) => w.weekStart)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(nov.weeks[0].total.target).toBe(8);
    expect(nov.subtotal.total.target).toBe(8);
  });
});

describe("csv", () => {
  it("starts with a BOM and uses CRLF", () => {
    const csv = monthlyPlCsv(buildMonthlyPl(raw()));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("\r\n");
    expect(csv.split("\r\n")[1].split(",")).toHaveLength(1 + 14 * 3);
  });
});
