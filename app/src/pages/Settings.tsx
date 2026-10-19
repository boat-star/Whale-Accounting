import { useEffect, useState } from "react";
import { openFile, saveFile } from "../lib/bridge";
import { api } from "../lib/api";
import { useApp } from "../lib/app-context";
import { fmtMoney, monthRange } from "../lib/format";
import type { BackupItem, DataStats } from "../lib/types";
import { Icon } from "../components/Icons";
import { Mascot } from "../components/Mascot";

export function SettingsPage() {
  const { settings, saveSettings, accounts, toast, bump, month } = useApp();
  const [nick, setNick] = useState(settings.nickname);
  const [stats, setStats] = useState<DataStats | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [importAccount, setImportAccount] = useState("");
  const [busy, setBusy] = useState("");

  const refresh = () => {
    api.dataStats().then(setStats).catch(() => {});
    api.backupList().then(setBackups).catch(() => {});
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    setNick(settings.nickname);
  }, [settings.nickname]);

  useEffect(() => {
    if (!importAccount && accounts.length) setImportAccount(accounts[0].id);
  }, [accounts, importAccount]);

  async function doExport(all: boolean) {
    try {
      setBusy("export");
      const range = all
        ? { start: "2000-01-01", end: "2099-12-31" }
        : monthRange(month);
      const path = await saveFile({
        title: "导出账单",
        defaultPath: `鲸鱼记账-${all ? "全部" : month}.csv`,
        filters: [{ name: "CSV 表格", extensions: ["csv"] }],
      });
      if (!path) return;
      const n = await api.exportCsv({ path, ...range });
      toast(`导出好了，一共 ${n} 条。文件在：${path}`);
    } catch (e) {
      toast(String(e), true);
    } finally {
      setBusy("");
    }
  }

  async function doImport() {
    if (!importAccount) {
      toast("先选一个导入到哪个账户", true);
      return;
    }
    try {
      const path = await openFile({
        title: "选择支付宝 / 微信 / 银行导出的 CSV",
        filters: [{ name: "账单文件", extensions: ["csv", "txt"] }],
      });
      if (!path) return;
      setBusy("import");
      const r = await api.importCsv({ path, account_id: importAccount });
      bump();
      refresh();
      toast(
        r.messages.length ? r.messages.join(" ") : `读取了 ${r.total} 行，没有可导入的记录。`
      );
    } catch (e) {
      toast(String(e), true);
    } finally {
      setBusy("");
    }
  }

  async function doRestore(b: BackupItem) {
    if (
      !window.confirm(
        `用「${b.name}」覆盖当前账本？\n\n当前数据会先自动存一份到备份目录，恢复后窗口会重新载入。`
      )
    )
      return;
    try {
      setBusy("restore");
      await api.backupRestore(b.path);
      toast("已恢复，正在重新载入…");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      toast(String(e), true);
      setBusy("");
    }
  }

  async function doBackup() {
    try {
      setBusy("backup");
      const p = await api.backupCreate();
      refresh();
      toast(`备份好了：${p}`);
    } catch (e) {
      toast(String(e), true);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">设置</div>
          <div className="page-desc">数据只存在这台电脑上，不会上传到任何地方</div>
        </div>
      </div>

      <div className="two-col">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div className="card-title">鲸鱼娘怎么称呼你</div>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  placeholder="鱼片"
                />
                <button
                  className="btn primary"
                  onClick={() => saveSettings({ ...settings, nickname: nick.trim() || "鱼片" })}
                >
                  保存
                </button>
              </div>
              <div className="hint" style={{ marginTop: 8 }}>
                默认叫「鱼片」，跟那只爱吃白米饭的蓝鲸一样。
              </div>

              <div className="divider" />

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>深色模式</div>
                  <div className="hint">晚上记账不刺眼</div>
                </div>
                <button
                  className="btn sm"
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      theme: settings.theme === "dark" ? "light" : "dark",
                    })
                  }
                >
                  <Icon name="moon" size={14} />
                  {settings.theme === "dark" ? "已开启" : "关闭中"}
                </button>
              </div>

              <div className="divider" />

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>显示小鲸鱼</div>
                  <div className="hint">关掉之后界面会安静一些</div>
                </div>
                <button
                  className="btn sm"
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      mascot: settings.mascot === "on" ? "off" : "on",
                    })
                  }
                >
                  {settings.mascot === "on" ? "显示中" : "已隐藏"}
                </button>
              </div>

              <div className="divider" />

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>界面动画</div>
                  <div className="hint">只在鼠标悬停时动。关掉可省电，笔记本更耐用</div>
                </div>
                <button
                  className="btn sm"
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      motion: settings.motion === "off" ? "on" : "off",
                    })
                  }
                >
                  {settings.motion === "off" ? "已省电" : "开启动画"}
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">数据与备份</div>
              <div className="spacer" />
              <button className="btn sm" onClick={doBackup} disabled={busy === "backup"}>
                <Icon name="database" size={14} /> 立即备份
              </button>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <MiniStat label="记账笔数" value={`${stats?.txn_count ?? 0}`} />
                <MiniStat label="账户" value={`${stats?.account_count ?? 0}`} />
                <MiniStat label="分类" value={`${stats?.category_count ?? 0}`} />
                <MiniStat label="数据大小" value={`${stats?.db_size_kb ?? 0} KB`} />
              </div>
              <div className="divider" />
              <div className="hint" style={{ wordBreak: "break-all" }}>
                数据目录：{stats?.data_dir ?? "读取中…"}
              </div>
              <div className="hint" style={{ wordBreak: "break-all", marginTop: 4 }}>
                备份目录：{stats?.backup_dir ?? "读取中…"}
              </div>

              <div className="divider" />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn sm" onClick={() => doExport(false)} disabled={!!busy}>
                  <Icon name="download" size={14} /> 导出本月 CSV
                </button>
                <button className="btn sm" onClick={() => doExport(true)} disabled={!!busy}>
                  <Icon name="download" size={14} /> 导出全部
                </button>
              </div>

              <div className="divider" />
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                导入账单
              </div>
              <div className="hint" style={{ marginBottom: 8 }}>
                支持支付宝、微信、银行导出的 CSV。重复导入同一个文件不会重复记账。
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  className="select"
                  value={importAccount}
                  onChange={(e) => setImportAccount(e.target.value)}
                >
                  {accounts
                    .filter((a) => !a.archived)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        导入到：{a.name}
                      </option>
                    ))}
                </select>
                <button className="btn primary" onClick={doImport} disabled={busy === "import"}>
                  <Icon name="upload" size={14} /> 选文件
                </button>
              </div>

              {backups.length > 0 && (
                <>
                  <div className="divider" />
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                    最近的备份
                  </div>
                  <div className="list-plain">
                    {backups.slice(0, 4).map((b) => (
                      <div
                        key={b.path}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "7px 0",
                          fontSize: 12,
                        }}
                      >
                        <Icon name="database" size={14} />
                        <span style={{ flex: 1, wordBreak: "break-all" }}>{b.name}</span>
                        <span className="hint">{b.size_kb} KB</span>
                        <button
                          className="btn ghost sm"
                          onClick={() => doRestore(b)}
                          disabled={busy === "restore"}
                        >
                          恢复
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-body" style={{ paddingTop: 18 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Mascot size={72} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>鲸鱼记账 1.0</div>
                  <div className="hint" style={{ marginTop: 4 }}>
                    本地优先 · 键盘优先 · 不联网
                  </div>
                </div>
              </div>
              <div className="divider" />
              <div className="hint" style={{ lineHeight: 1.9 }}>
                做这个小工具的想法很简单：账单是自己的，不该存在别人的服务器上。
                <br />
                所有数据都在你的电脑里，卸载前记得先备份。
              </div>
              <div className="divider" />
              <div className="hint">
                快捷键：<span className="kbd">Ctrl</span>+<span className="kbd">N</span>{" "}
                记一笔 · <span className="kbd">Ctrl</span>+<span className="kbd">1~7</span>{" "}
                切换页面 · <span className="kbd">Enter</span> 保存 ·{" "}
                <span className="kbd">Esc</span> 关闭
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">小提示</div>
            </div>
            <div className="card-body">
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 12.5,
                  lineHeight: 2,
                  color: "var(--ink-2)",
                }}
              >
                <li>金额栏能直接算：输入 12.5+8 会记成 20.50</li>
                <li>信用卡和借款填负数余额，净资产才算得准</li>
                <li>转账不算支出，还信用卡请用「转账」</li>
                <li>每天第一次打开会自动留一份快照，保留最近 7 份</li>
                <li>卸载程序默认不动数据；点「恢复」可以把任意备份换回来</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="hint">{label}</div>
      <div className="num" style={{ fontWeight: 700, fontSize: 17 }}>
        {value}
      </div>
    </div>
  );
}
