// 1ページ目：売上一覧。月が右に並び、各月に「目標」「売上」。
// 目標はセルをクリックして入力。売上はライセンス／中国オンライン／オフライン／その他から自動で集計される。
import { useCallback, useEffect, useRef, useState } from "react";
import { Api, downloadCsv, type Summary, type SummaryRow } from "../api";
import { IconDownload } from "../components/Icons";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";
import { defaultMonth, parseAmount, yen } from "../format";

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
    // 区分列のすぐ右に今月が来る位置（1つ前の月も少し見えるように）
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
    <div className="page">
      <PageHeader
        title="売上一覧"
        sub={
          <>
            目標の数字をクリックすると入力できます。売上は各ページの入力から自動で集計されます（単位：{data.settings.currencyLabel}）
            <span className={`saving ${saving ? "on" : ""}`}>保存中…</span>
          </>
        }
        actions={
          <button className="btn ghost" onClick={() => downloadCsv("summary").catch((e) => toast.error(e.message))}>
            <IconDownload size={16} />
            CSV
          </button>
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
                <th key={`${m}s`} className="sub-head month-end">
                  売上
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <Row key={r.key} row={r} months={data.months} onSaveTarget={saveTarget} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row(props: { row: SummaryRow; months: string[]; onSaveTarget: (lineId: string, month: string, v: number) => void }) {
  const r = props.row;
  if (r.kind === "country") {
    return (
      <tr className="row-country">
        <th className="sticky-col">{r.label}</th>
        <td colSpan={props.months.length * 2} />
      </tr>
    );
  }
  return (
    <tr className={`row-${r.kind}`}>
      <th className="sticky-col">{r.label}</th>
      {props.months.map((m) => [
        <td key={`${m}t`} className="num target">
          {r.lineId ? (
            <TargetCell value={r.target![m]} onSave={(v) => props.onSaveTarget(r.lineId!, m, v)} />
          ) : r.target ? (
            yen(r.target[m])
          ) : (
            ""
          )}
        </td>,
        <td key={`${m}s`} className={`num sales month-end ${r.target && r.sales[m] >= r.target[m] && r.target[m] > 0 ? "achieved" : ""}`}>
          {yen(r.sales[m])}
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
        {yen(props.value)}
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
