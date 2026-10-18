import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../lib/app-context";
import { fmtMoney, monthLabel, monthRange, pad, shiftMonth } from "../lib/format";
import type { CategoryStat, Summary, TrendPoint } from "../lib/types";
import { CategoryBars, TrendChart } from "../components/Charts";
import { Icon } from "../components/Icons";

type Mode = "month" | "year";
type KindTab = 0 | 1;

export function ReportsPage() {
  const { month, setMonth, version, toast } = useApp();
  const [mode, setMode] = useState<Mode>("month");
  const [kind, setKind] = useState<KindTab>(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [prev, setPrev] = useState<Summary | null>(null);
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);

  const range = useMemo(() => {
    if (mode === "month") return monthRange(month);
    const y = month.split("-")[0];
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }, [mode, month]);

  const prevRange = useMemo(() => {
    if (mode === "month") return monthRange(shiftMonth(month, -1));
    const y = Number(month.split("-")[0]) - 1;
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }, [mode, month]);

  useEffect(() => {
    Promise.all([
      api.reportSummary(range),
      api.reportSummary(prevRange),
      api.reportByCategory({ ...range, kind }),
      api.reportTrend(range),
    ])
      .then(([s, p, c, t]) => {
        setSummary(s);
        setPrev(p);
        setStats(c);
        setTrend(t);
      })
      .catch((e) => toast(String(e), true));
  }, [range, prevRange, kind, version]);

  const points = useMemo(() => {
    if (mode === "month") {
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const now = new Date();
      const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m;
      const days = isCurrent ? now.getDate() : lastDay;
      const map = new Map(trend.map((t) => [t.date, t]));
      return Array.from({ length: days }, (_, i) => {
        const d = `${month}-${pad(i + 1)}`;
        const p = map.get(d);
        return {
          date: d,
          value: kind === 0 ? p?.expense_minor ?? 0 : p?.income_minor ?? 0,
        };
      });
    }
    const map = new Map<string, number>();
    for (const t of trend) {
      const key = t.date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + (kind === 0 ? t.expense_minor : t.income_minor));
    }
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${month.split("-")[0]}-${pad(i + 1)}`;
      return { date: key, value: map.get(key) ?? 0 };
    });
  }, [trend, mode, month, kind]);

  const cur = kind === 0 ? summary?.expense_minor ?? 0 : summary?.income_minor ?? 0;
  const before = kind === 0 ? prev?.expense_minor ?? 0 : prev?.income_minor ?? 0;
  const delta = before > 0 ? ((cur - before) / before) * 100 : null;
  const avg = points.length ? Math.round(points.reduce((s, p) => s + p.value, 0) / points.length) : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">报表</div>
          <div className="page-desc">看清钱去了哪里，比省下多少钱更重要</div>
        </div>
        <div className="spacer" />
        <div className="seg">
          <button className={mode === "month" ? "on" : ""} onClick={() => setMode("month")}>
            按月
          </button>
          <button className={mode === "year" ? "on" : ""} onClick={() => setMode("year")}>
            按年
          </button>
        </div>
        {mode === "month" && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button className="btn ghost sm" onClick={() => setMonth(shiftMonth(month, -1))}>
              <Icon name="chevronLeft" size={16} />
            </button>
            <span style={{ fontWeight: 600, minWidth: 76, textAlign: "center" }}>
              {monthLabel(month)}
            </span>
            <button className="btn ghost sm" onClick={() => setMonth(shiftMonth(month, 1))}>
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="k">{kind === 0 ? "支出" : "收入"}合计</div>
          <div className="v num" style={{ color: kind === 1 ? "var(--green)" : undefined }}>
            {fmtMoney(cur)}
          </div>
          <div className="hint" style={{ marginTop: 6 }}>
            {mode === "month" ? "相比上月" : "相比去年"}{" "}
            {delta === null ? (
              "暂无对比数据"
            ) : (
              <span style={{ color: delta > 0 ? "var(--red)" : "var(--green)" }}>
                {delta > 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="stat">
          <div className="k">结余</div>
          <div className="v num">{fmtMoney(summary?.net_minor ?? 0)}</div>
          <div className="hint" style={{ marginTop: 6 }}>
            收入减支出，不包含转账
          </div>
        </div>
        <div className="stat">
          <div className="k">{mode === "month" ? "日均" : "月均"}</div>
          <div className="v num">{fmtMoney(avg)}</div>
          <div className="hint" style={{ marginTop: 6 }}>
            共 {summary?.count ?? 0} 笔记录
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              {mode === "month" ? "每天的走势" : "每个月的走势"}
            </div>
            <div className="spacer" />
            <div className="seg">
              <button className={kind === 0 ? "on" : ""} onClick={() => setKind(0)}>
                支出
              </button>
              <button className={kind === 1 ? "on" : ""} onClick={() => setKind(1)}>
                收入
              </button>
            </div>
          </div>
          <div className="card-body">
            <TrendChart points={points} height={190} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">分类排行</div>
            <div className="spacer" />
            <span className="hint">{kind === 0 ? "支出" : "收入"}</span>
          </div>
          <div className="card-body">
            <CategoryBars data={stats} />
          </div>
        </div>
      </div>

      <div className="mascot-hint" style={{ marginTop: 16 }}>
        <span style={{ fontSize: 18 }}>🐳</span>
        <span>
          {cur === 0
            ? "这个区间没有记录。要么真的没花钱，要么是忘了记——我猜是后者。"
            : `平均每笔 ${fmtMoney(
                Math.round(cur / Math.max(summary?.count ?? 1, 1))
              )}，${stats[0] ? `花得最多的是「${stats[0].name}」` : ""}。`}
        </span>
      </div>
    </div>
  );
}
