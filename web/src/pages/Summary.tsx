// 1ページ目：売上一覧。月が右に並び、各月に「目標」「売上」（単位：元）。
// 目標はセルをクリックして入力。売上はライセンス／中国オンライン／オフライン／その他から自動で集計される。
import { useCallback, useEffect, useRef, useState } from "react";
import { Api, type Summary, type SummaryRow } from "../api";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";
import { defaultMonth, num, parseAmount } from "../format";

export default function SummaryPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [saving, setSaving] = useState(false);
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

  const saveTarget = async (lineId: string, month: string, value: number) => {
    setSaving(true);
    try {
      setData(await Api.saveTargets([{ lineId, month, value }]));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <div className="page loading">読み込み中…</div>;
  const thisMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="page page-summary">
      <PageHeader
        title="売上一覧"
        sub={
          <>
            単位：元（日本の売上は設定のレート 1元＝{data.settings.jpyPerCny}円 で換算）。目標の数字をクリックすると入力できます。
            <span className="legend">
              <i className="over" />
              目標以上
              <i className="under" />
              目標未満
            </span>
            <span className={`saving ${saving ? "on" : ""}`}>保存中…</span>
          </>
        }
      />
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
              <Row key={r.key} row={r} months={data.months} thisMonth={thisMonth} onSaveTarget={saveTarget} />
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

function Row(props: {
  row: SummaryRow;
  months: string[];
  thisMonth: string;
  onSaveTarget: (lineId: string, month: string, v: number) => void;
}) {
  const r = props.row;
  return (
    <tr className={`row-${r.kind}`}>
      <th className="sticky-col">{r.label}</th>
      {props.months.map((m) => [
        <td key={`${m}t`} className="num target">
          {r.lineId ? (
            <TargetCell value={r.target![m]} onSave={(v) => props.onSaveTarget(r.lineId!, m, v)} />
          ) : r.target ? (
            num(r.target[m])
          ) : (
            ""
          )}
        </td>,
        <td key={`${m}s`} className={`num sales ${r.target ? compare(r.target[m], r.sales[m], m, props.thisMonth) : ""}`}>
          {num(r.sales[m])}
        </td>,
      ])}
    </tr>
  );
}

/** クリックで入力欄になる目標セル */
function TargetCell(props: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);

  if (!editing)
    return (
      <button
        className="target-btn"
        title="クリックして目標を入力"
        onClick={() => {
          setText(props.value ? String(props.value) : "");
          setInvalid(false);
          setEditing(true);
        }}
      >
        {num(props.value)}
      </button>
    );

  const commit = () => {
    const v = parseAmount(text);
    if (v === null) {
      setInvalid(true);
      return;
    }
    setEditing(false);
    if (v !== props.value) props.onSave(v);
  };
  return (
    <input
      className={`target-input ${invalid ? "invalid" : ""}`}
      inputMode="numeric"
      autoFocus
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}
