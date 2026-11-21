import { describe, expect, it } from "vitest";
import { stripCompanyType } from "../src/domain/company";

describe("stripCompanyType", () => {
  it.each([
    ["株式会社サンプル", "サンプル"],
    ["サンプル株式会社", "サンプル"],
    ["サンプル（株）", "サンプル"],
    ["(株)サンプル", "サンプル"],
    ["㈱サンプル", "サンプル"],
    ["有限会社ふにゅ商店", "ふにゅ商店"],
    ["合同会社ABC", "ABC"],
    ["一般社団法人キャラクター協会", "キャラクター協会"],
    ["Sample Co., Ltd.", "Sample"],
    ["Sample Inc.", "Sample"],
    ["Sample LLC", "Sample"],
    ["上海示例文化有限公司", "上海示例文化"],
    ["サンプル", "サンプル"],
    ["株式会社", "株式会社"],
  ])("%s → %s", (input, out) => expect(stripCompanyType(input)).toBe(out));
});
