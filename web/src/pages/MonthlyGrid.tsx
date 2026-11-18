// 月次PLの「表で編集」ビュー（全期間を一覧で見て、まとめて入力・Excel から貼り付けしたいとき用）
import type { CellValueChangedEvent, ColDef, ColGroupDef, GridApi, RowClassParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useMemo, useState } from "react";
import type { MonthlyPl, PlRow, ValueField } from "../api";
import { monthLabel, parseAmount, yen } from "../format";
import { gridTheme, handlePaste } from "../grid";

const FIELDS: { key: ValueField; label: string }[] = [
  { key: "target", label: "目標" },
  { key: "plan", label: "予定" },
  { key: "paid", label: "入金済み" },
];

export type MonthlyChange = { categoryId: string; month: string; field: ValueField; value: number };

export default function MonthlyGrid(props: { pl: MonthlyPl; save: (changes: MonthlyChange[]) => void }) {
  const { pl, save } = props;
  const [gridApi, setGridApi] = useState<GridApi<PlRow>>();

  const columnDefs = useMemo<(ColDef<PlRow> | ColGroupDef<PlRow>)[]>(() => {
    const label: ColDef<PlRow> = {
      headerName: "区分",
      field: "label",
      pinned: "left",
      width: 180,
      cellClass: (p) => `label-cell level-${p.data?.level ?? 0}`,
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
  }, [pl.months]);

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent<PlRow>) => {
      const ctx = e.colDef.context as { month: string; field: ValueField };
      if (!e.data.categoryId || e.oldValue === e.newValue) return;
      save([{ categoryId: e.data.categoryId, month: ctx.month, field: ctx.field, value: e.newValue }]);
    },
    [save],
  );

  const onPaste = (e: React.ClipboardEvent) => {
    const changes = handlePaste<PlRow, MonthlyChange>(e, gridApi, (data, col, value) => {
      const ctx = col.getColDef().context as { month: string; field: ValueField } | undefined;
      if (!ctx || data.kind !== "input" || !data.categoryId) return null;
      return { categoryId: data.categoryId, month: ctx.month, field: ctx.field, value };
    });
    if (changes?.length) save(changes);
  };

  const getRowClass = (p: RowClassParams<PlRow>) => {
    const r = p.data;
    if (!r) return "";
    return [`row-${r.kind}`, r.emphasis ? `row-${r.emphasis}` : ""].join(" ");
  };

  return (
    <div className="grid-card" onPaste={onPaste}>
      <AgGridReact<PlRow>
        theme={gridTheme}
        rowData={pl.rows}
        columnDefs={columnDefs}
        getRowId={(p) => p.data.key}
        getRowClass={getRowClass}
        onGridReady={(e) => setGridApi(e.api)}
        onCellValueChanged={onCellValueChanged}
        enterNavigatesVerticallyAfterEdit
        stopEditingWhenCellsLoseFocus
        defaultColDef={{ sortable: false, resizable: true, suppressMovable: true }}
      />
    </div>
  );
}
