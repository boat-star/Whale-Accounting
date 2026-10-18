import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../lib/app-context";
import { evalAmount, fmtMoney, monthLabel, shiftMonth } from "../lib/format";
import type { BudgetView, CategoryView } from "../lib/types";
import { Icon } from "../components/Icons";
import { Mascot } from "../components/Mascot";

export function BudgetPage() {
  const { month, setMonth, version, bump, categories, toast } = useApp();
  const [budgets, setBudgets] = useState<BudgetView[]>([]);
  const [editing, setEditing] = useState<{ categoryId: string | null; value: string } | null>(
    null
  );

  useEffect(() => {
    api.budgetList(month).then(setBudgets).catch((e) => toast(String(e), true));
  }, [month, version]);

  const topExpense = useMemo(
    () => categories.filter((c) => c.kind === 0 && !c.parent_id && !c.archived),
    [categories]
  );

  const total = budgets.find((b) => !b.category_id);
  const pct = total ? (total.used_minor / Math.max(total.amount_minor, 1)) * 100 : 0;
  const daysLeft = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const now = new Date();
    const isThisMonth = now.getFullYear() === y && now.getMonth() + 1 === m;
    return isThisMonth ? Math.max(last - now.getDate() + 1, 0) : 0;
  }, [month]);

  async function save() {
    if (!editing) return;
    try {
      await api.budgetSet({
        period: month,
        category_id: editing.categoryId,
        amount_minor: evalAmount(editing.value),
      });
      setEditing(null);
      bump();
      toast("预算更新好了");
    } catch (e) {
      toast(String(e), true);
    }
  }

  const daily = total && daysLeft > 0
    ? Math.max(Math.round((total.amount_minor - total.used_minor) / daysLeft), 0)
    : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">预算</div>
          <div className="page-desc">给自己留一条线，花超了我会提醒你</div>
        </div>
        <div className="spacer" />
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

      <div className="two-col">
        <div className="card">
          <div className="card-head">
            <div className="card-title">这个月总预算</div>
            <div className="spacer" />
            <button
              className="btn sm"
              onClick={() =>
                setEditing({
                  categoryId: null,
                  value: total ? (total.amount_minor / 100).toFixed(0) : "3000",
                })
              }
            >
              修改
            </button>
          </div>
          <div className="card-body">
            {total ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    className="num"
                    style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em" }}
                  >
                    {fmtMoney(total.amount_minor - total.used_minor)}
                  </span>
                  <span className="hint">还剩</span>
                </div>
                <div
                  className={"progress " + (pct >= 100 ? "over" : pct >= 80 ? "warn" : "")}
                  style={{ marginTop: 14 }}
                >
                  <div style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 10,
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  <span>
                    已用 {fmtMoney(total.used_minor)} / {fmtMoney(total.amount_minor)}
                  </span>
                  <span>{pct.toFixed(0)}%</span>
                </div>
                <div className="divider" />
                <div style={{ display: "flex", gap: 18 }}>
                  <div>
                    <div className="hint">每天还能花</div>
                    <div className="num" style={{ fontWeight: 700, fontSize: 16 }}>
                      {fmtMoney(daily)}
                    </div>
                  </div>
                  <div>
                    <div className="hint">剩余天数</div>
                    <div className="num" style={{ fontWeight: 700, fontSize: 16 }}>
                      {daysLeft} 天
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty" style={{ padding: "22px 10px" }}>
                <Mascot size={76} />
                还没有设总预算。
                <button
                  className="btn primary sm"
                  onClick={() => setEditing({ categoryId: null, value: "3000" })}
                >
                  设一个
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">分类预算</div>
            <div className="spacer" />
            <button
              className="btn sm"
              onClick={() => setEditing({ categoryId: topExpense[0]?.id ?? null, value: "500" })}
            >
              <Icon name="plus" size={14} /> 添加
            </button>
          </div>
          <div className="card-body">
            {budgets.filter((b) => b.category_id).length === 0 && (
              <div className="hint">
                分类预算可以给「餐饮」「购物」这类容易超支的项目单独设上限。
              </div>
            )}
            {budgets
              .filter((b) => b.category_id)
              .map((b) => {
                const p = (b.used_minor / Math.max(b.amount_minor, 1)) * 100;
                return (
                  <div key={b.id} style={{ padding: "10px 0" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12.5,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{b.category_name}</span>
                      <span className="num hint">
                        {fmtMoney(b.used_minor)} / {fmtMoney(b.amount_minor)}
                      </span>
                    </div>
                    <div
                      className={"progress " + (p >= 100 ? "over" : p >= 80 ? "warn" : "")}
                      style={{ height: 8 }}
                    >
                      <div style={{ width: `${Math.min(p, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {editing && (
        <div
          className="modal-mask"
          onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-head">
              <div className="modal-title">设置预算</div>
            </div>
            <div className="modal-body">
              <div className="field" style={{ marginTop: 0 }}>
                <label>预算对象</label>
                <select
                  className="select"
                  value={editing.categoryId ?? ""}
                  disabled={editing.categoryId === null}
                  onChange={(e) =>
                    setEditing({ ...editing, categoryId: e.target.value || null })
                  }
                >
                  <option value="">本月总预算</option>
                  {topExpense.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>金额（元）</label>
                <input
                  className="input"
                  autoFocus
                  value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                />
              </div>
              <div className="hint" style={{ marginTop: 10 }}>
                填 0 表示删除这个预算。
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setEditing(null)}>
                取消
              </button>
              <button className="btn primary" onClick={save}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
