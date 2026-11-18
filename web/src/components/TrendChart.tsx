// 期間全体の月別推移（目標／予定／入金済み）。月をクリックすると選択できる。
import { useMemo, useState } from "react";
import type { Triple } from "../api";
import { monthLabel, yen } from "../format";

export const SERIES = [
  { key: "target", label: "目標", color: "var(--series-target)" },
  { key: "plan", label: "予定", color: "var(--series-plan)" },
  { key: "paid", label: "入金済み", color: "var(--series-paid)" },
] as const;

const W = 760;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** 万円表記の軸ラベル */
function axisLabel(v: number): string {
  if (v === 0) return "0";
  if (Math.abs(v) >= 10000) return `${(v / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万`;
  return v.toLocaleString("ja-JP");
}

/** 上端だけ角丸（4px）、下端はベースラインに接する棒 */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function TrendChart(props: {
  months: string[];
  values: Record<string, Triple>;
  selected: string;
  onSelect: (m: string) => void;
}) {
  const { months, values } = props;
  const [hover, setHover] = useState<string | null>(null);

  const max = useMemo(() => {
    let m = 0;
    for (const mo of months) {
      const v = values[mo];
      if (v) m = Math.max(m, v.target, v.plan, v.paid);
    }
    return niceMax(m);
  }, [months, values]);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / Math.max(months.length, 1);
  const groupW = Math.min(band * 0.72, 54);
  const gap = 2;
  const barW = (groupW - gap * 2) / 3;
  const y = (v: number) => PAD.top + innerH - (Math.max(v, 0) / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  const hv = hover ? values[hover] : null;
  const hoverIdx = hover ? months.indexOf(hover) : -1;

  return (
    <div className="trend">
      <div className="legend-row">
        {SERIES.map((s) => (
          <span key={s.key} className="legend-item">
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="trend-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="月別の目標・予定・入金済み">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid-line" />
              <text x={PAD.left - 8} y={y(t)} className="axis-label" textAnchor="end" dominantBaseline="middle">
                {axisLabel(t)}
              </text>
            </g>
          ))}
          {months.map((m, i) => {
            const x0 = PAD.left + band * i;
            const gx = x0 + (band - groupW) / 2;
            const v = values[m] ?? { target: 0, plan: 0, paid: 0 };
            const isSel = m === props.selected;
            return (
              <g key={m}>
                {(isSel || hover === m) && (
                  <rect x={x0 + 2} y={PAD.top} width={band - 4} height={innerH} rx={6} className={isSel ? "band-selected" : "band-hover"} />
                )}
                {SERIES.map((s, j) => {
                  const val = v[s.key];
                  return <path key={s.key} d={barPath(gx + j * (barW + gap), y(val), barW, y(0) - y(val))} fill={s.color} />;
                })}
                <text x={x0 + band / 2} y={H - 8} className={`axis-label ${isSel ? "strong" : ""}`} textAnchor="middle">
                  {Number(m.slice(5))}月
                </text>
                {/* ヒット領域は棒より大きく */}
                <rect
                  x={x0}
                  y={0}
                  width={band}
                  height={H}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHover(m)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => props.onSelect(m)}
                />
              </g>
            );
          })}
          <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="base-line" />
        </svg>
        {hv && hoverIdx >= 0 && (
          <div
            className="tooltip"
            style={{
              left: `${((PAD.left + band * (hoverIdx + 0.5)) / W) * 100}%`,
              transform: hoverIdx > months.length / 2 ? "translateX(-105%)" : "translateX(5%)",
            }}
          >
            <div className="tooltip-title">{monthLabel(hover!)}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="tooltip-row">
                <i style={{ background: s.color }} />
                <span>{s.label}</span>
                <b>{yen(hv[s.key])}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
