// ライセンス／オフライン／その他 の共通ページ。上に入力フォーム、下に一覧。
// 入力した金額は計上月ごとに 1ページ目（売上一覧）へ自動で反映される。
import { useCallback, useEffect, useMemo, useState } from "react";
import { listMonths } from "../../../functions/src/domain/period";
import { Api, COUNTRIES, COUNTRY_LABELS, CURRENCY_LABELS, INVOICE_APP_URL, currencyOf, type Country, type Entry, type EntryInput, type EntryKind, type Settings } from "../api";
import { MoneyInput } from "../components/MoneyInput";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";
import { defaultMonth, monthLabel, num } from "../format";

export type FieldDef =
  | { key: "character"; label: string; kind: "character" }
  | { key: "type"; label: string; kind: "choice"; options: readonly string[] }
  | { key: "licensee" | "company" | "venue" | "content"; label: string; kind: "text"; placeholder?: string; wide?: boolean };

export interface EntryPageConfig {
  kind: EntryKind;
  title: string;
  description: string;
  fields: FieldDef[];
}

type Draft = { country: Country; month: string; amount: number } & Partial<Record<"licensee" | "company" | "character" | "type" | "venue" | "content", string>>;

export default function EntryPage({ config }: { config: EntryPageConfig }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fCountry, setFCountry] = useState<Country | "">("");
  const [fMonth, setFMonth] = useState("");
  const toast = useToast();

  const months = useMemo(() => (settings ? listMonths(settings.startMonth, settings.endMonth) : []), [settings]);

  const emptyDraft = useCallback(
    (prev?: Draft | null): Draft => {
      const d: Draft = { country: prev?.country ?? "CN", month: prev?.month ?? defaultMonth(months), amount: 0 };
      for (const f of config.fields) d[f.key] = f.kind === "choice" ? (prev?.[f.key] ?? f.options[0]) : f.kind === "character" ? (prev?.[f.key] ?? "") : "";
      return d;
    },
    [config.fields, months],
  );

  const load = useCallback(() => {
    Api.listEntries(config.kind).then(setEntries).catch((e) => toast.error(e.message));
  }, [config.kind, toast]);

  useEffect(() => {
    setEntries(null);
    setEditingId(null);
    setDraft(null);
    setFCountry("");
    setFMonth("");
    load();
    Api.getSettings().then(setSettings).catch((e) => toast.error(e.message));
  }, [load, toast]);

  useEffect(() => {
    if (months.length && !draft) setDraft(emptyDraft());
  }, [months, draft, emptyDraft]);

  const filtered = useMemo(
    () => (entries ?? []).filter((e) => (!fCountry || e.country === fCountry) && (!fMonth || e.month === fMonth)),
    [entries, fCountry, fMonth],
  );
  const filteredTotal = filtered.reduce((a, e) => a + e.amountCny, 0);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      await Api.saveEntry(config.kind, draft as EntryInput, editingId ?? undefined);
      toast.info(editingId ? "更新しました" : "追加しました");
      setEditingId(null);
      setDraft(emptyDraft(draft)); // 国・計上月・種別は続けて入力しやすいよう残す
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (e: Entry) => {
    setEditingId(e.id);
    const d: Draft = { country: e.country, month: e.month, amount: e.amount };
    for (const f of config.fields) d[f.key] = e[f.key] ?? "";
    setDraft(d);
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (e: Entry) => {
    if (!confirm("このデータを削除します。よろしいですか？")) return;
    try {
      await Api.deleteEntry(e.id);
      toast.info("削除しました");
      if (editingId === e.id) {
        setEditingId(null);
        setDraft(emptyDraft(draft));
      }
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (!settings || !draft) return <div className="page loading">読み込み中…</div>;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="page">
      <PageHeader title={config.title} sub={config.description} />

      <form className={`card entry-form ${editingId ? "is-editing" : ""}`} onSubmit={submit}>
        <h2>{editingId ? "編集中" : "新しく追加"}</h2>
        <div className="entry-fields">
          <label>
            国
            <div className="toggle">
              {COUNTRIES.map((c) => (
                <button type="button" key={c} className={draft.country === c ? "on" : ""} onClick={() => set("country", c)}>
                  {COUNTRY_LABELS[c]}
                </button>
              ))}
            </div>
          </label>
          {config.fields.map((f) => (
            <label key={f.key} className={f.kind === "text" && f.wide ? "wide" : ""}>
              {f.label}
              {f.kind === "character" && (
                <CharacterSelect options={settings.characters} value={draft.character ?? ""} onChange={(v) => set("character", v)} />
              )}
              {f.kind === "choice" && (
                <div className="toggle">
                  {f.options.map((o) => (
                    <button type="button" key={o} className={draft.type === o ? "on" : ""} onClick={() => set("type", o)}>
                      {o}
                    </button>
                  ))}
                </div>
              )}
              {f.kind === "text" && (
                <input required value={draft[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
              )}
            </label>
          ))}
          <label>
            金額（{CURRENCY_LABELS[currencyOf(draft.country)]}）
            <MoneyInput value={draft.amount} onChange={(v) => set("amount", v)} label="金額" unit={CURRENCY_LABELS[currencyOf(draft.country)]} />
          </label>
          <label>
            計上月
            <select value={draft.month} onChange={(e) => set("month", e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-actions">
          {editingId && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditingId(null);
                setDraft(emptyDraft(draft));
              }}
            >
              キャンセル
            </button>
          )}
          <button type="submit" className="btn primary" disabled={busy}>
            {editingId ? "更新する" : "追加する"}
          </button>
        </div>
      </form>

      <section className="card list-card">
        <div className="list-head">
          <h2>一覧</h2>
          <div className="filters">
            <select value={fCountry} onChange={(e) => setFCountry(e.target.value as Country | "")} aria-label="国で絞り込み">
              <option value="">すべての国</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_LABELS[c]}
                </option>
              ))}
            </select>
            <select value={fMonth} onChange={(e) => setFMonth(e.target.value)} aria-label="計上月で絞り込み">
              <option value="">すべての月</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!entries ? (
          <div className="loading">読み込み中…</div>
        ) : filtered.length === 0 ? (
          <p className="empty">まだデータがありません。</p>
        ) : (
          <div className="list-scroll">
            <table className="list">
              <thead>
                <tr>
                  <th>計上月</th>
                  <th>国</th>
                  {config.fields.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                  <th className="num">金額（元）</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className={`${editingId === e.id ? "editing" : ""} ${e.source === "invoice" ? "from-invoice" : ""}`}>
                    <td className="nowrap">
                      {monthLabel(e.month)}
                      {e.source === "invoice" && <small className="orig">支払期限の月</small>}
                    </td>
                    <td>
                      <span className={`flag flag-${e.country}`}>{COUNTRY_LABELS[e.country]}</span>
                    </td>
                    {config.fields.map((f, i) => (
                      <td key={f.key}>
                        {f.kind === "choice" ? <span className="tag">{e[f.key]}</span> : e[f.key]}
                        {i === 0 && e.source === "invoice" && (
                          <small className="orig">
                            <span className="invoice-badge">請求書</span>
                            {e.invoiceNumber}
                            {!e.licensee && !e.company && `・${e.clientName}`}
                          </small>
                        )}
                      </td>
                    ))}
                    <td className="num">
                      {num(e.amountCny)}元
                      {e.currency === "JPY" && <small className="orig">（{num(e.amount)}円）</small>}
                    </td>
                    <td className="row-actions">
                      {e.source === "invoice" ? (
                        <a
                          className="btn small"
                          href={`${INVOICE_APP_URL}/invoices/${e.invoiceId}`}
                          target="_blank"
                          rel="noreferrer"
                          title="請求書から反映された売上は、請求書ツールで編集します"
                        >
                          請求書を開く ↗
                        </a>
                      ) : (
                        <>
                          <button className="btn small" onClick={() => startEdit(e)}>
                            編集
                          </button>
                          <button className="btn small danger" onClick={() => remove(e)}>
                            削除
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2 + config.fields.length}>合計（{filtered.length}件）</td>
                  <td className="num">{num(filteredTotal)}元</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const NEW = "__new__";

/**
 * キャラクターの選択。候補から選ぶか「その他（直接入力）」で自由に入力する。
 * いつでも別の候補に選び直せる。
 */
function CharacterSelect(props: { options: string[]; value: string; onChange: (v: string) => void }) {
  const inList = props.value === "" || props.options.includes(props.value);
  const [custom, setCustom] = useState(!inList);
  useEffect(() => {
    if (!inList) setCustom(true);
  }, [inList]);

  return (
    <div className="character-select">
      <select
        required={!custom}
        value={custom ? NEW : props.value}
        onChange={(e) => {
          if (e.target.value === NEW) {
            setCustom(true);
            props.onChange("");
          } else {
            setCustom(false);
            props.onChange(e.target.value);
          }
        }}
      >
        <option value="" disabled>
          選択してください
        </option>
        {props.options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={NEW}>その他（直接入力）</option>
      </select>
      {custom && (
        <input required autoFocus placeholder="キャラクター名を入力" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      )}
    </div>
  );
}
