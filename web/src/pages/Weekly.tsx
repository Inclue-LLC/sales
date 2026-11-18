import type { CellValueChangedEvent, ColDef, ColGroupDef, GridApi } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Api, downloadCsv, COUNTRY_LABELS, type Triple, type ValueField, type WeeklyView } from "../api";
import { useToast } from "../components/Toast";
import { dateLabel, monthLabel, parseAmount, yen } from "../format";
import { gridTheme, handlePaste } from "../grid";

const FIELDS: { key: ValueField; label: string }[] = [
  { key: "target", label: "目標" },
  { key: "plan", label: "予定" },
  { key: "paid", label: "入金済み" },
];
const AUTO = "auto";

interface Row {
  key: string;
  kind: "week" | "subtotal";
  no?: number;
  weekStart?: string;
  weekEnd?: string;
  autoMonth?: string;
  overrideMonth?: string | null;
  bookingMonth: string;
  values: Record<string, Triple>;
  total: Triple;
}

type Change = { weekStart: string; categoryId: string; field: ValueField; value: number };

function toRows(v: WeeklyView): Row[] {
  const rows: Row[] = [];
  for (const g of v.groups) {
    for (const w of g.weeks) rows.push({ ...w, key: w.weekStart, kind: "week" });
    rows.push({
      key: `sub-${g.month}`,
      kind: "subtotal",
      bookingMonth: g.month,
      values: g.subtotal.values,
      total: g.subtotal.total,
    });
  }
  return rows;
}

export default function WeeklyPage() {
  const [view, setView] = useState<WeeklyView | null>(null);
  const [gridApi, setGridApi] = useState<GridApi<Row>>();
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    Api.getWeekly().then(setView).catch((e) => toast.error(e.message));
  }, [toast]);
  useEffect(load, [load]);

  const run = useCallback(
    async (p: Promise<WeeklyView>) => {
      setSaving(true);
      try {
        setView(await p);
      } catch (e) {
        toast.error((e as Error).message);
        load();
      } finally {
        setSaving(false);
      }
    },
    [load, toast],
  );

  const rows = useMemo(() => (view ? toRows(view) : []), [view]);

  const columnDefs = useMemo<(ColDef<Row> | ColGroupDef<Row>)[]>(() => {
    if (!view) return [];
    const isWeek = (r?: Row) => r?.kind === "week";
    const fixed: ColDef<Row>[] = [
      {
        headerName: "週",
        field: "no",
        pinned: "left",
        width: 60,
        valueFormatter: (p) => (isWeek(p.data) ? `第${p.value}週` : ""),
      },
      {
        headerName: "週開始日（月）",
        field: "weekStart",
        pinned: "left",
        width: 128,
        valueFormatter: (p) => (p.value ? dateLabel(p.value) : "小計"),
        cellClass: (p) => (isWeek(p.data) ? "" : "label-cell"),
      },
      {
        headerName: "週終了日（日）",
        field: "weekEnd",
        width: 128,
        valueFormatter: (p) => (p.value ? dateLabel(p.value) : ""),
      },
      {
        headerName: "計上月",
        colId: "bookingMonth",
        width: 150,
        editable: (p) => isWeek(p.data),
        valueGetter: (p) => (isWeek(p.data) ? (p.data!.overrideMonth ?? AUTO) : p.data?.bookingMonth),
        valueFormatter: (p) => {
          const r = p.data;
          // プルダウンの選択肢を表示するときは行データが無い
          if (!r) return p.value === AUTO ? "自動判定" : monthLabel(String(p.value));
          if (!isWeek(r)) return monthLabel(r.bookingMonth);
          return r.overrideMonth ? `${monthLabel(r.overrideMonth)}（手動）` : `${monthLabel(r.autoMonth!)}（自動）`;
        },
        valueSetter: (p) => {
          if (!p.data || p.newValue === p.oldValue) return false;
          p.data.overrideMonth = p.newValue === AUTO ? null : p.newValue;
          return true;
        },
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: [AUTO, ...view.months] },
        cellClass: (p) => (isWeek(p.data) ? (p.data!.overrideMonth ? "cell-input overridden" : "cell-input") : ""),
      },
    ];

    const amountCol = (
      id: string,
      f: ValueField,
      get: (r: Row) => number,
      editable: boolean,
      last: boolean,
    ): ColDef<Row> => ({
      headerName: FIELDS.find((x) => x.key === f)!.label,
      colId: `${id}:${f}`,
      context: editable ? { categoryId: id, field: f } : undefined,
      width: 108,
      type: "rightAligned",
      editable: (p) => editable && isWeek(p.data),
      valueGetter: (p) => (p.data ? get(p.data) : 0),
      valueFormatter: (p) => yen(p.value),
      valueParser: (p) => parseAmount(p.newValue) ?? p.oldValue,
      valueSetter: (p) => {
        const v = parseAmount(p.newValue);
        if (v === null || !p.data) return false;
        p.data.values[id] = { ...p.data.values[id], [f]: v };
        return true;
      },
      cellClass: (p) =>
        [editable && isWeek(p.data) ? "cell-input" : "cell-auto", last ? "col-month-end" : ""].join(" "),
    });

    const countryGroups: ColGroupDef<Row>[] = view.categories.map((c) => ({
      headerName: COUNTRY_LABELS[c.country],
      headerClass: "month-header",
      children: FIELDS.map((f, i) => amountCol(c.id, f.key, (r) => r.values[c.id]?.[f.key] ?? 0, true, i === 2)),
    }));
    const total: ColGroupDef<Row> = {
      headerName: "合計",
      headerClass: "month-header",
      children: FIELDS.map((f, i) => amountCol("total", f.key, (r) => r.total[f.key], false, i === 2)),
    };
    return [...fixed, ...countryGroups, total];
  }, [view]);

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent<Row>) => {
      if (!e.data.weekStart || e.oldValue === e.newValue) return;
      if (e.colDef.colId === "bookingMonth") {
        run(Api.setWeekBookingMonth(e.data.weekStart, e.newValue === AUTO ? null : e.newValue));
        return;
      }
      const ctx = e.colDef.context as { categoryId: string; field: ValueField } | undefined;
      if (!ctx) return;
      run(
        Api.saveWeeklyCells([{ weekStart: e.data.weekStart, categoryId: ctx.categoryId, field: ctx.field, value: e.newValue }]),
      );
    },
    [run],
  );

  const onPaste = (e: React.ClipboardEvent) => {
    const changes = handlePaste<Row, Change>(e, gridApi, (data, col, value) => {
      const ctx = col.getColDef().context as { categoryId: string; field: ValueField } | undefined;
      if (!ctx || data.kind !== "week" || !data.weekStart) return null;
      return { weekStart: data.weekStart, categoryId: ctx.categoryId, field: ctx.field, value };
    });
    if (changes && changes.length) run(Api.saveWeeklyCells(changes));
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>オンライン週次</h1>
        <span className="muted">単位：{view?.settings.currencyLabel ?? "円"}</span>
        <span className="legend">
          <i className="swatch input" />
          入力
          <i className="swatch auto" />
          自動計算
        </span>
        <span className={`saving ${saving ? "on" : ""}`}>保存中…</span>
        <div className="spacer" />
        <button onClick={() => downloadCsv("weekly").catch((e) => toast.error(e.message))}>CSV出力</button>
      </div>
      <p className="hint">
        計上月は「週の木曜日が属する月」で自動判定されます。計上月セルをダブルクリックすると変更できます。
        ここで入力した値は計上月ごとに月次PLの「商品販売 オンライン」へ集計されます。
      </p>
      <div className="grid-wrap" onPaste={onPaste}>
        {view ? (
          <AgGridReact<Row>
            theme={gridTheme}
            rowData={rows}
            columnDefs={columnDefs}
            getRowId={(p) => p.data.key}
            getRowClass={(p) => (p.data?.kind === "subtotal" ? "row-auto row-subtotal row-month-end" : "")}
            onGridReady={(e) => setGridApi(e.api)}
            onCellValueChanged={onCellValueChanged}
            enterNavigatesVerticallyAfterEdit
            stopEditingWhenCellsLoseFocus
            defaultColDef={{ sortable: false, resizable: true, suppressMovable: true }}
          />
        ) : (
          <div className="loading">読み込み中…</div>
        )}
      </div>
    </div>
  );
}
