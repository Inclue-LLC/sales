import type { Category, Country } from "./types";

/** 初期カテゴリ（日本・中国とも同じ構成）。Firestore が空のときに投入する。 */
export function defaultCategories(): Category[] {
  const countries: Country[] = ["JP", "CN"];
  const out: Category[] = [];
  for (const c of countries) {
    out.push(
      {
        id: `${c}_LICENSE`,
        country: c,
        groupKey: "license",
        groupLabel: "ライセンス",
        groupOrder: 10,
        subKey: null,
        subLabel: null,
        subOrder: 0,
        granularity: "monthly",
      },
      {
        id: `${c}_ONLINE`,
        country: c,
        groupKey: "goods",
        groupLabel: "商品販売",
        groupOrder: 20,
        subKey: "online",
        subLabel: "オンライン",
        subOrder: 10,
        granularity: "weekly",
      },
      {
        id: `${c}_OFFLINE`,
        country: c,
        groupKey: "goods",
        groupLabel: "商品販売",
        groupOrder: 20,
        subKey: "offline",
        subLabel: "オフライン",
        subOrder: 20,
        granularity: "monthly",
      },
      {
        id: `${c}_OTHER`,
        country: c,
        groupKey: "other",
        groupLabel: "その他",
        groupOrder: 30,
        subKey: null,
        subLabel: null,
        subOrder: 0,
        granularity: "monthly",
      },
    );
  }
  return out;
}

export function sortCategories(cats: Category[]): Category[] {
  const countryOrder: Record<string, number> = { JP: 0, CN: 1 };
  return [...cats].sort(
    (a, b) =>
      countryOrder[a.country] - countryOrder[b.country] ||
      a.groupOrder - b.groupOrder ||
      a.subOrder - b.subOrder,
  );
}
