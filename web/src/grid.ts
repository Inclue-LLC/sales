import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type Column,
  type GridApi,
} from "ag-grid-community";
import { parseAmount } from "./format";

ModuleRegistry.registerModules([AllCommunityModule]);

export const gridTheme = themeQuartz.withParams({
  fontFamily: "inherit",
  fontSize: 13,
  headerFontSize: 12,
  rowHeight: 32,
  headerHeight: 32,
  spacing: 6,
  cellHorizontalPadding: 8,
  borderColor: "#d9dee5",
  headerBackgroundColor: "#f1f4f8",
  columnBorder: true,
  wrapperBorderRadius: 6,
});

/**
 * Excel からのコピー＆貼り付け（タブ区切り）。
 * フォーカス中のセルを左上として、編集可能なセルにだけ値を入れる。
 * AG Grid Community には範囲貼り付けがないため自前で実装している。
 */
export function handlePaste<TData, TChange>(
  e: React.ClipboardEvent,
  api: GridApi<TData> | undefined,
  toChange: (data: TData, column: Column, value: number) => TChange | null,
): TChange[] | null {
  if (!api) return null;
  if (api.getEditingCells().length > 0) return null; // 編集中は通常の貼り付け
  const focused = api.getFocusedCell();
  if (!focused) return null;
  const text = e.clipboardData.getData("text/plain");
  if (!text) return null;
  e.preventDefault();

  const lines = text.replace(/\r?\n$/, "").split(/\r?\n/).map((l) => l.split("\t"));
  const cols = api.getAllDisplayedColumns();
  const startCol = cols.indexOf(focused.column as Column);
  const changes: TChange[] = [];
  let skipped = 0;

  // 小計行などはスキップして、編集可能な行にだけ順に貼る
  let rowIdx = focused.rowIndex;
  for (const line of lines) {
    let node = api.getDisplayedRowAtIndex(rowIdx);
    while (node && (node.rowPinned || !isEditableRow(api, node.data as TData, cols[startCol]))) {
      node = api.getDisplayedRowAtIndex(++rowIdx);
    }
    if (!node) break;
    line.forEach((raw, j) => {
      const col = cols[startCol + j];
      if (!col) return;
      const v = parseAmount(raw);
      if (v === null) {
        skipped++;
        return;
      }
      const c = toChange(node!.data as TData, col, v);
      if (c) changes.push(c);
      else skipped++;
    });
    rowIdx++;
  }
  if (skipped > 0) console.info(`貼り付け: ${skipped} セルは入力できないためスキップしました`);
  return changes;
}

function isEditableRow<TData>(api: GridApi<TData>, data: TData, col: Column | undefined): boolean {
  if (!col) return false;
  const editable = col.getColDef().editable;
  if (typeof editable === "function") {
    return !!editable({ data, column: col, colDef: col.getColDef(), api, context: undefined, node: null as never });
  }
  return !!editable;
}
