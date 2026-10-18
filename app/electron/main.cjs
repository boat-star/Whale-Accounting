const { app, BrowserWindow, ipcMain, dialog, Menu, shell, protocol, net } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { pathToFileURL } = require("url");
const db = require("./db.cjs");

// file:// 下 ES Module 会被 CORS 拦截，改用自定义标准协议加载前端资源。
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

const TEST_MODE = !!process.env.WHALE_TEST;
const DATA_HOME = process.env.WHALE_DATA
  ? process.env.WHALE_DATA
  : TEST_MODE
  ? path.join(app.getPath("temp"), "whale-ledger-selftest")
  : path.join(app.getPath("appData"), "com.whaleledger.app");

if (TEST_MODE) {
  try {
    fs.rmSync(DATA_HOME, { recursive: true, force: true });
  } catch {}
}

// 记账界面是纯 2D 表单与图表，不依赖 GPU；关闭硬件加速可规避显卡驱动相关的渲染异常。
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-features", "SkiaGraphite,Vulkan,DawnCache");
app.commandLine.appendSwitch("in-process-gpu");
app.commandLine.appendSwitch("disable-gpu");

let win = null;
let dataDir = null;

const LOG_FILE = path.join(os.tmpdir(), "whale-main.log");
function log(...args) {
  try {
    fs.appendFileSync(LOG_FILE, args.map(String).join(" ") + "\n");
  } catch {}
}

function decodeBuffer(buf) {
  if (buf.length > 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString("utf8");
  }
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const bad = (utf8.match(/\uFFFD/g) || []).length;
  if (bad > Math.max(3, utf8.length * 0.005)) {
    try {
      return new TextDecoder("gbk").decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (c !== "\r") cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

const handlers = {
  ...db.api,

  export_csv: async ({ input }) => {
    const rows = db.api.export_rows({ start: input.start, end: input.end });
    const kinds = { 0: "支出", 1: "收入", 2: "转账", 3: "余额调整" };
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = ["日期,类型,分类,账户,对方账户,备注,金额(元)"];
    rows.forEach((r) => {
      lines.push(
        [
          r.occurred_on,
          kinds[r.kind] || "其他",
          esc(r.category),
          esc(r.account),
          esc(r.to_account),
          esc(r.note),
          (r.amount_minor / 100).toFixed(2),
        ].join(",")
      );
    });
    fs.writeFileSync(input.path, "\ufeff" + lines.join("\r\n"), "utf8");
    return rows.length;
  },

  import_csv: async ({ input }) => {
    const buf = fs.readFileSync(input.path);
    const text = decodeBuffer(buf);
    const rows = parseCsv(text);
    return db.api.import_rows({ rows, account_id: input.account_id });
  },

  backup_create: async () => {
    db.persistNow();
    const dir = path.join(dataDir, "backups");
    fs.mkdirSync(dir, { recursive: true });
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const name = `鲸鱼记账备份-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
      d.getHours()
    )}${p(d.getMinutes())}${p(d.getSeconds())}.db`;
    const target = path.join(dir, name);
    fs.copyFileSync(path.join(dataDir, "whale.db"), target);
    return target;
  },

  backup_restore: async ({ path: file } = {}) => {
    if (!file || !fs.existsSync(file)) throw new Error("备份文件不存在");
    db.persistNow();
    const dir = path.join(dataDir, "backups");
    fs.mkdirSync(dir, { recursive: true });
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const guard = `恢复前-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
      d.getHours()
    )}${p(d.getMinutes())}${p(d.getSeconds())}.db`;
    const current = path.join(dataDir, "whale.db");
    if (fs.existsSync(current)) fs.copyFileSync(current, path.join(dir, guard));

    const tmp = path.join(dataDir, "whale.db.tmp");
    fs.copyFileSync(file, tmp);
    fs.renameSync(tmp, current);
    db.reload(current);
    return true;
  },

  backup_list: async () => {
    const dir = path.join(dataDir, "backups");
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".db"))
      .map((f) => {
        const full = path.join(dir, f);
        const st = fs.statSync(full);
        return {
          name: f,
          path: full,
          size_kb: Math.round(st.size / 1024),
          created_at: st.mtime.toLocaleString("zh-CN", { hour12: false }).slice(0, 16),
        };
      })
      .sort((a, b) => (a.name < b.name ? 1 : -1));
  },

  data_stats: async () => {
    const s = db.api.stats();
    const file = path.join(dataDir, "whale.db");
    return {
      ...s,
      db_size_kb: fs.existsSync(file) ? Math.round(fs.statSync(file).size / 1024) : 0,
      data_dir: dataDir,
      backup_dir: path.join(dataDir, "backups"),
    };
  },

  open_data_dir: async () => {
    shell.openPath(dataDir);
    return true;
  },
};

function createWindow() {
  log("createWindow");
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1000,
    minHeight: 660,
    title: "鲸鱼记账",
    show: false,
    backgroundColor: "#f2f7fd",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      // 部分 Windows 预览版环境下渲染进程沙箱会导致进程启动即崩溃，故关闭渲染沙箱；
      // 应用只加载本地资源，contextIsolation 保持开启，风险可控。
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);
  win.loadURL(
    "app://ledger/index.html" + (process.env.WHALE_PAGE ? "#" + process.env.WHALE_PAGE : "")
  );

  win.webContents.on("did-fail-load", (_e, code, desc, url) =>
    log("LOAD FAIL", code, desc, url)
  );
  win.webContents.on("render-process-gone", (_e, d) => log("RENDER GONE", JSON.stringify(d)));
  win.webContents.on("preload-error", (_e, p, err) => log("PRELOAD ERROR", p, err.message));
  win.webContents.on("did-finish-load", () => { log("loaded"); win.show(); });
  win.once("ready-to-show", () => { log("ready-to-show"); win.show(); });

  if (process.env.WHALE_SHOT) {
    win.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage();
          fs.writeFileSync(process.env.WHALE_SHOT, img.toPNG());
          log("shot saved", process.env.WHALE_SHOT);
        } catch (e) {
          log("shot failed", e);
        }
        app.quit();
      }, 2200);
    });
  }
}

async function runSelfTest() {
  const out = [];
  const assert = (name, cond, detail = "") =>
    out.push({ name, pass: !!cond, detail: String(detail) });
  try {
    const accounts = await db.api.account_list();
    assert("初始账户数量为 4", accounts.length === 4, accounts.length);
    const wechat = accounts.find((a) => a.name === "微信");
    const bank = accounts.find((a) => a.name === "银行卡");
    const cats = await db.api.category_list();
    const food = cats.find((c) => c.name === "餐饮" && !c.parent_id);
    const salary = cats.find((c) => c.name === "工资");
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    await db.api.txn_create({
      input: { kind: 0, amount_minor: 3550, account_id: wechat.id, to_account_id: null, category_id: food.id, occurred_on: today, note: "午饭" },
    });
    await db.api.txn_create({
      input: { kind: 1, amount_minor: 500000, account_id: bank.id, to_account_id: null, category_id: salary.id, occurred_on: today, note: "工资" },
    });
    await db.api.txn_create({
      input: { kind: 2, amount_minor: 100000, account_id: wechat.id, to_account_id: bank.id, category_id: null, occurred_on: today, note: "提现" },
    });

    const accs2 = await db.api.account_list();
    assert(
      "转账与支出后微信余额正确",
      accs2.find((a) => a.id === wechat.id).balance_minor === -103550,
      accs2.find((a) => a.id === wechat.id).balance_minor
    );
    assert(
      "收入与转入后银行卡余额正确",
      accs2.find((a) => a.id === bank.id).balance_minor === 600000,
      accs2.find((a) => a.id === bank.id).balance_minor
    );

    const range = db.monthBounds(month);
    const summary = await db.api.report_summary({ range: { start: range[0], end: today } });
    assert("本月支出 35.50", summary.expense_minor === 3550, summary.expense_minor);
    assert("本月收入 5000", summary.income_minor === 500000, summary.income_minor);

    const byCat = await db.api.report_by_category({
      input: { start: range[0], end: today, kind: 0 },
    });
    assert(
      "分类统计含餐饮 35.50",
      byCat[0] && byCat[0].name === "餐饮" && byCat[0].total_minor === 3550,
      JSON.stringify(byCat[0])
    );

    const ov = await db.api.overview({ month });
    assert("净资产计算正确", ov.net_asset_minor === 496450, ov.net_asset_minor);

    const budgets = await db.api.budget_list({ period: month });
    const totalBudget = budgets.find((x) => !x.category_id);
    assert(
      "预算 3000 已用 35.50",
      totalBudget && totalBudget.amount_minor === 300000 && totalBudget.used_minor === 3550,
      JSON.stringify(totalBudget)
    );

    const rows = [
      ["交易时间", "交易对方", "商品说明", "收/支", "金额(元)"],
      ["2026-10-18 12:00:00", "商家A", "测试商品", "支出", "10.00"],
      ["2026-10-18 12:00:00", "商家A", "测试商品", "支出", "10.00"],
      ["2026-10-18 13:00:00", "商家B", "转账不计", "不计收支", "99.00"],
    ];
    const r1 = await db.api.import_rows({ rows, account_id: wechat.id });
    assert("首次导入去重生效", r1.imported === 1 && r1.invalid === 1, JSON.stringify(r1));
    const r2 = await db.api.import_rows({ rows, account_id: wechat.id });
    assert("重复导入零新增", r2.imported === 0 && r2.duplicate >= 1, JSON.stringify(r2));

    const list = await db.api.txn_list({
      filter: { start: range[0], end: today, limit: 10 },
    });
    const target = list.find((t) => t.note === "午饭");
    await db.api.txn_delete({ id: target.id });
    const w2 = (await db.api.account_list()).find((a) => a.id === wechat.id);
    assert("删除后余额还原", w2.balance_minor === -101000, w2.balance_minor);

    const csv = await handlers.export_csv({
      input: { path: path.join(dataDir, "selftest.csv"), start: range[0], end: today },
    });
    assert("导出记录数正确", csv === 3, csv);
    const text = fs.readFileSync(path.join(dataDir, "selftest.csv"), "utf8");
    assert("CSV 带 BOM 防乱码", text.charCodeAt(0) === 0xfeff);

    const bp = await handlers.backup_create({});
    assert("备份文件已生成", fs.existsSync(bp), bp);
  } catch (e) {
    out.push({ name: "运行异常", pass: false, detail: String((e && e.stack) || e) });
  }
  const passed = out.filter((x) => x.pass).length;
  out.push({ name: "汇总", pass: passed === out.length - 1, detail: `${passed}/${out.length - 1} 通过` });
  fs.writeFileSync(process.env.WHALE_TEST_OUT || "selftest.json", JSON.stringify(out, null, 2));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    log("ready");
    dataDir = DATA_HOME;
    fs.mkdirSync(dataDir, { recursive: true });

    const distDir = path.join(__dirname, "..", "dist");
    protocol.handle("app", async (request) => {
      try {
        const u = new URL(request.url);
        let rel = decodeURIComponent(u.pathname);
        if (!rel || rel === "/") rel = "/index.html";
        const file = path.normalize(path.join(distDir, rel));
        if (!file.startsWith(distDir)) return new Response("forbidden", { status: 403 });
        return await net.fetch(pathToFileURL(file).toString());
      } catch (e) {
        return new Response(`not found: ${e}`, { status: 404 });
      }
    });

    try {
      await db.init(
        path.join(dataDir, "whale.db"),
        path.join(__dirname, "..", "node_modules", "sql.js", "dist")
      );
    } catch (e) {
      log("DB INIT FAILED", e);
      dialog.showErrorBox("数据库初始化失败", String((e && e.stack) || e));
      app.quit();
      return;
    }

    try {
      db.autoBackup(dataDir);
    } catch (e) {
      log("auto backup failed:", e.message);
    }

    log("db ready");

    ipcMain.handle("api", async (_e, { cmd, args }) => {
      const fn = handlers[cmd];
      if (!fn) return { ok: false, error: `未知命令: ${cmd}` };
      try {
        return { ok: true, data: await fn(args || {}) };
      } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
      }
    });

    ipcMain.handle("dialog:save", async (_e, opts) => {
      const r = await dialog.showSaveDialog(win, {
        title: opts?.title || "保存",
        defaultPath: opts?.defaultPath,
        filters: opts?.filters || [{ name: "所有文件", extensions: ["*"] }],
      });
      return r.canceled ? null : r.filePath;
    });

    ipcMain.handle("dialog:open", async (_e, opts) => {
      const r = await dialog.showOpenDialog(win, {
        title: opts?.title || "打开",
        properties: ["openFile"],
        filters: opts?.filters || [{ name: "所有文件", extensions: ["*"] }],
      });
      return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
    });

    if (TEST_MODE) {
      await runSelfTest();
      app.quit();
      return;
    }

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  // 退出前把当天快照刷新成最新状态，避免只停留在启动那一刻
  app.on("before-quit", () => {
    try {
      db.persistNow();
      db.autoBackup(dataDir, 7, true);
    } catch (e) {
      log("quit backup failed:", e.message);
    }
  });

  app.on("window-all-closed", () => app.quit());

}
