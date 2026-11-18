// 3ページ目：中国オンライン販売（週次）。小红书・淘宝に分けて入力する。
// 週の計上月は「その週の木曜日が属する月」で自動判定（手動変更も可）。計上月ごとに売上一覧の「オンライン」へ反映される。
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Api, CHANNELS, type OnlineView } from "../api";
import { MoneyInput } from "../components/MoneyInput";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";
import { dateLabel, defaultMonth, monthLabel, num } from "../format";

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

  return (
    <div className="page">
      <PageHeader
        title="中国オンライン"
        sub={
          <>
            週ごとに小红书・淘宝の売上を元で入力します。月をまたぐ週は、木曜日がある月に入ります。売上一覧の「オンライン」へ反映されます。
            <span className={`saving ${saving ? "on" : ""}`}>保存中…</span>
          </>
        }
      />
      <section className="card list-card">
        <div className="list-scroll">
          <table className="list weekly">
            <thead>
              <tr>
                <th>期間</th>
                {CHANNELS.map((c) => (
                  <th key={c.key} className="num">
                    {c.label}（元）
                  </th>
                ))}
                <th className="num">合計（元）</th>
              </tr>
            </thead>
            <tbody>
              {data.groups.map((g) => (
                <Fragment key={g.month}>
                  <tr className="month-row" id={`month-${g.month}`}>
                    <th>{monthLabel(g.month)}</th>
                    {CHANNELS.map((c) => (
                      <td key={c.key} className="num">
                        {num(g.subtotal[c.key])}元
                      </td>
                    ))}
                    <td className="num">{num(g.total)}元</td>
                  </tr>
                  {g.weeks.map((w) => (
                    <tr key={w.weekStart}>
                      <td className="nowrap">
                        {short(w.weekStart)} 〜 {short(w.weekEnd)}
                      </td>
                      {CHANNELS.map((c) => (
                        <td key={c.key} className="input-cell">
                          <MoneyInput
                            label={`${short(w.weekStart)}の週 ${c.label}`}
                            unit="元"
                            value={w.values[c.key]}
                            onCommit={(v) => run(Api.saveOnline([{ weekStart: w.weekStart, channel: c.key, value: v }]))}
                          />
                        </td>
                      ))}
                      <td className="num">{num(w.total)}元</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
