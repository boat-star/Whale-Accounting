import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../lib/app-context";
import { fmtMoney, monthRange, todayStr, dayLabel } from "../lib/format";
import type { BudgetView, CategoryStat, Overview as Ov, TxnView } from "../lib/types";
import { RingChart, Legend } from "../components/Charts";
import { Mascot } from "../components/Mascot";
import { Icon } from "../components/Icons";
import noteImg from "../assets/note.jpg";

export function OverviewPage() {
  const { month, settings, version, openTxn, toast } = useApp();
  const [ov, setOv] = useState<Ov | null>(null);
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [budgets, setBudgets] = useState<BudgetView[]>([]);
  const [recent, setRecent] = useState<TxnView[]>([]);

  useEffect(() => {
    const range = monthRange(month);
    Promise.all([
      api.overview(month),
      api.reportByCategory({ ...range, kind: 0 }),
      api.budgetList(month),
      api.txnList({ ...range, limit: 7 }),
    ])
      .then(([o, s, b, r]) => {
        setOv(o);
        setStats(s);
        setBudgets(b);
        setRecent(r);
      })
      .catch((e) => toast(String(e), true));
  }, [month, version]);

  const ring = useMemo(
    () =>
      stats.slice(0, 5).map((s) => ({
        name: s.name,
        value: s.total_minor,
        color: s.color,
      })),
    [stats]
  );

  const today = ov?.today_expense_minor ?? 0;
  const [ringHover, setRingHover] = useState<number | null>(null);

  const { greet, subtitle } = useMemo(() => {
    const h = new Date().getHours();
    const phase =
      h < 5 ? "night" : h < 9 ? "morning" : h < 12 ? "forenoon" : h < 14 ? "noon" : h < 18 ? "afternoon" : h < 22 ? "evening" : "late";
    const g = {
      night: "这么晚还没睡呀",
      morning: "早上好",
      forenoon: "上午好",
      noon: "中午好",
      afternoon: "下午好",
      evening: "晚上好",
      late: "夜深了",
    }[phase];

    // 副文案：先看今天花得怎么样，再按时段挑一句话
    const spent = today > 0;
    const table: Record<string, [string, string]> = {
      night: ["这个点还在记账，记完就去睡吧。", "今天还没花钱。早睡比省钱更难，去睡吧。"],
      morning: ["早饭记上了吗？一天的账从早餐开始。", "今天还没开张，先吃早饭，账待会儿再记。"],
      forenoon: ["上午的账别攒着，想起来就记一笔。", "上午一分没花，鱼片你今天很克制。"],
      noon: ["中午了，吃完顺手把这笔记上。", "还没开张，午饭这笔记一下吧。"],
      afternoon: ["下午犯困的话，记完这笔去喝口水。", "下午还没花钱，就这么保持到下班。"],
      evening: ["今天的花销都在这里了，记完就安心去吃饭吧。", "今天一分没花，晚饭可以加个菜。"],
      late: ["今天的账收个尾，就去睡吧。", "今天没花钱，睡前不用再想账的事了。"],
    };
    let sub = table[phase][spent ? 0 : 1];
    if (today > 50000) sub = "今天花得有点多…要不要翻翻明细，看看是哪一笔？";
    return { greet: g, subtitle: sub };
  }, [today]);

  // 点一下鲸鱼娘：跳一下 + 说一句话
  const [bubble, setBubble] = useState<string | null>(null);
  const [popping, setPopping] = useState(false);
  const bubbleTimer = useRef<number | undefined>(undefined);
  const popTimer = useRef<number | undefined>(undefined);

  const poke = () => {
    const lines = [
      "记账这种事，攒着会忘的。",
      "我盯着你呢，别乱花。",
      "今天的账，今天记。",
      "记完这笔，我去吃白米饭。",
      "别看我，看你的余额。",
      "鲸元券概不赊账。",
    ];
    setBubble(lines[Math.floor(Math.random() * lines.length)]);
    setPopping(false);
    window.clearTimeout(popTimer.current);
    window.clearTimeout(bubbleTimer.current);
    popTimer.current = window.setTimeout(() => setPopping(true), 16);
    bubbleTimer.current = window.setTimeout(() => {
      setBubble(null);
      setPopping(false);
    }, 2400);
  };

  const totalBudget = budgets.find((b) => !b.category_id);
  const budgetPct = totalBudget
    ? Math.min((totalBudget.used_minor / Math.max(totalBudget.amount_minor, 1)) * 100, 100)
    : 0;


  const daysLeft = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const now = new Date();
    if (now.getFullYear() !== y || now.getMonth() + 1 !== m) return 0;
    return Math.max(new Date(y, m, 0).getDate() - now.getDate(), 0);
  }, [month]);

  return (
    <div className="page">
      <div className="hero">
        <div className="hello">
          <div className="hello-glow" />
          <div className="name">
            {greet}，{settings.nickname}
          </div>
          <div className="big num">
            {fmtMoney(today)}
            <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.8, marginLeft: 8 }}>
              今天
            </span>
          </div>
          <div className="sub">{subtitle}</div>
          <button
            className="btn"
            style={{
              marginTop: 14,
              background: "rgba(255,255,255,.16)",
              borderColor: "rgba(255,255,255,.28)",
              color: "#fff",
            }}
            onClick={() => openTxn(null, 0)}
          >
            <Icon name="plus" size={15} /> 记一笔
            <span style={{ opacity: 0.7, marginLeft: 4 }}>Ctrl N</span>
          </button>
          <div
            className="hello-mascot"
            onClick={settings.mascot === "on" ? poke : undefined}
            title={settings.mascot === "on" ? "点我一下" : undefined}
            role="button"
            aria-label="鲸鱼娘"
          >
            {settings.mascot === "on" && (
              <div className={"mascot-float" + (popping ? " pop" : "")}>
                <Mascot size={148} mood={today > 50000 ? "sleep" : "happy"} />
              </div>
            )}
            {bubble && <div className="mascot-bubble">{bubble}</div>}
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat">
            <div className="k">本月支出</div>
            <div className="v num">{fmtMoney(ov?.month_expense_minor ?? 0)}</div>
          </div>
          <div className="stat">
            <div className="k">本月收入</div>
            <div className="v num" style={{ color: "var(--green)" }}>
              {fmtMoney(ov?.month_income_minor ?? 0)}
            </div>
          </div>
          <div className="stat">
            <div className="k">净资产</div>
            <div className="v num small">{fmtMoney(ov?.net_asset_minor ?? 0)}</div>
          </div>
          <div className="stat">
            <div className="k">本月笔数</div>
            <div className="v num small">{ov?.txn_count ?? 0} 笔</div>
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div className="card-title">这个月的钱花在哪了</div>
              <div className="spacer" />
              <span className="chip">{stats.length} 个分类</span>
            </div>
            <div className="card-body">
              <div className="ring-wrap">
                <RingChart
                  data={ring}
                  centerValue={fmtMoney(ov?.month_expense_minor ?? 0)}
                  active={ringHover}
                  onActive={setRingHover}
                />
                <Legend
                  data={ring}
                  total={ring.reduce((s, d) => s + d.value, 0)}
                  active={ringHover}
                  onActive={setRingHover}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">最近记的</div>
              <div className="spacer" />
              <span className="hint">点一行可以修改</span>
            </div>
            <div className="card-body">
              {recent.length === 0 && (
                <div className="empty">
                  <Mascot size={86} mood="sleep" />
                  <div>
                    还没有记录。按 <span className="kbd">Ctrl</span> +{" "}
                    <span className="kbd">N</span> 记下第一笔吧。
                  </div>
                </div>
              )}
              {recent.map((t) => (
                <div key={t.id} className="txn-row" onClick={() => openTxn(t)}>
                  <div className="avatar">{t.category_icon ?? (t.kind === 2 ? "🔁" : "✨")}</div>
                  <div className="txn-main">
                    <div className="txn-title">
                      {t.kind === 2
                        ? `${t.account_name} → ${t.to_account_name}`
                        : t.category_name ?? "未分类"}
                    </div>
                    <div className="txn-sub">
                      {dayLabel(t.occurred_on)} · {t.account_name}
                      {t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                  <div
                    className={
                      "txn-amount " +
                      (t.kind === 0 ? "expense" : t.kind === 1 ? "income" : "transfer")
                    }
                  >
                    {t.kind === 0 ? "-" : t.kind === 1 ? "+" : ""}
                    {fmtMoney(t.amount_minor)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div className="card-title">本月预算</div>
              <div className="spacer" />
              <span className="hint">{month}</span>
            </div>
            <div className="card-body">
              {totalBudget ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>
                      {fmtMoney(totalBudget.amount_minor - totalBudget.used_minor)}
                    </span>
                    <span className="hint">还能花</span>
                  </div>
                  <div
                    className={
                      "progress " +
                      (budgetPct >= 100 ? "over" : budgetPct >= 80 ? "warn" : "")
                    }
                    style={{ marginTop: 12 }}
                  >
                    <div style={{ width: `${budgetPct}%` }} />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 8,
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    <span>
                      已用 {fmtMoney(totalBudget.used_minor)} /{" "}
                      {fmtMoney(totalBudget.amount_minor)}
                    </span>
                    <span>{Math.round(budgetPct)}%</span>
                  </div>
                  {budgetPct >= 100 && (
                    <div className="mascot-hint" style={{ marginTop: 14 }}>
                      <Mascot size={34} mood="sleep" />
                      <span>预算已经用完啦。这个月剩下的日子，我陪你吃白米饭。</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="hint">还没设预算，去「预算」页定一个吧。</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">账户余额</div>
              <div className="spacer" />
            </div>
            <div className="card-body">
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div className="hint">资产</div>
                  <div className="num" style={{ fontSize: 17, fontWeight: 700, marginTop: 3 }}>
                    {fmtMoney(ov?.asset_minor ?? 0)}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="hint">负债</div>
                  <div
                    className="num"
                    style={{ fontSize: 17, fontWeight: 700, marginTop: 3, color: "var(--red)" }}
                  >
                    {fmtMoney(ov?.liability_minor ?? 0)}
                  </div>
                </div>
              </div>
              <div className="divider" />
              <div className="mascot-hint">
                <Mascot size={30} />
                <span>
                  {month === new Date().toISOString().slice(0, 7)
                    ? `这个月还剩 ${daysLeft} 天，慢慢来。`
                    : "这是过去的月份，翻账本的感觉也不错。"}
                </span>
              </div>
            </div>
          </div>

          {(ov?.net_asset_minor ?? 0) > 0 && (
            <div className="card note-card">
              <div className="card-body" style={{ padding: 0 }}>
                <img src={noteImg} alt="鲸元券" className="note-img" />
                <div className="note-cap">
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>本月结余已兑换</div>
                  <div className="hint">
                    净资产 {fmtMoney(ov?.net_asset_minor ?? 0)} · 面额 100000000 token
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
