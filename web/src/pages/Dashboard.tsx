// 売上ダッシュボード（月次PL）。月を選んでカードで見る／入力する。全期間の表は「表で編集」。
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Api, downloadCsv, type MonthlyPl, type PlRow, type Triple } from "../api";
import { IconChevronLeft, IconChevronRight, IconDownload, IconEdit, IconArrowRight } from "../components/Icons";
import { Modal } from "../components/Modal";
import { MoneyInput } from "../components/MoneyInput";
import { Segmented, loadPref, savePref } from "../components/Segmented";
import { useToast } from "../components/Toast";
import { TrendChart } from "../components/TrendChart";
import { monthLabel, yen } from "../format";
import MonthlyGrid, { type MonthlyChange } from "./MonthlyGrid";

type View = "cards" | "table";

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

/** 今日を含む月（期間外なら開始月） */
function defaultMonth(months: string[]): string {
  const now = new Date().toISOString().slice(0, 7);
  return months.includes(now) ? now : months[0];
}

export default function DashboardPage() {
  const [pl, setPl] = useState<MonthlyPl | null>(null);
  const [view, setView] = useState<View>(loadPref("dashboard.view", "cards"));
  const [month, setMonth] = useState<string>("");
  const [editing, setEditing] = useState<PlRow | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    Api.getMonthlyPl()
      .then((p) => {
        setPl(p);
        setMonth((m) => (m && p.months.includes(m) ? m : defaultMonth(p.months)));
      })
      .catch((e) => toast.error(e.message));
  }, [toast]);
  useEffect(load, [load]);

  const save = useCallback(
    async (changes: MonthlyChange[]) => {
      if (changes.length === 0) return;
      setSaving(true);
      try {
        setPl(await Api.saveMonthlyCells(changes));
        return true;
      } catch (e) {
        toast.error((e as Error).message);
        load();
        return false;
      } finally {
        setSaving(false);
      }
    },
    [load, toast],
  );

  const grand = useMemo(() => pl?.rows.find((r) => r.key === "GRAND_TOTAL"), [pl]);

  if (!pl) return <div className="page loading">読み込み中…</div>;

  const idx = pl.months.indexOf(month);
  const total = grand?.values[month] ?? { target: 0, plan: 0, paid: 0 };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>売上ダッシュボード</h1>
          <p className="sub">
            {monthLabel(pl.months[0])}〜{monthLabel(pl.months[pl.months.length - 1])}・単位：{pl.settings.currencyLabel}
            <span className={`saving ${saving ? "on" : ""}`}>保存中…</span>
          </p>
        </div>
        <div className="head-actions">
          <Segmented<View>
            value={view}
            options={[
              { value: "cards", label: "ダッシュボード" },
              { value: "table", label: "表で編集" },
            ]}
            onChange={(v) => {
              setView(v);
              savePref("dashboard.view", v);
            }}
          />
          <button className="btn ghost" onClick={() => downloadCsv("monthly").catch((e) => toast.error(e.message))}>
            <IconDownload size={16} />
            CSV
          </button>
        </div>
      </header>

      {view === "table" ? (
        <>
          <p className="hint">
            全期間を表で表示しています。黄色のセルに入力できます（Excel からの貼り付け可）。「商品販売 オンライン」はオンライン週次の集計です。
          </p>
          <MonthlyGrid pl={pl} save={save} />
        </>
      ) : (
        <div className="stack">
          <div className="month-stepper">
            <button className="icon-btn" disabled={idx <= 0} onClick={() => setMonth(pl.months[idx - 1])} aria-label="前の月">
              <IconChevronLeft />
            </button>
            <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="表示する月">
              {pl.months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <button
              className="icon-btn"
              disabled={idx >= pl.months.length - 1}
              onClick={() => setMonth(pl.months[idx + 1])}
              aria-label="次の月"
            >
              <IconChevronRight />
            </button>
          </div>

          <section className="kpis">
            <Kpi label="目標" value={total.target} tone="target" />
            <Kpi label="予定" value={total.plan} tone="plan" ratio={pct(total.plan, total.target)} />
            <Kpi label="入金済み" value={total.paid} tone="paid" ratio={pct(total.paid, total.target)} />
          </section>

          <section className="card">
            <div className="card-head">
              <h2>月別の推移</h2>
              <span className="sub">日本＋中国の合計・月をクリックで切り替え</span>
            </div>
            <TrendChart months={pl.months} values={grand?.values ?? {}} selected={month} onSelect={setMonth} />
          </section>

          <section className="country-grid">
            {splitByCountry(pl.rows).map((c) => (
              <CountryCard key={c.header.key} header={c.header} rows={c.rows} total={c.total} month={month} onEdit={setEditing} />
            ))}
          </section>
        </div>
      )}

      {editing && editing.categoryId && (
        <EditModal
          row={editing}
          month={month}
          countryLabel={countryOf(pl.rows, editing)}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            const ok = await save(
              (["target", "plan", "paid"] as const).map((f) => ({ categoryId: editing.categoryId!, month, field: f, value: v[f] })),
            );
            if (ok) {
              toast.info("保存しました");
              setEditing(null);
            }
          }}
        />
      )}
    </div>
  );
}

function splitByCountry(rows: PlRow[]) {
  const out: { header: PlRow; rows: PlRow[]; total: PlRow }[] = [];
  let cur: { header: PlRow; rows: PlRow[] } | null = null;
  for (const r of rows) {
    if (r.kind === "header") cur = { header: r, rows: [] };
    else if (r.emphasis === "total" && cur) {
      out.push({ ...cur, total: r });
      cur = null;
    } else if (cur) cur.rows.push(r);
  }
  return out;
}

function countryOf(rows: PlRow[], row: PlRow): string {
  let label = "";
  for (const r of rows) {
    if (r.kind === "header") label = r.label;
    if (r.key === row.key) return label;
  }
  return "";
}

function Kpi(props: { label: string; value: number; tone: string; ratio?: number | null }) {
  return (
    <div className={`kpi kpi-${props.tone}`}>
      <div className="kpi-label">
        <i />
        {props.label}
      </div>
      <div className="kpi-value">
        {yen(props.value)}
      </div>
      {props.ratio !== undefined && (
        <div className="kpi-foot">
          <div className="progress">
            <span style={{ width: `${Math.min(props.ratio ?? 0, 100)}%` }} />
          </div>
          <span className="kpi-ratio">目標比 {props.ratio === null ? "—" : `${props.ratio}%`}</span>
        </div>
      )}
    </div>
  );
}

function Amounts({ v }: { v: Triple }) {
  return (
    <div className="amounts">
      <span>
        <small>目標</small>
        {yen(v.target)}
      </span>
      <span>
        <small>予定</small>
        {yen(v.plan)}
      </span>
      <span>
        <small>入金済み</small>
        {yen(v.paid)}
      </span>
    </div>
  );
}

function CountryCard(props: { header: PlRow; rows: PlRow[]; total: PlRow; month: string; onEdit: (r: PlRow) => void }) {
  const t = props.total.values[props.month] ?? { target: 0, plan: 0, paid: 0 };
  const ratio = pct(t.paid, t.target);
  return (
    <div className="card country-card">
      <div className="country-head">
        <h2>{props.header.label}</h2>
        <span className="pill">入金済み 目標比 {ratio === null ? "—" : `${ratio}%`}</span>
      </div>
      <div className="country-total">
        <Amounts v={t} />
      </div>
      <ul className="cat-list">
        {props.rows.map((r) => {
          const v = r.values[props.month] ?? { target: 0, plan: 0, paid: 0 };
          const isWeekly = r.kind === "auto" && !r.emphasis;
          return (
            <li key={r.key} className={`cat level-${r.level} ${r.emphasis ? "is-subtotal" : ""}`}>
              <div className="cat-name">
                <span>{r.label}</span>
                {r.kind === "input" && (
                  <button className="btn small" onClick={() => props.onEdit(r)}>
                    <IconEdit size={14} />
                    入力
                  </button>
                )}
                {isWeekly && (
                  <Link className="btn small ghost" to={`/weekly?month=${props.month}`}>
                    週次で入力
                    <IconArrowRight size={14} />
                  </Link>
                )}
              </div>
              <Amounts v={v} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EditModal(props: {
  row: PlRow;
  month: string;
  countryLabel: string;
  onClose: () => void;
  onSave: (v: Triple) => Promise<void>;
}) {
  const [v, setV] = useState<Triple>(props.row.values[props.month] ?? { target: 0, plan: 0, paid: 0 });
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={
        <>
          {props.countryLabel}・{props.row.label}
          <span className="modal-sub">{monthLabel(props.month)}</span>
        </>
      }
      onClose={props.onClose}
      width={440}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await props.onSave(v);
          setBusy(false);
        }}
      >
        <label>
          目標
          <MoneyInput value={v.target} onChange={(x) => setV((s) => ({ ...s, target: x }))} autoFocus label="目標" />
        </label>
        <label>
          予定
          <MoneyInput value={v.plan} onChange={(x) => setV((s) => ({ ...s, plan: x }))} label="予定" />
        </label>
        <label>
          入金済み
          <MoneyInput value={v.paid} onChange={(x) => setV((s) => ({ ...s, paid: x }))} label="入金済み" />
        </label>
        <div className="modal-actions">
          <div className="spacer" />
          <button type="button" className="btn" onClick={props.onClose}>
            キャンセル
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}
