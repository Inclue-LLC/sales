// 1ページ目：売上一覧。月が右に並び、各月に「目標」「売上」（単位：元）。
// 目標は国ごとの固定値（編集不可）。売上はライセンス／中国オンライン／オフライン／その他から自動で集計される。
import { useCallback, useEffect, useRef, useState } from "react";
import { Api, COUNTRY_TARGETS, type Summary, type SummaryRow } from "../api";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";
import { defaultMonth, num } from "../format";

export default function SummaryPage() {
  const [data, setData] = useState<Summary | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const load = useCallback(() => {
    Api.getSummary().then(setData).catch((e) => toast.error(e.message));
  }, [toast]);
  useEffect(load, [load]);

  // 初回表示で今月の列が見えるようにスクロール
  const scrolled = useRef(false);
  useEffect(() => {
    if (!data || scrolled.current || !scroller.current) return;
    scrolled.current = true;
    const el = scroller.current;
    const th = el.querySelector<HTMLElement>(`[data-month="${defaultMonth(data.months)}"]`);
    const sticky = el.querySelector<HTMLElement>("thead .sticky-col");
    if (!th || !sticky) return;
    const x = th.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    el.scrollLeft = Math.max(0, x - sticky.offsetWidth - 80);
  }, [data]);

  if (!data) return <div className="page loading">読み込み中…</div>;
  const thisMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="page page-summary">
      <PageHeader
        title="売上一覧"
        sub={
          <>
            単位：元（日本の売上は設定のレート 1元＝{data.settings.jpyPerCny}円 で換算）。目標（毎月・固定）：中国 {num(COUNTRY_TARGETS.CN)}元、日本 {num(COUNTRY_TARGETS.JP)}元。
            <span className="legend">
              <i className="over" />
              目標以上
              <i className="under" />
              目標未満
            </span>
          </>
        }
      />
      {data.notices.map((n) => (
        <p key={n} className="notice">
          {n}
        </p>
      ))}
      <div className="table-card" ref={scroller}>
        <table className="summary">
          <thead>
            <tr>
              <th className="sticky-col" rowSpan={2}>
                区分
              </th>
              {data.months.map((m) => (
                <th key={m} colSpan={2} data-month={m} className={`month ${m === thisMonth ? "current" : ""}`}>
                  <span className="year">{m.slice(0, 4)}年</span>
                  {Number(m.slice(5))}月
                </th>
              ))}
            </tr>
            <tr>
              {data.months.map((m) => [
                <th key={`${m}t`} className="sub-head">
                  目標
                </th>,
                <th key={`${m}s`} className="sub-head">
                  売上
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <Row key={r.key} row={r} months={data.months} thisMonth={thisMonth} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * 目標との比較で色を付ける。
 * 目標以上 → 青、目標未満 → 赤。目標が未入力の月と、まだ来ていない月で未達のものは色を付けない。
 */
function compare(target: number | undefined, sales: number, month: string, thisMonth: string): string {
  if (!target) return "";
  if (sales >= target) return "over";
  return month <= thisMonth ? "under" : "";
}

function Row(props: { row: SummaryRow; months: string[]; thisMonth: string }) {
  const r = props.row;
  return (
    <tr className={`row-${r.kind}`}>
      <th className="sticky-col">{r.label}</th>
      {props.months.map((m) => [
        <td key={`${m}t`} className="num target">
          {r.target ? num(r.target[m]) : ""}
        </td>,
        <td key={`${m}s`} className={`num sales ${r.target ? compare(r.target[m], r.sales[m], m, props.thisMonth) : ""}`}>
          {num(r.sales[m])}
        </td>,
      ])}
    </tr>
  );
}
