import { useCallback, useEffect, useState } from "react";
import { api } from "./lib/api";
import { AppContext } from "./lib/app-context";
import { monthStr } from "./lib/format";
import type { AccountView, AppSettings, CategoryView, TxnView } from "./lib/types";
import { Icon } from "./components/Icons";
import { WhaleLogo } from "./components/Mascot";
import { TxnModal } from "./components/TxnModal";
import { OverviewPage } from "./pages/Overview";
import { LedgerPage } from "./pages/Ledger";
import { ReportsPage } from "./pages/Reports";
import { BudgetPage } from "./pages/Budget";
import { AccountsPage } from "./pages/Accounts";
import { CategoriesPage } from "./pages/Categories";
import { SettingsPage } from "./pages/Settings";

const NAV = [
  { key: "overview", label: "概览", icon: "home" },
  { key: "ledger", label: "明细", icon: "list" },
  { key: "reports", label: "报表", icon: "chart" },
  { key: "budget", label: "预算", icon: "target" },
  { key: "accounts", label: "账户", icon: "wallet" },
  { key: "categories", label: "分类", icon: "tag" },
  { key: "settings", label: "设置", icon: "gear" },
];

interface ToastItem {
  id: number;
  msg: string;
  err: boolean;
}

export default function App() {
  const [tab, setTab] = useState(() => {
    const h = window.location.hash.replace("#", "");
    return NAV.some((n) => n.key === h) ? h : "overview";
  });
  const [month, setMonth] = useState(monthStr());
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [categories, setCategories] = useState<CategoryView[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    nickname: "鱼片",
    theme: "light",
    mascot: "on",
  });
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modal, setModal] = useState<{
    open: boolean;
    editing: TxnView | null;
    kind: number;
  }>({ open: false, editing: null, kind: 0 });

  const toast = useCallback((msg: string, isError = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, err: isError }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const openTxn = useCallback((txn?: TxnView | null, kind = 0) => {
    setModal({ open: true, editing: txn ?? null, kind });
  }, []);

  useEffect(() => {
    Promise.all([api.accountList(), api.categoryList(), api.settingsGet()])
      .then(([a, c, s]) => {
        setAccounts(a);
        setCategories(c);
        setSettings(s);
      })
      .catch((e) => toast(String(e), true));
  }, [version, toast]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openTxn(null, 0);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && /^[1-7]$/.test(e.key)) {
        e.preventDefault();
        setTab(NAV[Number(e.key) - 1].key);
        return;
      }
      if (!typing && e.key === "n" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openTxn(null, 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTxn]);

  const saveSettings = useCallback(
    async (s: AppSettings) => {
      setSettings(s);
      try {
        await api.settingsSet(s);
        toast("设置已保存");
      } catch (e) {
        toast(String(e), true);
      }
    },
    [toast]
  );

  return (
    <AppContext.Provider
      value={{
        month,
        setMonth,
        accounts,
        categories,
        settings,
        saveSettings,
        version,
        bump,
        toast,
        openTxn,
        reload,
      }}
    >
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <WhaleLogo size={38} />
            <div className="brand-text">
              <div className="brand-title">鲸鱼记账</div>
              <div className="brand-sub">本地记账 · 不上传</div>
            </div>
          </div>
          {NAV.map((n) => (
            <button
              key={n.key}
              className={"nav-item" + (tab === n.key ? " active" : "")}
              onClick={() => setTab(n.key)}
            >
              <span className="ico">
                <Icon name={n.icon} size={17} />
              </span>
              {n.label}
            </button>
          ))}
          <div className="sidebar-foot">
            <div style={{ marginBottom: 8 }}>
              <button
                className="btn primary"
                style={{ width: "100%" }}
                onClick={() => openTxn(null, 0)}
              >
                <Icon name="plus" size={15} /> 记一笔
              </button>
            </div>
            <span className="kbd">Ctrl</span> + <span className="kbd">N</span> 随时记
          </div>
        </aside>

        <main className="main">
          {tab === "overview" && <OverviewPage />}
          {tab === "ledger" && <LedgerPage />}
          {tab === "reports" && <ReportsPage />}
          {tab === "budget" && <BudgetPage />}
          {tab === "accounts" && <AccountsPage />}
          {tab === "categories" && <CategoriesPage />}
          {tab === "settings" && <SettingsPage />}
        </main>
      </div>

      <TxnModal
        open={modal.open}
        editing={modal.editing}
        defaultKind={modal.kind}
        accounts={accounts}
        categories={categories}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        onSaved={(msg) => {
          bump();
          toast(msg);
        }}
        onError={(msg) => toast(msg, true)}
      />

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={"toast" + (t.err ? " err" : "")}>
            {t.msg}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
