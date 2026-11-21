// 3ページ目：オンライン販売（週次）。国を切り替えて入力する。
//   中国：小红书・淘宝（元）／日本：スタジオハヌル・Lovely MongMong・ふにゅ（円）
// 週の計上月は「その週の木曜日が属する月」。計上月ごとに売上一覧の「オンライン」へ元で反映される。
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Api, COUNTRIES, COUNTRY_LABELS, CURRENCY_LABELS, ONLINE_CHANNELS, type Country, type OnlineView } from "../api";
import { MoneyInput } from "../components/MoneyInput";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";
import { dateLabel, defaultMonth, monthLabel, num } from "../format";

const short = (d: string) => dateLabel(d).replace(/^\d{4}\//, "");

export default function OnlinePage() {
  const [params, setParams] = useSearchParams();
  const country: Country = params.get("country") === "JP" ? "JP" : "CN";
  const [data, setData] = useState<OnlineView | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    Api.getOnline(country).then(setData).catch((e) => toast.error(e.message));
  }, [country, toast]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

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

  // 表示したら今月までスクロール（国を切り替えたときも）
  const scrolledFor = useRef<Country | null>(null);
  useEffect(() => {
    if (!data || data.country !== country || scrolledFor.current === country) return;
    scrolledFor.current = country;
    const m = defaultMonth(data.months);
    if (m !== data.months[0]) document.getElementById(`month-${m}`)?.scrollIntoView({ block: "start" });
  }, [data, country]);

  const channels = ONLINE_CHANNELS[country];
  const unit = CURRENCY_LABELS[country === "JP" ? "JPY" : "CNY"];
  const isJpy = country === "JP";
  const ready = data && data.country === country;

  return (
    <div className="page">
      <PageHeader
        title="オンライン"
        sub={
          <>
            週ごとにオンラインの売上を入力します（中国は元、日本は円）。月をまたぐ週は、木曜日がある月に入ります。売上一覧の「オンライン」へ元で反映されます。
            <span className={`saving ${saving ? "on" : ""}`}>保存中…</span>
          </>
        }
      />
      <div className="toggle country-switch">
        {COUNTRIES.map((c) => (
          <button type="button" key={c} className={country === c ? "on" : ""} onClick={() => setParams(c === "CN" ? {} : { country: c })}>
            {COUNTRY_LABELS[c]}
          </button>
        ))}
      </div>
      {!ready ? (
        <div className="loading">読み込み中…</div>
      ) : (
        <section className="card list-card">
          <div className="list-scroll">
            <table className="list weekly">
              <thead>
                <tr>
                  <th>期間</th>
                  {channels.map((c) => (
                    <th key={c.key} className="num">
                      {c.label}（{unit}）
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
                      {channels.map((c) => (
                        <td key={c.key} className="num">
                          {num(g.subtotal[c.key] ?? 0)}
                          {unit}
                        </td>
                      ))}
                      <td className="num">
                        {num(g.totalCny)}元{isJpy && <small className="orig">（{num(g.total)}円）</small>}
                      </td>
                    </tr>
                    {g.weeks.map((w) => (
                      <tr key={w.weekStart}>
                        <td className="nowrap">
                          {short(w.weekStart)} 〜 {short(w.weekEnd)}
                        </td>
                        {channels.map((c) => (
                          <td key={c.key} className="input-cell">
                            <MoneyInput
                              label={`${short(w.weekStart)}の週 ${c.label}`}
                              unit={unit}
                              value={w.values[c.key] ?? 0}
                              onCommit={(v) => run(Api.saveOnline(country, [{ weekStart: w.weekStart, channel: c.key, value: v }]))}
                            />
                          </td>
                        ))}
                        <td className="num">
                          {num(w.totalCny)}元{isJpy && <small className="orig">（{num(w.total)}円）</small>}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
