// オンライン週次。月を選び、週ごとのカードで日本・中国の金額を入力する。
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Api, COUNTRY_LABELS, downloadCsv, type Category, type ValueField, type WeeklyRow, type WeeklyView } from "../api";
import { IconDownload } from "../components/Icons";
import { MoneyInput } from "../components/MoneyInput";
import { Segmented, loadPref, savePref } from "../components/Segmented";
import { useToast } from "../components/Toast";
import { dateLabel, monthLabel, yen } from "../format";
import WeeklyGrid from "./WeeklyGrid";

type View = "cards" | "table";
const FIELDS: { key: ValueField; label: string }[] = [
  { key: "target", label: "目標" },
  { key: "plan", label: "予定" },
  { key: "paid", label: "入金済み" },
];

export default function WeeklyPage() {
  const [data, setData] = useState<WeeklyView | null>(null);
  const [view, setView] = useState<View>(loadPref("weekly.view", "cards"));
  const [params, setParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    Api.getWeekly().then(setData).catch((e) => toast.error(e.message));
  }, [toast]);
  useEffect(load, [load]);

  const run = useCallback(
    async (p: Promise<WeeklyView>) => {
      setSaving(true);
      try {
        setData(await p);
      } catch (e) {
        toast.error((e as Error).message);
        load();
      } finally {
        setSaving(false);
      }
    },
    [load, toast],
  );

  if (!data) return <div className="page loading">読み込み中…</div>;

  const now = new Date().toISOString().slice(0, 7);
  const qm = params.get("month");
  const month = qm && data.months.includes(qm) ? qm : data.months.includes(now) ? now : data.months[0];
  const group = data.groups.find((g) => g.month === month)!;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>オンライン週次</h1>
          <p className="sub">
            週ごとに入力した金額が、計上月ごとに「商品販売 オンライン」へ集計されます・単位：{data.settings.currencyLabel}
            <span className={`saving ${saving ? "on" : ""}`}>保存中…</span>
          </p>
        </div>
        <div className="head-actions">
          <Segmented<View>
            value={view}
            options={[
              { value: "cards", label: "カード" },
              { value: "table", label: "表で編集" },
            ]}
            onChange={(v) => {
              setView(v);
              savePref("weekly.view", v);
            }}
          />
          <button className="btn ghost" onClick={() => downloadCsv("weekly").catch((e) => toast.error(e.message))}>
            <IconDownload size={16} />
            CSV
          </button>
        </div>
      </header>

      {view === "table" ? (
        <>
          <p className="hint">計上月セルをダブルクリックすると変更できます。黄色のセルに入力できます（Excel からの貼り付け可）。</p>
          <WeeklyGrid view={data} run={run} />
        </>
      ) : (
        <div className="stack">
          <nav className="month-tabs" aria-label="計上月">
            {data.groups.map((g) => (
              <button
                key={g.month}
                className={g.month === month ? "on" : ""}
                onClick={() => setParams({ month: g.month }, { replace: true })}
              >
                <span>{monthLabel(g.month)}</span>
                <small>{yen(g.subtotal.total.paid)}</small>
              </button>
            ))}
          </nav>

          <section className="card month-summary">
            <div className="card-head">
              <h2>{monthLabel(month)}の合計</h2>
              <span className="sub">{group.weeks.length}週</span>
            </div>
            <div className="summary-grid">
              {data.categories.map((c) => (
                <SummaryBlock key={c.id} title={COUNTRY_LABELS[c.country]} v={group.subtotal.values[c.id]} />
              ))}
              <SummaryBlock title="合計" v={group.subtotal.total} strong />
            </div>
          </section>

          {group.weeks.length === 0 && <p className="empty">この月に計上される週はありません。</p>}
          <div className="week-list">
            {group.weeks.map((w) => (
              <WeekCard key={w.weekStart} week={w} categories={data.categories} months={data.months} run={run} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryBlock(props: { title: string; v: { target: number; plan: number; paid: number }; strong?: boolean }) {
  return (
    <div className={`summary-block ${props.strong ? "strong" : ""}`}>
      <h3>{props.title}</h3>
      <dl>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <dt>{f.label}</dt>
            <dd>{yen(props.v[f.key])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function WeekCard(props: {
  week: WeeklyRow;
  categories: Category[];
  months: string[];
  run: (p: Promise<WeeklyView>) => void;
}) {
  const w = props.week;
  const short = (d: string) => dateLabel(d).replace(/^\d{4}\//, "");
  return (
    <article className="card week-card">
      <div className="week-head">
        <div>
          <h3>第{w.no}週</h3>
          <span className="sub">
            {short(w.weekStart)} 〜 {short(w.weekEnd)}
          </span>
        </div>
        <label className="booking">
          <span>計上月</span>
          <select
            value={w.overrideMonth ?? ""}
            onChange={(e) => props.run(Api.setWeekBookingMonth(w.weekStart, e.target.value || null))}
          >
            <option value="">自動（{monthLabel(w.autoMonth)}）</option>
            {props.months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          {w.overrideMonth && <span className="badge">手動</span>}
        </label>
      </div>
      <div className="week-body">
        <div className="week-row week-row-head" aria-hidden>
          <span />
          {FIELDS.map((f) => (
            <span key={f.key}>{f.label}</span>
          ))}
        </div>
        {props.categories.map((c) => (
          <div key={c.id} className="week-row">
            <span className="week-country">{COUNTRY_LABELS[c.country]}</span>
            {FIELDS.map((f) => (
              <MoneyInput
                key={f.key}
                label={`${COUNTRY_LABELS[c.country]} ${f.label}`}
                value={w.values[c.id]?.[f.key] ?? 0}
                onCommit={(v) =>
                  props.run(Api.saveWeeklyCells([{ weekStart: w.weekStart, categoryId: c.id, field: f.key, value: v }]))
                }
              />
            ))}
          </div>
        ))}
        <div className="week-row week-total">
          <span className="week-country">合計</span>
          {FIELDS.map((f) => (
            <span key={f.key} className="num">
              {yen(w.total[f.key])}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
