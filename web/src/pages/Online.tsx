// 3ページ目：中国オンライン販売（週次）。小红书・淘宝に分けて入力する。
// 週の計上月は「その週の木曜日が属する月」で自動判定（手動変更も可）。計上月ごとに売上一覧の「オンライン」へ反映される。
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Api, CHANNELS, downloadCsv, type OnlineView } from "../api";
import { IconDownload } from "../components/Icons";
import { MoneyInput } from "../components/MoneyInput";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";
import { dateLabel, defaultMonth, monthLabel, yen } from "../format";

const short = (d: string) => dateLabel(d).replace(/^\d{4}\//, "");

export default function OnlinePage() {
  const [data, setData] = useState<OnlineView | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    Api.getOnline().then(setData).catch((e) => toast.error(e.message));
  }, [toast]);
  useEffect(load, [load]);

  const run = async (p: Promise<OnlineView>) => {
    setSaving(true);
    try {
      setData(await p);
    } catch (e) {
      toast.error((e as Error).message);
      load();
    } finally {
      setSaving(false);
    }
  };

  // 初回表示で今月までスクロール
  const scrolled = useRef(false);
  useEffect(() => {
    if (!data || scrolled.current) return;
    scrolled.current = true;
    const m = defaultMonth(data.months);
    if (m !== data.months[0]) document.getElementById(`month-${m}`)?.scrollIntoView({ block: "start" });
  }, [data]);

  if (!data) return <div className="page loading">読み込み中…</div>;
  const cols = 3 + CHANNELS.length + 1;

  return (
    <div className="page">
      <PageHeader
        title="中国オンライン"
        sub={
          <>
            週ごとに小红书・淘宝の売上を入力します。週の計上月はその週の木曜日がある月です（変更可）。売上一覧の「オンライン」へ反映されます。
            <span className={`saving ${saving ? "on" : ""}`}>保存中…</span>
          </>
        }
        actions={
          <button className="btn ghost" onClick={() => downloadCsv("online").catch((e) => toast.error(e.message))}>
            <IconDownload size={16} />
            CSV
          </button>
        }
      />
      <section className="card list-card">
        <div className="list-scroll">
          <table className="list weekly">
            <thead>
              <tr>
                <th>週</th>
                <th>期間</th>
                <th>計上月</th>
                {CHANNELS.map((c) => (
                  <th key={c.key} className="num">
                    {c.label}
                  </th>
                ))}
                <th className="num">合計</th>
              </tr>
            </thead>
            <tbody>
              {data.groups.map((g) => (
                <Fragment key={g.month}>
                  <tr className="month-row" id={`month-${g.month}`}>
                    <th colSpan={cols}>{monthLabel(g.month)}</th>
                  </tr>
                  {g.weeks.map((w) => (
                    <tr key={w.weekStart}>
                      <td className="nowrap muted">第{w.no}週</td>
                      <td className="nowrap">
                        {short(w.weekStart)} 〜 {short(w.weekEnd)}
                      </td>
                      <td>
                        <select
                          className={`month-select ${w.overrideMonth ? "overridden" : ""}`}
                          value={w.overrideMonth ?? ""}
                          onChange={(e) => run(Api.setWeekBookingMonth(w.weekStart, e.target.value || null))}
                          aria-label={`第${w.no}週の計上月`}
                        >
                          <option value="">{monthLabel(w.autoMonth)}（自動）</option>
                          {data.months
                            .filter((m) => m !== w.autoMonth)
                            .map((m) => (
                              <option key={m} value={m}>
                                {monthLabel(m)}
                              </option>
                            ))}
                        </select>
                      </td>
                      {CHANNELS.map((c) => (
                        <td key={c.key} className="input-cell">
                          <MoneyInput
                            label={`第${w.no}週 ${c.label}`}
                            value={w.values[c.key]}
                            onCommit={(v) => run(Api.saveOnline([{ weekStart: w.weekStart, channel: c.key, value: v }]))}
                          />
                        </td>
                      ))}
                      <td className="num">{yen(w.total)}</td>
                    </tr>
                  ))}
                  <tr className="subtotal-row">
                    <td colSpan={3}>{monthLabel(g.month)} 計</td>
                    {CHANNELS.map((c) => (
                      <td key={c.key} className="num">
                        {yen(g.subtotal[c.key])}
                      </td>
                    ))}
                    <td className="num">{yen(g.total)}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
