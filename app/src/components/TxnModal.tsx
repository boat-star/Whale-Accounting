import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { evalAmount, todayStr } from "../lib/format";
import type { AccountView, CategoryView, TxnInput, TxnView } from "../lib/types";
import { Icon } from "./Icons";

interface Props {
  open: boolean;
  onClose: () => void;
  accounts: AccountView[];
  categories: CategoryView[];
  editing: TxnView | null;
  defaultKind: number;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

export function TxnModal({
  open,
  onClose,
  accounts,
  categories,
  editing,
  defaultKind,
  onSaved,
  onError,
}: Props) {
  const [kind, setKind] = useState(defaultKind);
  const [amountText, setAmountText] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.archived),
    [accounts]
  );

  useEffect(() => {
    if (!open) return;
    setKind(editing ? editing.kind : defaultKind);
    setAmountText(editing ? (editing.amount_minor / 100).toFixed(2) : "");
    setAccountId(editing?.account_id ?? activeAccounts[0]?.id ?? "");
    setToAccountId(editing?.to_account_id ?? "");
    setCategoryId(editing?.category_id ?? null);
    setDate(editing?.occurred_on ?? todayStr());
    setNote(editing?.note ?? "");
    setTimeout(() => amountRef.current?.focus(), 60);
  }, [open, editing, defaultKind, activeAccounts]);

  const topCategories = useMemo(
    () => categories.filter((c) => c.kind === kind && !c.parent_id && !c.archived),
    [categories, kind]
  );
  const subCategories = useMemo(
    () =>
      categories.filter(
        (c) => c.kind === kind && c.parent_id && !c.archived
      ),
    [categories, kind]
  );
  const selectedTop = useMemo(() => {
    if (!categoryId) return null;
    const c = categories.find((x) => x.id === categoryId);
    return c?.parent_id ?? c?.id ?? null;
  }, [categoryId, categories]);

  if (!open) return null;

  const isTransfer = kind === 2;
  const canSave =
    evalAmount(amountText) > 0 &&
    accountId &&
    (!isTransfer || (toAccountId && toAccountId !== accountId));

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    const input: TxnInput = {
      kind,
      amount_minor: evalAmount(amountText),
      account_id: accountId,
      to_account_id: isTransfer ? toAccountId : null,
      category_id: isTransfer ? null : categoryId,
      occurred_on: date,
      note: note.trim() || null,
    };
    try {
      if (editing) {
        await api.txnUpdate({ ...input, id: editing.id });
        onSaved("改好啦～");
      } else {
        await api.txnCreate(input);
        onSaved("记好啦，我去吃白米饭了～");
      }
      onClose();
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  }

  function pickCategory(id: string) {
    setCategoryId((prev) => (prev === id ? null : id));
  }

  return (
    <div
      className="modal-mask"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
        }}
      >
        <div className="modal-head">
          <div className="modal-title">
            {editing ? "编辑这一笔" : isTransfer ? "账户转账" : "记一笔"}
          </div>
          <div className="spacer" />
          <button className="btn ghost sm" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="modal-body">
          {!editing && (
            <div className="seg" style={{ marginBottom: 10 }}>
              <button className={kind === 0 ? "on" : ""} onClick={() => setKind(0)}>
                支出
              </button>
              <button className={kind === 1 ? "on" : ""} onClick={() => setKind(1)}>
                收入
              </button>
              <button className={kind === 2 ? "on" : ""} onClick={() => setKind(2)}>
                转账
              </button>
            </div>
          )}

          <input
            ref={amountRef}
            className="amount-input"
            placeholder="0.00"
            value={amountText}
            inputMode="decimal"
            onChange={(e) => setAmountText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.ctrlKey) {
                e.preventDefault();
                save();
              }
            }}
          />
          <div className="hint" style={{ marginTop: 4 }}>
            可以直接写 <span className="kbd">12.5+8</span> 这样的算式
          </div>

          {isTransfer ? (
            <div className="field">
              <label>从哪个账户转到哪个账户</label>
              <div className="row">
                <select
                  className="select"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <select
                  className="select"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                >
                  <option value="">转到…</option>
                  {activeAccounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="field">
              <label>花在哪儿 / 从哪儿来</label>
              <div className="cat-grid">
                {topCategories.map((c) => (
                  <button
                    key={c.id}
                    className={"cat-btn" + (selectedTop === c.id ? " on" : "")}
                    onClick={() => pickCategory(c.id)}
                  >
                    <span className="em">{c.icon}</span>
                    <span
                      style={{
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
              {selectedTop &&
                subCategories.some((s) => s.parent_id === selectedTop) && (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      marginTop: 8,
                    }}
                  >
                    {subCategories
                      .filter((s) => s.parent_id === selectedTop)
                      .map((s) => (
                        <button
                          key={s.id}
                          className={
                            "chip" +
                            (categoryId === s.id ? " on" : "")
                          }
                          style={
                            categoryId === s.id
                              ? {
                                  background: "color-mix(in srgb, var(--brand-2) 16%, transparent)",
                                  color: "var(--brand)",
                                }
                              : undefined
                          }
                          onClick={() => pickCategory(s.id)}
                        >
                          {s.name}
                        </button>
                      ))}
                  </div>
                )}
            </div>
          )}

          <div className="row" style={{ marginTop: 14 }}>
            <div className="field" style={{ marginTop: 0 }}>
              <label>账户</label>
              <select
                className="select"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginTop: 0 }}>
              <label>日期</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>备注（可不填）</label>
            <input
              className="input"
              placeholder="例如：楼下那家牛肉面"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-foot">
          <span className="hint" style={{ marginRight: "auto" }}>
            <span className="kbd">Enter</span> 保存 ·{" "}
            <span className="kbd">Esc</span> 取消
          </span>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            disabled={!canSave || saving}
            onClick={save}
            style={!canSave ? { opacity: 0.45 } : undefined}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
