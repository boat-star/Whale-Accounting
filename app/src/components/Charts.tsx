import { useState } from "react";
import type { CategoryStat } from "../lib/types";
import { fmtMoney } from "../lib/format";

type Slice = { name: string; value: number; color: string };

/**
 * 环形图。悬停某一段时：该段加粗外扩、其余半透明，圆心切换成这一类的金额与占比。
 * active / onActive 由外部持有，图例可以联动。
 */
export function RingChart({
  data,
  size = 150,
  thickness = 17,
  centerLabel = "本月支出",
  centerValue,
  active = null,
  onActive,
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  active?: number | null;
  onActive?: (i: number | null) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  // 预留外扩余量：悬停时半径 +2、线宽 +8，外沿仍要留在画布内
  const r = (size - thickness) / 2 - 7;
  const c = 2 * Math.PI * r;
  const gap = data.length > 1 ? 3 : 0;
  let acc = 0;

  const cur = active !== null ? data[active] : null;
  const pct = cur && total > 0 ? Math.round((cur.value / total) * 100) : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="var(--bg-2)"
        strokeWidth={thickness}
        fill="none"
      />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {total > 0 &&
          data.map((d, i) => {
            const len = (d.value / total) * c;
            const on = active === i;
            const dim = active !== null && !on;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r + (on ? 2 : 0)}
                stroke={d.color}
                strokeWidth={on ? thickness + 8 : thickness}
                fill="none"
                strokeLinecap="butt"
                strokeDasharray={`${Math.max(len - gap, 0.8)} ${c}`}
                strokeDashoffset={-acc}
                opacity={dim ? 0.28 : 1}
                style={{
                  transition:
                    "stroke-width .18s ease, r .18s ease, opacity .18s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={() => onActive?.(i)}
                onMouseLeave={() => onActive?.(null)}
              />
            );
            acc += len;
            return el;
          })}
      </g>

      <g style={{ pointerEvents: "none" }}>
        <text
          x="50%"
          y={cur ? "40%" : "46%"}
          textAnchor="middle"
          fontSize="11"
          fill={cur ? cur.color : "var(--muted)"}
          fontFamily="inherit"
          style={{ transition: "fill .18s ease" }}
        >
          {cur ? cur.name : centerLabel}
        </text>
        <text
          x="50%"
          y={cur ? "55%" : "60%"}
          textAnchor="middle"
          fontSize={cur ? "16" : "15.5"}
          fontWeight="700"
          fill="var(--ink)"
          fontFamily="inherit"
        >
          {cur ? fmtMoney(cur.value) : centerValue ?? fmtMoney(total)}
        </text>
        {cur && (
          <text
            x="50%"
            y="70%"
            textAnchor="middle"
            fontSize="10.5"
            fill="var(--muted)"
            fontFamily="inherit"
          >
            占 {pct}%
          </text>
        )}
      </g>
    </svg>
  );
}

export function Legend({
  data,
  total,
  active = null,
  onActive,
}: {
  data: Slice[];
  total: number;
  active?: number | null;
  onActive?: (i: number | null) => void;
}) {
  return (
    <div className="legend">
      {data.slice(0, 6).map((d, i) => (
        <div
          className={"legend-row" + (active === i ? " on" : "")}
          key={d.name}
          onMouseEnter={() => onActive?.(i)}
          onMouseLeave={() => onActive?.(null)}
        >
          <span className="dot" style={{ background: d.color }} />
          <span className="nm">{d.name}</span>
          <span className="val">
            {active === i
              ? fmtMoney(d.value)
              : `${total > 0 ? Math.round((d.value / total) * 100) : 0}%`}
          </span>
        </div>
      ))}
      {data.length === 0 && <span className="hint">还没有支出记录</span>}
    </div>
  );
}

const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function labelOf(date: string) {
  const parts = date.split("-").map(Number);
  if (parts.length === 2) return `${parts[1]} 月`;
  const [y, m, d] = parts;
  const w = WEEK[new Date(y, m - 1, d).getDay()];
  return `${m} 月 ${d} 日 · ${w}`;
}

/**
 * 折线图。鼠标移动时按横向位置吸附到最近的数据点，显示游标圆点、竖向参考线与日期金额浮层。
 */
export function TrendChart({
  points,
  height = 168,
}: {
  points: { date: string; value: number }[];
  height?: number;
}) {
  const [idx, setIdx] = useState<number | null>(null);

  const W = 620;
  const H = 160;
  const pad = 6;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2 - 10);
  const pts = points.map((p, i) => [pad + i * stepX, y(p.value)] as const);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${(pts[pts.length - 1]?.[0] ?? W).toFixed(1)} ${H} L${pad} ${H} Z`;

  const hit = idx !== null ? pts[idx] : null;
  const hovered = idx !== null ? points[idx] : null;

  function move(e: React.MouseEvent<HTMLDivElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const i = Math.round(ratio * (points.length - 1));
    setIdx(i);
  }

  const leftPct = hit ? (hit[0] / W) * 100 : 0;
  const topPct = hit ? (hit[1] / H) * 100 : 0;
  const tipLeft = Math.min(Math.max(leftPct, 12), 88);

  return (
    <div>
      <div
        className="trend-plot"
        style={{ height }}
        onMouseMove={move}
        onMouseLeave={() => setIdx(null)}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1d7ad1" stopOpacity="0.28" />
              <stop offset="1" stopColor="#1d7ad1" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={0}
              x2={W}
              y1={H * t}
              y2={H * t}
              stroke="var(--line)"
              strokeDasharray="4 6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {points.length > 1 && <path d={area} fill="url(#tg)" />}
          {points.length > 1 && (
            <path
              d={line}
              fill="none"
              stroke="#1d7ad1"
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {hit && (
            <line
              x1={hit[0]}
              x2={hit[0]}
              y1={2}
              y2={H}
              stroke="#1d7ad1"
              strokeOpacity="0.35"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {hit && (
          <>
            <span
              className="trend-dot"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            />
            <div className="trend-tip" style={{ left: `${tipLeft}%`, top: `${topPct}%` }}>
              <span className="d">{hovered ? labelOf(hovered.date) : ""}</span>
              <span className="v num">{fmtMoney(hovered?.value ?? 0)}</span>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 2,
        }}
      >
        <span>{points[0]?.date?.slice(5)}</span>
        <span>{points[Math.floor(points.length / 2)]?.date?.slice(5)}</span>
        <span>{points[points.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

export function CategoryBars({ data }: { data: CategoryStat[] }) {
  const max = Math.max(...data.map((d) => d.total_minor), 1);
  return (
    <div>
      {data.map((d) => (
        <div
          key={d.id}
          style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0" }}
        >
          <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{d.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12.5,
                marginBottom: 5,
                color: "var(--ink-2)",
              }}
            >
              <span>{d.name}</span>
              <span className="num">{fmtMoney(d.total_minor)}</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${(d.total_minor / max) * 100}%`,
                  background: d.color,
                }}
              />
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && <div className="hint">这个区间还没有支出</div>}
    </div>
  );
}
