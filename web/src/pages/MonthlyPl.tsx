import type { CellValueChangedEvent, ColDef, ColGroupDef, GridApi, RowClassParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Api, downloadCsv, type MonthlyPl, type PlRow, type ValueField } from "../api";
import { useToast } from "../components/Toast";
import { yen, monthLabel, parseAmount } from "../format";
import { gridTheme, handlePaste } from "../grid";

const FIELDS: { key: ValueField; label: string }[] = [
  { key: "target", label: "目標" },
  { key: "plan", label: "予定" },
  { key: "paid", label: "入金済み" },
];

type Change = { categoryId: string; month: string; field: ValueField; value: number };

export default function MonthlyPlPage() {
  const [pl, setPl] = useState<MonthlyPl | null>(null);
  const [gridApi, setGridApi] = useState<GridApi<PlRow>>();
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    Api.getMonthlyPl().then(setPl).catch((e) => toast.error(e.message));
  }, [toast]);
  useEffect(load, [load]);

  const save = useCallback(
    async (changes: Change[]) => {
      if (changes.length === 0) return;
      setSaving(true);
      try {
        setPl(await Api.saveMonthlyCells(changes));
      } catch (e) {
        toast.error((e as Error).message);
        load();
      } finally {
        setSaving(false);
      }
    },
    [load, toast],
  );

  const columnDefs = useMemo<(ColDef<PlRow> | ColGroupDef<PlRow>)[]>(() => {
    if (!pl) return [];
    const label: ColDef<PlRow> = {
      headerName: "区分",
      field: "label",
      pinned: "left",
      width: 190,
      cellClass: (p) => `label-cell level-${p.data?.level ?? 0}`,
      suppressMovable: true,
    };
    const months: ColGroupDef<PlRow>[] = pl.months.map((m) => ({
      headerName: monthLabel(m),
      headerClass: "month-header",
      marryChildren: true,
      children: FIELDS.map(
        (f): ColDef<PlRow> => ({
          headerName: f.label,
          colId: `${m}:${f.key}`,
          context: { month: m, field: f.key },
          width: 108,
          type: "rightAligned",
          suppressMovable: true,
          editable: (p) => p.data?.kind === "input",
          valueGetter: (p) => (p.data?.kind === "header" ? null : (p.data?.values[m]?.[f.key] ?? 0)),
          valueFormatter: (p) => (p.data?.kind === "header" ? "" : yen(p.value)),
          valueParser: (p) => parseAmount(p.newValue) ?? p.oldValue,
          valueSetter: (p) => {
            const v = parseAmount(p.newValue);
            if (v === null || !p.data) return false;
            p.data.values[m] = { ...p.data.values[m], [f.key]: v };
            return true;
          },
          cellClass: (p) =>
            [p.data?.kind === "input" ? "cell-input" : "cell-auto", f.key === "paid" ? "col-month-end" : ""].join(" "),
        }),
      ),
    }));
    return [label, ...months];
  }, [pl]);

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent<PlRow>) => {
      const ctx = e.colDef.context as { month: string; field: ValueField };
      if (!e.data.categoryId || e.oldValue === e.newValue) return;
      save([{ categoryId: e.data.categoryId, month: ctx.month, field: ctx.field, value: e.newValue }]);
    },
    [save],
  );

  const onPaste = (e: React.ClipboardEvent) => {
    const changes = handlePaste<PlRow, Change>(e, gridApi, (data, col, value) => {
      const ctx = col.getColDef().context as { month: string; field: ValueField } | undefined;
      if (!ctx || data.kind !== "input" || !data.categoryId) return null;
      return { categoryId: data.categoryId, month: ctx.month, field: ctx.field, value };
    });
    if (changes) save(changes);
  };

  const getRowClass = (p: RowClassParams<PlRow>) => {
    const r = p.data;
    if (!r) return "";
    return [`row-${r.kind}`, r.emphasis ? `row-${r.emphasis}` : ""].join(" ");
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>月次PL</h1>
        <span className="muted">単位：{pl?.settings.currencyLabel ?? "円"}</span>
        <span className="legend">
          <i className="swatch input" />
          入力
          <i className="swatch auto" />
          自動計算
        </span>
        <span className={`saving ${saving ? "on" : ""}`}>保存中…</span>
        <div className="spacer" />
        <button onClick={() => downloadCsv("monthly").catch((e) => toast.error(e.message))}>CSV出力</button>
      </div>
      <p className="hint">
        セルを選んで数字を入力すると保存され、合計がすぐ再計算されます。Excel からの貼り付け（Ctrl+V）にも対応しています。
        「商品販売 オンライン」はオンライン週次の集計です。
      </p>
      <div className="grid-wrap" onPaste={onPaste}>
        {pl ? (
          <AgGridReact<PlRow>
            theme={gridTheme}
            rowData={pl.rows}
            columnDefs={columnDefs}
            getRowId={(p) => p.data.key}
            getRowClass={getRowClass}
            onGridReady={(e) => setGridApi(e.api)}
            onCellValueChanged={onCellValueChanged}
            singleClickEdit={false}
            enterNavigatesVerticallyAfterEdit
            stopEditingWhenCellsLoseFocus
            suppressColumnVirtualisation={false}
            defaultColDef={{ sortable: false, resizable: true }}
          />
        ) : (
          <div className="loading">読み込み中…</div>
        )}
      </div>
    </div>
  );
}
