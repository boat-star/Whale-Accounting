import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../lib/app-context";
import type { CategoryView } from "../lib/types";
import { Icon } from "../components/Icons";
import { Mascot } from "../components/Mascot";

const EMOJIS = [
  "🍚", "🍜", "☕", "🛒", "🚌", "🚕", "🏠", "💡", "🎮", "🎬",
  "💊", "📚", "🎁", "✈️", "👕", "📱", "🐱", "💼", "💰", "📈",
  "🧧", "✨", "🔧", "🎵",
];

export function CategoriesPage() {
  const { categories, reload, toast } = useApp();
  const [kind, setKind] = useState(0);
  const [form, setForm] = useState<{
    id?: string | null;
    name: string;
    icon: string;
    parentId: string | null;
  } | null>(null);

  const tops = useMemo(
    () => categories.filter((c) => c.kind === kind && !c.parent_id && !c.archived),
    [categories, kind]
  );
  const subs = useMemo(
    () => categories.filter((c) => c.kind === kind && c.parent_id && !c.archived),
    [categories, kind]
  );

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      toast("分类名不能为空", true);
      return;
    }
    try {
      await api.categorySave({
        id: form.id ?? null,
        parent_id: form.parentId,
        name: form.name,
        kind,
        icon: form.icon,
        color: kind === 0 ? "#3B82F6" : "#22C55E",
      });
      setForm(null);
      reload();
      toast("分类保存好了");
    } catch (e) {
      toast(String(e), true);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">分类</div>
          <div className="page-desc">分类越贴近你的生活，报表就越有用</div>
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
        <button
          className="btn primary"
          onClick={() => setForm({ id: null, name: "", icon: "✨", parentId: null })}
        >
          <Icon name="plus" size={15} /> 新建分类
        </button>
      </div>

      <div className="grid-3">
        {tops.map((c) => {
          const children = subs.filter((s) => s.parent_id === c.id);
          return (
            <div className="acct-card" key={c.id} style={{ gap: 12 }}>
              <div className="acct-top">
                <span style={{ fontSize: 22 }}>{c.icon}</span>
                <span className="acct-name">{c.name}</span>
                <div className="spacer" />
                <button
                  className="btn ghost sm"
                  onClick={() =>
                    setForm({ id: c.id, name: c.name, icon: c.icon, parentId: null })
                  }
                >
                  <Icon name="edit" size={13} />
                </button>
                <button
                  className="btn ghost sm danger"
                  onClick={() =>
                    api.categoryArchive(c.id).then(() => {
                      reload();
                      toast("分类已归档，历史记录不受影响");
                    })
                  }
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {children.map((s) => (
                  <span key={s.id} className="chip" style={{ fontSize: 11 }}>
                    {s.name}
                  </span>
                ))}
                <button
                  className="chip"
                  style={{ fontSize: 11, color: "var(--brand-2)" }}
                  onClick={() =>
                    setForm({ id: null, name: "", icon: c.icon, parentId: c.id })
                  }
                >
                  + 子分类
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mascot-hint" style={{ marginTop: 20 }}>
        <Mascot size={30} />
        <span>
          删除分类不会删掉里面的账单，只是把它藏起来，历史报表照样准。要彻底不要，就得先把账单挪到别的分类——这一步我先不让你做，怕你后悔。
        </span>
      </div>

      {form && (
        <div
          className="modal-mask"
          onMouseDown={(e) => e.target === e.currentTarget && setForm(null)}
        >
          <div className="modal" style={{ width: 440 }}>
            <div className="modal-head">
              <div className="modal-title">
                {form.id ? "编辑分类" : form.parentId ? "新建子分类" : "新建分类"}
              </div>
            </div>
            <div className="modal-body">
              <div className="field" style={{ marginTop: 0 }}>
                <label>名称</label>
                <input
                  className="input"
                  autoFocus
                  placeholder="例如：夜宵"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                />
              </div>
              <div className="field">
                <label>图标</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setForm({ ...form, icon: e })}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        fontSize: 17,
                        background:
                          form.icon === e
                            ? "color-mix(in srgb, var(--brand-2) 18%, transparent)"
                            : "var(--panel-2)",
                        border:
                          form.icon === e
                            ? "1.5px solid var(--brand-2)"
                            : "1px solid var(--line)",
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              {form.parentId === null && !form.id && (
                <div className="field">
                  <label>放到哪个分类下面（可不选）</label>
                  <select
                    className="select"
                    value={form.parentId ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, parentId: e.target.value || null })
                    }
                  >
                    <option value="">作为一级分类</option>
                    {tops.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
    </div>
  );
}
