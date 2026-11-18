import type { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Api,
  COUNTRY_LABELS,
  DEAL_STATUSES,
  DEFAULT_MASTERS,
  downloadCsv,
  type Country,
  type Deal,
  type DealInput,
  type Masters,
} from "../api";
import { IconDownload, IconPlus, IconSearch } from "../components/Icons";
import { Segmented, loadPref, savePref } from "../components/Segmented";
import { useToast } from "../components/Toast";
import { yen } from "../format";
import { gridTheme } from "../grid";

const EMPTY: DealInput = {
  country: "JP",
  character: "",
  licensee: "",
  title: "",
  productCategory: "",
  contractType: "",
  status: "提案中",
  startDate: null,
  endDate: null,
  royaltyRate: null,
  amount: null,
  owner: "",
  note: "",
};

const COUNTRIES = Object.keys(COUNTRY_LABELS) as Country[];

/** 複数選択の絞り込みチップ */
function FilterChips<T extends string>(props: {
  label: string;
  options: T[];
  selected: Set<T>;
  onChange: (s: Set<T>) => void;
  render?: (v: T) => string;
}) {
  const toggle = (v: T) => {
    const s = new Set(props.selected);
    if (s.has(v)) s.delete(v);
    else s.add(v);
    props.onChange(s);
  };
  return (
    <div className="chips">
      <span className="chips-label">{props.label}</span>
      {props.options.map((o) => (
        <button key={o} className={`chip ${props.selected.has(o) ? "on" : ""}`} onClick={() => toggle(o)}>
          {props.render ? props.render(o) : o}
        </button>
      ))}
    </div>
  );
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [masters, setMasters] = useState<Masters>(DEFAULT_MASTERS);
  const [editing, setEditing] = useState<{ id?: string; no?: number; input: DealInput } | null>(null);
  const [fCountry, setFCountry] = useState(new Set<Country>());
  const [fChar, setFChar] = useState(new Set<string>());
  const [fStatus, setFStatus] = useState(new Set<string>());
  const [q, setQ] = useState("");
  const [view, setView] = useState<"cards" | "table">(loadPref("deals.view", "cards"));
  const toast = useToast();

  const load = useCallback(() => {
    Api.listDeals().then(setDeals).catch((e) => toast.error(e.message));
  }, [toast]);
  useEffect(() => {
    load();
    Api.getSettings()
      .then((r) => setMasters(r.masters))
      .catch(() => undefined);
  }, [load]);

  const characters = useMemo(() => {
    const s = new Set(masters.characters);
    deals?.forEach((d) => d.character && s.add(d.character));
    return [...s];
  }, [masters, deals]);

  const filtered = useMemo(
    () =>
      (deals ?? []).filter(
        (d) =>
          (fCountry.size === 0 || fCountry.has(d.country)) &&
          (fChar.size === 0 || fChar.has(d.character)) &&
          (fStatus.size === 0 || fStatus.has(d.status)) &&
          (q.trim() === "" ||
            [d.licensee, d.title, d.character, d.productCategory, d.contractType, d.owner, d.note]
              .join(" ")
              .toLowerCase()
              .includes(q.trim().toLowerCase())),
      ),
    [deals, fCountry, fChar, fStatus, q],
  );

  const columnDefs = useMemo<ColDef<Deal>[]>(
    () => [
      { headerName: "No", field: "no", width: 70, pinned: "left", type: "rightAligned", sort: "asc" },
      { headerName: "国", field: "country", width: 70, valueFormatter: (p) => COUNTRY_LABELS[p.value as Country] },
      { headerName: "キャラクター", field: "character", width: 150 },
      { headerName: "ライセンシー", field: "licensee", width: 170 },
      { headerName: "案件名・内容", field: "title", width: 200 },
      { headerName: "商品カテゴリ", field: "productCategory", width: 120 },
      { headerName: "契約形態", field: "contractType", width: 130 },
      {
        headerName: "ステータス",
        field: "status",
        width: 100,
        comparator: (a, b) => DEAL_STATUSES.indexOf(a) - DEAL_STATUSES.indexOf(b),
        cellRenderer: (p: { value: string }) => <span className={`status status-${DEAL_STATUSES.indexOf(p.value as never)}`}>{p.value}</span>,
      },
      { headerName: "契約開始日", field: "startDate", width: 115 },
      { headerName: "契約終了日", field: "endDate", width: 115 },
      {
        headerName: "ロイヤリティ率",
        field: "royaltyRate",
        width: 115,
        type: "rightAligned",
        valueFormatter: (p) => (p.value === null || p.value === undefined ? "" : `${p.value}%`),
      },
      {
        headerName: "MG・契約金額",
        field: "amount",
        width: 130,
        type: "rightAligned",
        valueFormatter: (p) => (p.value === null || p.value === undefined ? "" : yen(p.value)),
      },
      { headerName: "担当", field: "owner", width: 90 },
      { headerName: "備考", field: "note", width: 240, tooltipField: "note" },
    ],
    [],
  );

  const openDeal = (d: Deal) => {
    const { id, no, createdAt: _c, updatedAt: _u, ...input } = d;
    setEditing({ id, no, input });
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>ライセンス案件</h1>
          <p className="sub">
            {filtered.length === (deals?.length ?? 0) ? `${filtered.length}件` : `${filtered.length}件 / 全${deals?.length ?? 0}件`}
          </p>
        </div>
        <div className="head-actions">
          <Segmented<"cards" | "table">
            value={view}
            options={[
              { value: "cards", label: "カード" },
              { value: "table", label: "一覧表" },
            ]}
            onChange={(v) => {
              setView(v);
              savePref("deals.view", v);
            }}
          />
          <button className="btn ghost" onClick={() => downloadCsv("deals").catch((e) => toast.error(e.message))}>
            <IconDownload size={16} />
            CSV
          </button>
          <button className="btn primary" onClick={() => setEditing({ input: { ...EMPTY } })}>
            <IconPlus size={16} />
            案件を追加
          </button>
        </div>
      </header>

      <section className="card filter-card">
        <div className="search">
          <IconSearch size={16} />
          <input placeholder="ライセンシー・案件名・担当などで検索" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="filters">
          <FilterChips label="国" options={COUNTRIES} selected={fCountry} onChange={setFCountry} render={(c) => COUNTRY_LABELS[c]} />
          <FilterChips label="キャラクター" options={characters} selected={fChar} onChange={setFChar} />
          <FilterChips label="ステータス" options={[...DEAL_STATUSES]} selected={fStatus} onChange={setFStatus} />
        </div>
      </section>

      {!deals ? (
        <div className="loading">読み込み中…</div>
      ) : view === "table" ? (
        <div className="grid-card">
          <AgGridReact<Deal>
            theme={gridTheme}
            rowData={filtered}
            columnDefs={columnDefs}
            getRowId={(p) => p.data.id}
            onRowClicked={(e) => e.data && openDeal(e.data)}
            rowClass="clickable"
            defaultColDef={{ sortable: true, resizable: true }}
            tooltipShowDelay={300}
          />
        </div>
      ) : filtered.length === 0 ? (
        <p className="empty">条件に合う案件はありません。</p>
      ) : (
        <div className="deal-grid">
          {[...filtered]
            .sort((a, b) => b.no - a.no)
            .map((d) => (
              <DealCard key={d.id} d={d} onClick={() => openDeal(d)} />
            ))}
        </div>
      )}

      {editing && (
        <DealForm
          initial={editing}
          masters={{ ...masters, characters }}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function DealCard({ d, onClick }: { d: Deal; onClick: () => void }) {
  const period = d.startDate || d.endDate ? `${d.startDate ?? "?"} 〜 ${d.endDate ?? "?"}` : null;
  return (
    <button className="card deal-card" onClick={onClick}>
      <div className="deal-top">
        <span className={`status status-${DEAL_STATUSES.indexOf(d.status)}`}>{d.status}</span>
        <span className="deal-no">
          No.{d.no}・{COUNTRY_LABELS[d.country]}
        </span>
      </div>
      <div className="deal-licensee">{d.licensee || "（ライセンシー未入力）"}</div>
      <div className="deal-title">{d.title || "—"}</div>
      <div className="deal-tags">
        {d.character && <span className="tag">{d.character}</span>}
        {d.contractType && <span className="tag">{d.contractType}</span>}
        {d.productCategory && <span className="tag">{d.productCategory}</span>}
      </div>
      <dl className="deal-meta">
        <div>
          <dt>MG・契約金額</dt>
          <dd>{d.amount === null ? "—" : `¥${yen(d.amount)}`}</dd>
        </div>
        <div>
          <dt>ロイヤリティ</dt>
          <dd>{d.royaltyRate === null ? "—" : `${d.royaltyRate}%`}</dd>
        </div>
        <div>
          <dt>担当</dt>
          <dd>{d.owner || "—"}</dd>
        </div>
      </dl>
      {period && <div className="deal-period">契約期間 {period}</div>}
    </button>
  );
}

function DealForm(props: {
  initial: { id?: string; no?: number; input: DealInput };
  masters: Masters;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState<DealInput>(props.initial.input);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = <K extends keyof DealInput>(k: K, v: DealInput[K]) => setD((x) => ({ ...x, [k]: v }));
  const isNew = !props.initial.id;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await Api.saveDeal(d, props.initial.id);
      toast.info(isNew ? "追加しました" : "保存しました");
      props.onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!props.initial.id || !confirm(`No.${props.initial.no} を削除します。よろしいですか？`)) return;
    setBusy(true);
    try {
      await Api.deleteDeal(props.initial.id);
      toast.info("削除しました");
      props.onSaved();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <form className="modal" onSubmit={save}>
        <h2>{isNew ? "案件を追加" : `案件を編集（No.${props.initial.no}）`}</h2>
        <div className="form-grid">
          <label>
            国 *
            <select value={d.country} onChange={(e) => set("country", e.target.value as Country)}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            ステータス *
            <select value={d.status} onChange={(e) => set("status", e.target.value as DealInput["status"])}>
              {DEAL_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            キャラクター
            <input list="dl-characters" value={d.character} onChange={(e) => set("character", e.target.value)} placeholder="選択または入力" />
            <datalist id="dl-characters">
              {props.masters.characters.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            契約形態
            <input list="dl-contract" value={d.contractType} onChange={(e) => set("contractType", e.target.value)} placeholder="選択または入力" />
            <datalist id="dl-contract">
              {props.masters.contractTypes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            ライセンシー
            <input value={d.licensee} onChange={(e) => set("licensee", e.target.value)} />
          </label>
          <label>
            商品カテゴリ
            <input value={d.productCategory} onChange={(e) => set("productCategory", e.target.value)} />
          </label>
          <label className="wide">
            案件名・内容
            <input value={d.title} onChange={(e) => set("title", e.target.value)} />
          </label>
          <label>
            契約開始日
            <input type="date" value={d.startDate ?? ""} onChange={(e) => set("startDate", e.target.value || null)} />
          </label>
          <label>
            契約終了日
            <input type="date" value={d.endDate ?? ""} onChange={(e) => set("endDate", e.target.value || null)} />
          </label>
          <label>
            ロイヤリティ率（%）
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={d.royaltyRate ?? ""}
              onChange={(e) => set("royaltyRate", e.target.value === "" ? null : Number(e.target.value))}
            />
          </label>
          <label>
            MG・契約金額（円）
            <input
              inputMode="numeric"
              value={d.amount === null ? "" : d.amount.toLocaleString("ja-JP")}
              onChange={(e) => {
                const raw = e.target.value.replace(/[,，\s]/g, "");
                if (raw === "") set("amount", null);
                else if (/^-?\d*$/.test(raw) && raw !== "-") set("amount", Number(raw));
              }}
            />
          </label>
          <label>
            担当
            <input value={d.owner} onChange={(e) => set("owner", e.target.value)} />
          </label>
          <label className="wide">
            備考
            <textarea rows={4} value={d.note} onChange={(e) => set("note", e.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          {!isNew && (
            <button type="button" className="btn danger" onClick={remove} disabled={busy}>
              削除
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="btn" onClick={props.onClose} disabled={busy}>
            キャンセル
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {isNew ? "追加" : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}
