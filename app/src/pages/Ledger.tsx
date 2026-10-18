import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../lib/app-context";
import {
  dayLabel,
  fmtMoney,
  monthLabel,
  monthRange,
  shiftMonth,
  weekdayLabel,
} from "../lib/format";
import type { TxnView } from "../lib/types";
import { Icon } from "../components/Icons";
import { Mascot } from "../components/Mascot";

type Filter = "all" | "expense" | "income" | "transfer";

export function LedgerPage() {
  const { month, setMonth, version, bump, openTxn, toast } = useApp();
  const [rows, setRows] = useState<TxnView[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [keyword, setKeyword] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const range = monthRange(month);
    api
      .txnList({
        ...range,
        kind:
          filter === "all"
            ? null
            : filter === "expense"
            ? 0
            : filter === "income"
            ? 1
            : 2,
        keyword: keyword.trim() || null,
        limit: 3000,
      })
      .then(setRows)
      .catch((e) => toast(String(e), true));
  }, [month, filter, keyword, version]);

  const groups = useMemo(() => {
    const map = new Map<string, TxnView[]>();
    for (const r of rows) {
      if (!map.has(r.occurred_on)) map.set(r.occurred_on, []);
      map.get(r.occurred_on)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  const totalOut = rows
    .filter((r) => r.kind === 0)
    .reduce((s, r) => s + r.amount_minor, 0);
  const totalIn = rows
    .filter((r) => r.kind === 1)
    .reduce((s, r) => s + r.amount_minor, 0);

  async function remove(id: string) {
    try {
      await api.txnDelete(id);
      setConfirmId(null);
      bump();
      toast("删掉了，余额也一起改好了");
    } catch (e) {
      toast(String(e), true);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">明细</div>
          <div className="page-desc">
            这个月支出 {fmtMoney(totalOut)} · 收入 {fmtMoney(totalIn)} · 共 {rows.length} 笔
          </div>
        </div>
        <div className="spacer" />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button className="btn ghost sm" onClick={() => setMonth(shiftMonth(month, -1))}>
            <Icon name="chevronLeft" size={16} />
          </button>
          <span style={{ fontWeight: 600, minWidth: 78, textAlign: "center" }}>
            {monthLabel(month)}
          </span>
          <button className="btn ghost sm" onClick={() => setMonth(shiftMonth(month, 1))}>
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        <button className="btn primary" onClick={() => openTxn(null, 0)}>
          <Icon name="plus" size={15} /> 记一笔
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div className="seg">
          {(
            [
              ["all", "全部"],
              ["expense", "支出"],
              ["income", "收入"],
              ["transfer", "转账"],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              className={filter === k ? "on" : ""}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="search" style={{ width: 240 }}>
          <Icon name="search" size={15} />
          <input
            className="input"
            placeholder="搜备注…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>

      {groups.length === 0 && (
        <div className="card">
          <div className="empty">
            <Mascot size={92} mood="sleep" />
            <div>
              {keyword ? "没搜到匹配的记录。" : "这个月还没有记账。"}
              <br />
              我不催你，想起来了按 <span className="kbd">Ctrl</span> +{" "}
              <span className="kbd">N</span>。
            </div>
          </div>
        </div>
      )}

      {groups.map(([date, list]) => {
        const out = list.filter((r) => r.kind === 0).reduce((s, r) => s + r.amount_minor, 0);
        const inc = list.filter((r) => r.kind === 1).reduce((s, r) => s + r.amount_minor, 0);
        return (
          <div className="day-group" key={date}>
            <div className="day-head">
              <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>
                {dayLabel(date)}
              </span>
              <span>{weekdayLabel(date)}</span>
              <span className="sum">
                {out > 0 && `支出 ${fmtMoney(out)}`}
                {out > 0 && inc > 0 && " · "}
                {inc > 0 && `收入 ${fmtMoney(inc)}`}
              </span>
            </div>
            {list.map((t) => (
              <div key={t.id} className="txn-row" onClick={() => openTxn(t)}>
                <div className="avatar">
                  {t.category_icon ?? (t.kind === 2 ? "🔁" : "✨")}
                </div>
                <div className="txn-main">
                  <div className="txn-title">
                    {t.kind === 2
                      ? `${t.account_name} → ${t.to_account_name}`
                      : t.category_name ?? "未分类"}
                  </div>
                  <div className="txn-sub">
                    {t.account_name}
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
                <div className="acts" onClick={(e) => e.stopPropagation()}>
                  <button className="btn ghost sm" onClick={() => openTxn(t)} title="编辑">
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    className="btn ghost sm danger"
                    onClick={() => setConfirmId(t.id)}
                    title="删除"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {confirmId && (
        <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && setConfirmId(null)}>
          <div className="modal" style={{ width: 400 }}>
            <div className="modal-head">
              <div className="modal-title">要删掉这一笔吗？</div>
            </div>
            <div className="modal-body">
              <div className="hint">
                删除后账户余额会自动还原。这一步不能撤回，不过你的数据都在本机，删了也不会传到网上。
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setConfirmId(null)}>
                算了
              </button>
              <button className="btn primary" onClick={() => remove(confirmId)}>
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
