import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../lib/app-context";
import {
  ACCOUNT_KINDS,
  accountIcon,
  accountKindLabel,
  evalAmount,
  fmtMoney,
} from "../lib/format";
import type { AccountView } from "../lib/types";
import { Icon } from "../components/Icons";
import { Mascot } from "../components/Mascot";

interface FormState {
  id?: string | null;
  name: string;
  kind: number;
  initial: string;
  include: boolean;
}

export function AccountsPage() {
  const { version, bump, toast, openTxn } = useApp();
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [adjust, setAdjust] = useState<{ id: string; value: string } | null>(null);

  useEffect(() => {
    api.accountList().then(setAccounts).catch((e) => toast(String(e), true));
  }, [version]);

  const active = accounts.filter((a) => !a.archived);
  const asset = active
    .filter((a) => a.include_in_net === 1 && a.kind !== 2 && a.kind !== 5)
    .reduce((s, a) => s + a.balance_minor, 0);
  const debt = active
    .filter((a) => a.include_in_net === 1 && (a.kind === 2 || a.kind === 5))
    .reduce((s, a) => s + a.balance_minor, 0);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      toast("给账户起个名字吧", true);
      return;
    }
    try {
      await api.accountSave({
        id: form.id ?? null,
        name: form.name,
        kind: form.kind,
        initial_minor: evalAmount(form.initial),
        include_in_net: form.include ? 1 : 0,
      });
      setForm(null);
      bump();
      toast("账户保存好了");
    } catch (e) {
      toast(String(e), true);
    }
  }

  async function saveAdjust() {
    if (!adjust) return;
    try {
      await api.accountAdjust({
        id: adjust.id,
        target_minor: evalAmount(adjust.value),
      });
      setAdjust(null);
      bump();
      toast("余额对上了");
    } catch (e) {
      toast(String(e), true);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">账户</div>
          <div className="page-desc">
            净资产 {fmtMoney(asset + debt)} · 资产 {fmtMoney(asset)} · 负债{" "}
            {fmtMoney(debt)}
          </div>
        </div>
        <div className="spacer" />
        <button
          className="btn primary"
          onClick={() =>
            setForm({ id: null, name: "", kind: 1, initial: "0", include: true })
          }
        >
          <Icon name="plus" size={15} /> 添加账户
        </button>
      </div>

      <div className="grid-3">
        {active.map((a) => (
          <div className="acct-card" key={a.id}>
            <div className="acct-top">
              <span style={{ fontSize: 20 }}>{accountIcon(a.kind)}</span>
              <span className="acct-name">{a.name}</span>
              <div className="spacer" />
              <span className="chip">{accountKindLabel(a.kind)}</span>
            </div>
            <div
              className="acct-bal"
              style={{ color: a.balance_minor < 0 ? "var(--red)" : undefined }}
            >
              {fmtMoney(a.balance_minor)}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                className="btn sm ghost"
                onClick={() =>
                  setForm({
                    id: a.id,
                    name: a.name,
                    kind: a.kind,
                    initial: (a.initial_minor / 100).toFixed(2),
                    include: a.include_in_net === 1,
                  })
                }
              >
                编辑
              </button>
              <button
                className="btn sm ghost"
                onClick={() =>
                  setAdjust({ id: a.id, value: (a.balance_minor / 100).toFixed(2) })
                }
              >
                对账
              </button>
              <div className="spacer" />
              <button
                className="btn sm ghost"
                onClick={() => openTxn(null, 2)}
                title="转账"
              >
                <Icon name="swap" size={14} />
              </button>
              <button
                className="btn sm ghost danger"
                onClick={() =>
                  api.accountArchive(a.id, true).then(() => {
                    bump();
                    toast("账户已归档，历史记录还在");
                  })
                }
              >
                归档
              </button>
            </div>
          </div>
        ))}

        {active.length === 0 && (
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="empty">
              <Mascot size={90} />
              还没有账户。建议先建「现金」「微信」「银行卡」三个。
            </div>
          </div>
        )}
      </div>

      {accounts.some((a) => a.archived) && (
        <div style={{ marginTop: 22 }}>
          <div className="hint" style={{ marginBottom: 8 }}>
            已归档的账户
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {accounts
              .filter((a) => a.archived)
              .map((a) => (
                <button
                  key={a.id}
                  className="chip"
                  onClick={() =>
                    api.accountArchive(a.id, false).then(() => {
                      bump();
                      toast("已恢复");
                    })
                  }
                >
                  {accountIcon(a.kind)} {a.name} · 点击恢复
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="mascot-hint" style={{ marginTop: 20 }}>
        <Mascot size={30} />
        <span>
          「对账」是把账户余额改成和真实余额一致，系统会自动记一笔差额，不会弄乱你的账单。
        </span>
      </div>

      {form && (
        <div
          className="modal-mask"
          onMouseDown={(e) => e.target === e.currentTarget && setForm(null)}
        >
          <div className="modal" style={{ width: 440 }}>
            <div className="modal-head">
              <div className="modal-title">{form.id ? "编辑账户" : "添加账户"}</div>
            </div>
            <div className="modal-body">
              <div className="field" style={{ marginTop: 0 }}>
                <label>账户名称</label>
                <input
                  className="input"
                  autoFocus
                  placeholder="例如：招商银行"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>类型</label>
                <select
                  className="select"
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: Number(e.target.value) })}
                >
                  {ACCOUNT_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.icon} {k.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>初始余额（元），欠款填负数</label>
                <input
                  className="input"
                  value={form.initial}
                  onChange={(e) => setForm({ ...form, initial: e.target.value })}
                />
              </div>
              <div className="field">
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={form.include}
                    onChange={(e) => setForm({ ...form, include: e.target.checked })}
                  />
                  计入净资产统计
                </label>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setForm(null)}>
                取消
              </button>
              <button className="btn primary" onClick={save}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {adjust && (
        <div
          className="modal-mask"
          onMouseDown={(e) => e.target === e.currentTarget && setAdjust(null)}
        >
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-head">
              <div className="modal-title">对账：真实余额是多少？</div>
            </div>
            <div className="modal-body">
              <input
                className="input"
                autoFocus
                value={adjust.value}
                onChange={(e) => setAdjust({ ...adjust, value: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && saveAdjust()}
              />
              <div className="hint" style={{ marginTop: 10 }}>
                比如银行 App 显示 1234.56，就填 1234.56。差额会记成一条「余额调整」。
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setAdjust(null)}>
                取消
              </button>
              <button className="btn primary" onClick={saveAdjust}>
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
