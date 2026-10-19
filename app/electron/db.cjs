/**
 * 数据层：sql.js（SQLite WASM）内存库 + 落盘快照。
 * 业务口径与设计文档一致：金额以分为单位，转账不计收支，余额由流水重算。
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const initSqlJs = require("sql.js");

let SQL = null;
let db = null;
let dbFile = null;
let saveTimer = null;

const KIND_EXPENSE = 0;
const KIND_INCOME = 1;
const KIND_TRANSFER = 2;
const KIND_ADJUST = 3;

const pad = (n) => String(n).padStart(2, "0");
const nowStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const newId = () => crypto.randomUUID();

function monthBounds(month) {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return [start, `${ny}-${pad(nm)}-01`];
}

// ---------- 基础设施 ----------
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}
const one = (sql, params = []) => all(sql, params)[0] || null;
const val = (sql, params = [], fallback = 0) => {
  const r = one(sql, params);
  if (!r) return fallback;
  const v = Object.values(r)[0];
  return v === null || v === undefined ? fallback : v;
};
const run = (sql, params = []) => db.run(sql, params);

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 250);
}
function persistNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!db || !dbFile) return;
  const data = Buffer.from(db.export());
  const tmp = dbFile + ".tmp";
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, dbFile);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}

async function init(file, wasmDir) {
  SQL = await initSqlJs({ locateFile: (f) => path.join(wasmDir, f) });
  dbFile = file;
  const exists = fs.existsSync(file) && fs.statSync(file).size > 0;
  if (exists) {
    try {
      db = new SQL.Database(fs.readFileSync(file));
      db.exec("SELECT count(*) FROM sqlite_master");
    } catch (e) {
      // 读不出来时绝不能静默重建：把坏文件原地留档，便于事后抢救
      try {
        fs.renameSync(file, `${file}.broken-${stamp()}`);
      } catch {}
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }
  run("PRAGMA foreign_keys = ON");
  migrate();
  return db;
}

/** 用指定文件替换当前内存库（用于「从备份恢复」）。 */
function reload(file) {
  db = new SQL.Database(fs.readFileSync(file));
  dbFile = file;
  run("PRAGMA foreign_keys = ON");
  return db;
}

/**
 * 每天首次启动自动留一份快照，最多保留 keep 份。
 * 空账本不占备份位，避免刚装完就生成一堆空备份。
 */
function autoBackup(dir, keep = 7, force = false) {
  const src = path.join(dir, "whale.db");
  if (!fs.existsSync(src)) return null;
  if (val("SELECT COUNT(*) FROM txn") === 0) return null;

  const bdir = path.join(dir, "backups");
  fs.mkdirSync(bdir, { recursive: true });
  const target = path.join(bdir, `自动备份-${stamp().slice(0, 8)}.db`);
  if (force || !fs.existsSync(target)) fs.copyFileSync(src, target);

  const autos = fs
    .readdirSync(bdir)
    .filter((f) => f.startsWith("自动备份-") && f.endsWith(".db"))
    .sort();
  while (autos.length > keep) {
    try {
      fs.unlinkSync(path.join(bdir, autos.shift()));
    } catch {}
  }
  return target;
}

function migrate() {
  const v = val("PRAGMA user_version");
  if (v >= 1) return;
  db.run(`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, kind INTEGER NOT NULL DEFAULT 1,
      initial_minor INTEGER NOT NULL DEFAULT 0, balance_minor INTEGER NOT NULL DEFAULT 0,
      include_in_net INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS category (
      id TEXT PRIMARY KEY, parent_id TEXT REFERENCES category(id), name TEXT NOT NULL,
      kind INTEGER NOT NULL, icon TEXT NOT NULL DEFAULT '📦', color TEXT NOT NULL DEFAULT '#94A3B8',
      sort_order INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS txn (
      id TEXT PRIMARY KEY, kind INTEGER NOT NULL, amount_minor INTEGER NOT NULL,
      account_id TEXT NOT NULL REFERENCES account(id),
      to_account_id TEXT REFERENCES account(id),
      category_id TEXT REFERENCES category(id),
      occurred_on TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS budget (
      id TEXT PRIMARY KEY, period TEXT NOT NULL, category_id TEXT REFERENCES category(id),
      amount_minor INTEGER NOT NULL, UNIQUE(period, category_id)
    );
    CREATE TABLE IF NOT EXISTS import_fingerprint (
      fingerprint TEXT PRIMARY KEY, txn_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_txn_date ON txn(occurred_on DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_txn_account ON txn(account_id, occurred_on);
    CREATE INDEX IF NOT EXISTS idx_txn_category ON txn(category_id, occurred_on);
    CREATE INDEX IF NOT EXISTS idx_budget_period ON budget(period);
    PRAGMA user_version = 1;
  `);
  seed();
  persistNow();
}

function seed() {
  if (val("SELECT COUNT(*) c FROM category") > 0) return;
  const now = nowStr();
  const accounts = [
    ["现金", 0],
    ["微信", 3],
    ["支付宝", 3],
    ["银行卡", 1],
  ];
  accounts.forEach(([name, kind], i) => {
    run(
      "INSERT INTO account (id,name,kind,initial_minor,balance_minor,include_in_net,archived,sort_order,created_at) VALUES (?,?,?,0,0,1,0,?,?)",
      [newId(), name, kind, i, now]
    );
  });

  const expenseTree = [
    ["餐饮", "🍚", "#F59E0B", ["早餐", "午餐", "晚餐", "外卖", "零食饮料"]],
    ["交通", "🚌", "#3B82F6", ["公交地铁", "打车", "加油停车"]],
    ["购物", "🛍", "#EC4899", ["日用品", "数码", "服饰"]],
    ["居住", "🏠", "#8B5CF6", ["房租", "水电燃气", "物业"]],
    ["娱乐", "🎮", "#06B6D4", ["电影", "游戏", "旅行"]],
    ["医疗", "💊", "#EF4444", ["药品", "门诊"]],
    ["学习", "📚", "#10B981", ["书籍", "课程"]],
    ["人情", "🎁", "#F97316", ["送礼", "红包"]],
    ["其他", "📦", "#94A3B8", []],
  ];
  const incomeTree = [
    ["工资", "💰", "#22C55E", []],
    ["奖金", "🏆", "#84CC16", []],
    ["兼职", "💼", "#14B8A6", []],
    ["理财", "📈", "#0EA5E9", []],
    ["红包", "🧧", "#E11D48", []],
    ["其他收入", "✨", "#A78BFA", []],
  ];
  const insertTree = (tree, kind) => {
    let order = 0;
    tree.forEach(([name, icon, color, children]) => {
      const pid = newId();
      run(
        "INSERT INTO category (id,parent_id,name,kind,icon,color,sort_order,archived) VALUES (?,NULL,?,?,?,?,?,0)",
        [pid, name, kind, icon, color, order]
      );
      children.forEach((c) => {
        run(
          "INSERT INTO category (id,parent_id,name,kind,icon,color,sort_order,archived) VALUES (?,?,?,?,?,?,0,0)",
          [newId(), pid, c, kind, icon, color]
        );
      });
      order += 10;
    });
  };
  insertTree(expenseTree, KIND_EXPENSE);
  insertTree(incomeTree, KIND_INCOME);

  const period = new Date().toISOString().slice(0, 7);
  run("INSERT INTO budget (id,period,category_id,amount_minor) VALUES (?,?,NULL,300000)", [
    newId(),
    period,
  ]);
  run("INSERT INTO setting (key,value) VALUES ('nickname','鱼片'),('theme','light'),('mascot','on')");
}

function recalcAccount(id) {
  run(
    `UPDATE account SET balance_minor = initial_minor + COALESCE((
       SELECT SUM(CASE
         WHEN t.kind=0 AND t.account_id=account.id THEN -t.amount_minor
         WHEN t.kind=1 AND t.account_id=account.id THEN t.amount_minor
         WHEN t.kind=2 AND t.account_id=account.id THEN -t.amount_minor
         WHEN t.kind=2 AND t.to_account_id=account.id THEN t.amount_minor
         WHEN t.kind=3 THEN t.amount_minor
         ELSE 0 END)
       FROM txn t
       WHERE t.deleted_at IS NULL
         AND (t.account_id=account.id OR t.to_account_id=account.id)
     ),0) WHERE id = ?`,
    [id]
  );
}

// ---------- 查询与命令 ----------
const api = {};

api.overview = ({ month }) => {
  const [start, next] = monthBounds(month);
  const row = one(
    `SELECT COALESCE(SUM(CASE WHEN kind=0 THEN amount_minor END),0) e,
            COALESCE(SUM(CASE WHEN kind=1 THEN amount_minor END),0) i,
            COUNT(*) c
     FROM txn WHERE deleted_at IS NULL AND occurred_on >= ? AND occurred_on < ?`,
    [start, next]
  );
  const today = val(
    "SELECT COALESCE(SUM(amount_minor),0) v FROM txn WHERE deleted_at IS NULL AND kind=0 AND occurred_on=?",
    [todayStr()]
  );
  const acct = one(
    `SELECT COALESCE(SUM(CASE WHEN kind NOT IN (2,5) THEN balance_minor ELSE 0 END),0) asset,
            COALESCE(SUM(CASE WHEN kind IN (2,5) THEN balance_minor ELSE 0 END),0) liab
     FROM account WHERE include_in_net=1 AND archived=0`
  );
  return {
    month_expense_minor: row.e,
    month_income_minor: row.i,
    today_expense_minor: today,
    asset_minor: acct.asset,
    liability_minor: acct.liab,
    net_asset_minor: acct.asset + acct.liab,
    txn_count: row.c,
    month,
  };
};

api.txn_list = ({ filter }) => {
  const { start, end, kind, category_id, account_id, keyword, limit } = filter;
  return all(
    `SELECT t.id, t.kind, t.amount_minor, t.account_id, a.name account_name,
            t.to_account_id, b.name to_account_name, t.category_id,
            c.name category_name, c.icon category_icon, c.color category_color,
            t.occurred_on, t.note, t.created_at
     FROM txn t
     JOIN account a ON a.id=t.account_id
     LEFT JOIN account b ON b.id=t.to_account_id
     LEFT JOIN category c ON c.id=t.category_id
     WHERE t.deleted_at IS NULL
       AND t.occurred_on BETWEEN ? AND ?
       AND (? IS NULL OR t.kind = ?)
       AND (? IS NULL OR t.category_id = ?)
       AND (? IS NULL OR t.account_id = ?)
       AND (? IS NULL OR t.note LIKE '%' || ? || '%')
     ORDER BY t.occurred_on DESC, t.created_at DESC
     LIMIT ?`,
    [
      start,
      end,
      kind ?? null,
      kind ?? null,
      category_id ?? null,
      category_id ?? null,
      account_id ?? null,
      account_id ?? null,
      keyword ?? null,
      keyword ?? null,
      limit ?? 2000,
    ]
  );
};

function validate(input) {
  if (!input.amount_minor) throw new Error("金额不能为 0");
  if (input.kind !== KIND_ADJUST && input.amount_minor < 0) throw new Error("金额必须大于 0");
  if (!val("SELECT COUNT(*) c FROM account WHERE id=? AND archived=0", [input.account_id]))
    throw new Error("账户不存在");
  if (input.kind === KIND_TRANSFER) {
    if (!input.to_account_id) throw new Error("请选择转入账户");
    if (input.to_account_id === input.account_id) throw new Error("转入与转出账户不能相同");
    if (!val("SELECT COUNT(*) c FROM account WHERE id=? AND archived=0", [input.to_account_id]))
      throw new Error("转入账户不存在");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurred_on)) throw new Error("日期格式应为 YYYY-MM-DD");
}

api.txn_create = ({ input }) => {
  validate(input);
  const id = newId();
  const now = nowStr();
  run(
    `INSERT INTO txn (id,kind,amount_minor,account_id,to_account_id,category_id,occurred_on,note,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.kind,
      input.amount_minor,
      input.account_id,
      input.to_account_id ?? null,
      input.category_id ?? null,
      input.occurred_on,
      input.note ?? null,
      now,
      now,
    ]
  );
  recalcAccount(input.account_id);
  if (input.to_account_id) recalcAccount(input.to_account_id);
  persist();
  return id;
};

api.txn_update = ({ input }) => {
  const old = one("SELECT account_id, to_account_id FROM txn WHERE id=? AND deleted_at IS NULL", [
    input.id,
  ]);
  if (!old) throw new Error("记录不存在");
  validate(input);
  run(
    `UPDATE txn SET kind=?, amount_minor=?, account_id=?, to_account_id=?, category_id=?,
            occurred_on=?, note=?, updated_at=? WHERE id=?`,
    [
      input.kind,
      input.amount_minor,
      input.account_id,
      input.to_account_id ?? null,
      input.category_id ?? null,
      input.occurred_on,
      input.note ?? null,
      nowStr(),
      input.id,
    ]
  );
  const touched = new Set([old.account_id, input.account_id]);
  if (old.to_account_id) touched.add(old.to_account_id);
  if (input.to_account_id) touched.add(input.to_account_id);
  touched.forEach(recalcAccount);
  persist();
};

api.txn_delete = ({ id }) => {
  const old = one("SELECT account_id, to_account_id FROM txn WHERE id=? AND deleted_at IS NULL", [id]);
  if (!old) throw new Error("记录不存在");
  run("UPDATE txn SET deleted_at=? WHERE id=?", [nowStr(), id]);
  recalcAccount(old.account_id);
  if (old.to_account_id) recalcAccount(old.to_account_id);
  persist();
};

api.account_list = () =>
  all(
    "SELECT id,name,kind,initial_minor,balance_minor,include_in_net,archived,sort_order FROM account ORDER BY archived, sort_order, created_at"
  );

api.account_save = ({ input }) => {
  if (!input.name || !input.name.trim()) throw new Error("账户名不能为空");
  if (input.id) {
    run("UPDATE account SET name=?, kind=?, initial_minor=?, include_in_net=? WHERE id=?", [
      input.name.trim(),
      input.kind,
      input.initial_minor,
      input.include_in_net,
      input.id,
    ]);
    recalcAccount(input.id);
    persist();
    return input.id;
  }
  const id = newId();
  const order = val("SELECT COALESCE(MAX(sort_order),0)+10 v FROM account", [], 10);
  run(
    `INSERT INTO account (id,name,kind,initial_minor,balance_minor,include_in_net,archived,sort_order,created_at)
     VALUES (?,?,?,?,?,?,0,?,?)`,
    [id, input.name.trim(), input.kind, input.initial_minor, input.initial_minor, input.include_in_net, order, nowStr()]
  );
  persist();
  return id;
};

api.account_archive = ({ id, archived }) => {
  run("UPDATE account SET archived=? WHERE id=?", [archived ? 1 : 0, id]);
  persist();
};

api.account_adjust = ({ input }) => {
  const current = val("SELECT balance_minor v FROM account WHERE id=?", [input.id], null);
  if (current === null) throw new Error("账户不存在");
  const diff = input.target_minor - current;
  if (!diff) return;
  run(
    `INSERT INTO txn (id,kind,amount_minor,account_id,to_account_id,category_id,occurred_on,note,created_at,updated_at)
     VALUES (?,3,?,?,NULL,NULL,?,?,?,?)`,
    [newId(), diff, input.id, todayStr(), "余额调整", nowStr(), nowStr()]
  );
  recalcAccount(input.id);
  persist();
};

api.category_list = () =>
  all(
    "SELECT id,parent_id,name,kind,icon,color,sort_order,archived FROM category ORDER BY kind, sort_order, name"
  );

api.category_save = ({ input }) => {
  if (!input.name || !input.name.trim()) throw new Error("分类名不能为空");
  const icon = input.icon || "📦";
  const color = input.color || "#94A3B8";
  if (input.id) {
    run("UPDATE category SET name=?, icon=?, color=? WHERE id=?", [
      input.name.trim(),
      icon,
      color,
      input.id,
    ]);
    persist();
    return input.id;
  }
  const id = newId();
  const order = val(
    "SELECT COALESCE(MAX(sort_order),0)+10 v FROM category WHERE kind=?",
    [input.kind],
    10
  );
  run(
    "INSERT INTO category (id,parent_id,name,kind,icon,color,sort_order,archived) VALUES (?,?,?,?,?,?,?,0)",
    [id, input.parent_id ?? null, input.name.trim(), input.kind, icon, color, order]
  );
  persist();
  return id;
};

api.category_archive = ({ id }) => {
  run("UPDATE category SET archived=1 WHERE id=?", [id]);
  persist();
};

api.budget_list = ({ period }) => {
  const [start, next] = monthBounds(period);
  return all(
    `SELECT b.id, b.period, b.category_id, c.name category_name, b.amount_minor,
            COALESCE((SELECT SUM(t.amount_minor) FROM txn t
              WHERE t.deleted_at IS NULL AND t.kind=0
                AND t.occurred_on >= ? AND t.occurred_on < ?
                AND (b.category_id IS NULL OR t.category_id=b.category_id
                     OR t.category_id IN (SELECT id FROM category WHERE parent_id=b.category_id))
            ),0) used_minor
     FROM budget b LEFT JOIN category c ON c.id=b.category_id
     WHERE b.period=?
     ORDER BY b.category_id IS NOT NULL, b.amount_minor DESC`,
    [start, next, period]
  );
};

api.budget_set = ({ input }) => {
  if (input.amount_minor < 0) throw new Error("预算不能为负");
  run(
    "DELETE FROM budget WHERE period=? AND ((category_id IS NULL AND ? IS NULL) OR category_id=?)",
    [input.period, input.category_id ?? null, input.category_id ?? null]
  );
  if (input.amount_minor > 0) {
    run("INSERT INTO budget (id,period,category_id,amount_minor) VALUES (?,?,?,?)", [
      newId(),
      input.period,
      input.category_id ?? null,
      input.amount_minor,
    ]);
  }
  persist();
};

api.report_summary = ({ range }) => {
  const row = one(
    `SELECT COALESCE(SUM(CASE WHEN kind=0 THEN amount_minor END),0) e,
            COALESCE(SUM(CASE WHEN kind=1 THEN amount_minor END),0) i, COUNT(*) c
     FROM txn WHERE deleted_at IS NULL AND occurred_on BETWEEN ? AND ?`,
    [range.start, range.end]
  );
  return {
    expense_minor: row.e,
    income_minor: row.i,
    net_minor: row.i - row.e,
    count: row.c,
  };
};

api.report_by_category = ({ input }) =>
  all(
    `SELECT top.id, top.name, top.icon, top.color, SUM(t.amount_minor) total_minor
     FROM txn t
     JOIN category c ON c.id=t.category_id
     JOIN category top ON top.id=COALESCE(c.parent_id, c.id)
     WHERE t.deleted_at IS NULL AND t.kind=? AND t.occurred_on BETWEEN ? AND ?
     GROUP BY top.id ORDER BY total_minor DESC`,
    [input.kind ?? KIND_EXPENSE, input.start, input.end]
  );

api.report_trend = ({ range }) =>
  all(
    `SELECT occurred_on date,
            COALESCE(SUM(CASE WHEN kind=0 THEN amount_minor END),0) expense_minor,
            COALESCE(SUM(CASE WHEN kind=1 THEN amount_minor END),0) income_minor
     FROM txn WHERE deleted_at IS NULL AND kind IN (0,1) AND occurred_on BETWEEN ? AND ?
     GROUP BY occurred_on ORDER BY occurred_on`,
    [range.start, range.end]
  );

api.export_rows = ({ start, end }) =>
  all(
    `SELECT t.occurred_on, t.kind, COALESCE(c.name,'') category, a.name account,
            COALESCE(b.name,'') to_account, COALESCE(t.note,'') note, t.amount_minor
     FROM txn t
     JOIN account a ON a.id=t.account_id
     LEFT JOIN account b ON b.id=t.to_account_id
     LEFT JOIN category c ON c.id=t.category_id
     WHERE t.deleted_at IS NULL AND t.occurred_on BETWEEN ? AND ?
     ORDER BY t.occurred_on, t.created_at`,
    [start, end]
  );

function parseAmount(s) {
  const cleaned = String(s).replace(/[^\d.-]/g, "");
  const v = parseFloat(cleaned);
  if (Number.isNaN(v)) return null;
  return Math.round(v * 100);
}
function normalizeDate(s) {
  const m = String(s).trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${pad(+mo)}-${pad(+d)}`;
}

/** rows: 二维数组（含表头），由 main 进程解析 CSV 后传入 */
api.import_rows = ({ rows, account_id }) => {
  const result = { total: 0, imported: 0, duplicate: 0, invalid: 0, messages: [] };
  if (!rows.length) return result;
  const headers = rows[0].map((h) => String(h).trim());
  const find = (keys) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
  const iDate = find(["交易时间", "日期", "时间"]);
  const iAmount = find(["金额"]);
  const iDir = find(["收/支", "收支", "类型"]);
  const iItem = find(["商品说明", "商品", "备注", "摘要"]);
  const iParty = find(["交易对方", "对方"]);
  if (iDate < 0 || iAmount < 0) throw new Error("找不到「时间」或「金额」列，请确认文件是账单 CSV");

  const defaultCat = one(
    "SELECT id FROM category WHERE kind=0 AND parent_id IS NOT NULL ORDER BY sort_order LIMIT 1"
  );

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    result.total += 1;
    const cell = (idx) => (idx >= 0 && r[idx] !== undefined ? String(r[idx]).trim() : "");
    const dir = cell(iDir);
    if (dir.includes("不计")) {
      result.invalid += 1;
      continue;
    }
    const date = normalizeDate(cell(iDate));
    const amount = parseAmount(cell(iAmount));
    if (!date || !amount) {
      result.invalid += 1;
      continue;
    }
    const kind = dir.includes("收入") || dir === "收" ? KIND_INCOME : KIND_EXPENSE;
    const party = cell(iParty);
    const item = cell(iItem);
    const note = [party, item].filter(Boolean).join(" ");
    const fp = `${date}|${Math.abs(amount)}|${kind}|${note}`;
    if (val("SELECT COUNT(*) c FROM import_fingerprint WHERE fingerprint=?", [fp])) {
      result.duplicate += 1;
      continue;
    }
    const id = newId();
    run(
      `INSERT INTO txn (id,kind,amount_minor,account_id,to_account_id,category_id,occurred_on,note,created_at,updated_at)
       VALUES (?,?,?,?,NULL,?,?,?,?,?)`,
      [id, kind, Math.abs(amount), account_id, kind === KIND_EXPENSE ? defaultCat?.id ?? null : null, date, note, nowStr(), nowStr()]
    );
    run("INSERT INTO import_fingerprint (fingerprint,txn_id) VALUES (?,?)", [fp, id]);
    result.imported += 1;
  }
  recalcAccount(account_id);
  persistNow();

  if (result.imported) result.messages.push(`已导入 ${result.imported} 条。导入后请到「明细」检查分类，可逐条修改。`);
  if (result.duplicate) result.messages.push(`跳过 ${result.duplicate} 条重复记录。`);
  if (result.invalid) result.messages.push(`${result.invalid} 条无法识别（不影响其他记录）。`);
  return result;
};

api.settings_get = () => {
  const s = { nickname: "鱼片", theme: "light", mascot: "on", motion: "on" };
  all("SELECT key,value FROM setting").forEach((r) => {
    if (r.key in s) s[r.key] = r.value;
  });
  return s;
};

api.settings_set = ({ input }) => {
  ["nickname", "theme", "mascot", "motion"].forEach((k) => {
    run(
      "INSERT INTO setting (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [k, String(input[k] ?? "")]
    );
  });
  persist();
};

api.stats = () => ({
  txn_count: val("SELECT COUNT(*) c FROM txn WHERE deleted_at IS NULL"),
  account_count: val("SELECT COUNT(*) c FROM account WHERE archived=0"),
  category_count: val("SELECT COUNT(*) c FROM category WHERE archived=0"),
});

module.exports = {
  init,
  reload,
  autoBackup,
  api,
  persistNow,
  monthBounds,
  KIND_EXPENSE,
  KIND_INCOME,
};
