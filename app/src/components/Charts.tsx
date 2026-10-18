import type { CategoryStat } from "../lib/types";
import { fmtMoney } from "../lib/format";

export function RingChart({
  data,
  size = 138,
  thickness = 17,
  centerLabel = "本月支出",
  centerValue,
}: {
  data: { name: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const gap = data.length > 1 ? 2.4 : 0;

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
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={d.color}
                strokeWidth={thickness}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(len - gap, 0.8)} ${c}`}
                strokeDashoffset={-acc}
                style={{ transition: "stroke-dasharray .5s ease" }}
              />
            );
            acc += len;
            return el;
          })}
      </g>
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        fontSize="11"
        fill="var(--muted)"
        fontFamily="inherit"
      >
        {centerLabel}
      </text>
      <text
        x="50%"
        y="60%"
        textAnchor="middle"
        fontSize="15.5"
        fontWeight="700"
        fill="var(--ink)"
        fontFamily="inherit"
      >
        {centerValue ?? fmtMoney(total)}
      </text>
    </svg>
  );
}

export function Legend({
  data,
  total,
}: {
  data: { name: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div className="legend">
      {data.slice(0, 6).map((d) => (
        <div className="legend-row" key={d.name}>
          <span className="dot" style={{ background: d.color }} />
          <span className="nm">{d.name}</span>
          <span className="val">
            {total > 0 ? Math.round((d.value / total) * 100) : 0}%
          </span>
        </div>
      ))}
      {data.length === 0 && <span className="hint">还没有支出记录</span>}
    </div>
  );
}

export function TrendChart({
  points,
  height = 168,
}: {
  points: { date: string; value: number }[];
  height?: number;
}) {
  const W = 620;
  const H = 160;
  const pad = 6;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2 - 10);
  const pts = points.map((p, i) => [pad + i * stepX, y(p.value)] as const);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${(pts[pts.length - 1]?.[0] ?? W).toFixed(1)} ${H} L${pad} ${H} Z`;

  return (
    <div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
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
      </svg>
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
