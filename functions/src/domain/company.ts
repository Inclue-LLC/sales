// 会社名から「株式会社」などの法人の種類を取り除く（ライセンシー名の表示用）。
//   "株式会社サンプル" → "サンプル"、"サンプル（株）" → "サンプル"、"Sample Co., Ltd." → "Sample"

const JA = [
  "株式会社", "有限会社", "合同会社", "合資会社", "合名会社",
  "一般社団法人", "一般財団法人", "公益社団法人", "公益財団法人", "特定非営利活動法人", "NPO法人",
  "股份有限公司", "有限责任公司", "有限責任公司", "有限公司", "集团", "集團",
];
// (株) （株） ㈱ など
const ABBR = /[（(]\s*(株|有|同|合|名|資|社|財)\s*[)）]|[㈱㈲㈳㈶]/g;
// 英語の会社の種類（末尾）
const EN = /[\s,.]*\b(co\.?,?\s*ltd|company\s+limited|co\.?\s*limited|corporation|corp|incorporated|inc|llc|ltd|limited|k\.?\s*k|g\.?\s*k|gmbh|pte\.?\s*ltd|plc)\.?\s*$/i;

export function stripCompanyType(name: string): string {
  let s = (name ?? "").normalize("NFKC").trim();
  s = s.replace(ABBR, " ");
  for (const w of JA) s = s.split(w).join(" ");
  for (let i = 0; i < 3 && EN.test(s); i++) s = s.replace(EN, "");
  s = s.replace(/\s+/g, " ").trim();
  return s || (name ?? "").trim();
}
