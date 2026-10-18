/* 生成演示数据：node scripts/seed-demo.cjs <目标目录> */
const path = require("path");
const db = require("../electron/db.cjs");

(async () => {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: node scripts/seed-demo.cjs <dir>");
    process.exit(1);
  }
  await db.init(path.join(dir, "whale.db"), path.join(__dirname, "..", "node_modules", "sql.js", "dist"));

  const accounts = await db.api.account_list();
  const cats = await db.api.category_list();
  const acc = (n) => accounts.find((a) => a.name === n).id;
  const cat = (n, parent) => {
    if (parent) {
      const p = cats.find((c) => c.name === parent && !c.parent_id);
      return cats.find((c) => c.name === n && c.parent_id === p.id).id;
    }
    return cats.find((c) => c.name === n && !c.parent_id).id;
  };

  // 初始余额
  const seeds = [
    ["银行卡", 1268000],
    ["微信", 186000],
    ["支付宝", 94000],
    ["现金", 30000],
  ];
  for (const [name, init] of seeds) {
    const a = accounts.find((x) => x.name === name);
    await db.api.account_save({
      input: { id: a.id, name, kind: a.kind, initial_minor: init, include_in_net: 1 },
    });
  }

  const rows = [
    ["2026-10-01", 0, 2800, "微信", "餐饮", "早餐", "楼下包子豆浆"],
    ["2026-10-01", 0, 4600, "支付宝", "交通", "打车", "加班打车回家"],
    ["2026-10-02", 0, 12800, "微信", "餐饮", "外卖", "黄焖鸡米饭"],
    ["2026-10-02", 0, 2600, "微信", "餐饮", "零食饮料", "瑞幸生椰拿铁"],
    ["2026-10-03", 0, 15800, "支付宝", "娱乐", "电影", "电影票两张"],
    ["2026-10-04", 0, 320000, "银行卡", "居住", "房租", "十月房租"],
    ["2026-10-05", 0, 8900, "微信", "餐饮", "午餐", "公司楼下快餐"],
    ["2026-10-05", 0, 15600, "银行卡", "居住", "水电燃气", "水电燃气费"],
    ["2026-10-06", 0, 39900, "支付宝", "购物", "服饰", "换季买了件外套"],
    ["2026-10-07", 0, 6800, "微信", "餐饮", "晚餐", "和同事吃面"],
    ["2026-10-08", 0, 1200, "微信", "交通", "公交地铁", "地铁通勤"],
    ["2026-10-09", 0, 5900, "支付宝", "学习", "书籍", "一本技术书"],
    ["2026-10-10", 1, 1280000, "银行卡", "工资", null, "十月工资"],
    ["2026-10-10", 0, 23800, "微信", "餐饮", "外卖", "周末点了份烧烤"],
    ["2026-10-11", 0, 12900, "支付宝", "购物", "日用品", "纸巾洗衣液"],
    ["2026-10-12", 0, 3000, "微信", "交通", "公交地铁", "地铁通勤"],
    ["2026-10-13", 0, 5800, "微信", "餐饮", "午餐", "沙县小吃"],
    ["2026-10-14", 0, 26800, "微信", "娱乐", "游戏", "手游充值"],
    ["2026-10-15", 0, 4600, "支付宝", "餐饮", "零食饮料", "奶茶和蛋糕"],
    ["2026-10-16", 0, 8800, "微信", "餐饮", "晚餐", "小火锅"],
    ["2026-10-17", 0, 19900, "支付宝", "人情", "送礼", "朋友生日礼物"],
    ["2026-10-18", 0, 1800, "微信", "餐饮", "早餐", "豆浆油条"],
  ];

  for (const [date, kind, amount, account, top, sub, note] of rows) {
    await db.api.txn_create({
      input: {
        kind,
        amount_minor: amount,
        account_id: acc(account),
        to_account_id: null,
        category_id: sub ? cat(sub, top) : cat(top),
        occurred_on: date,
        note,
      },
    });
  }

  // 转账：银行卡 → 微信 500
  await db.api.txn_create({
    input: {
      kind: 2,
      amount_minor: 50000,
      account_id: acc("银行卡"),
      to_account_id: acc("微信"),
      category_id: null,
      occurred_on: "2026-10-12",
      note: "生活费转微信",
    },
  });

  await db.api.budget_set({
    input: { period: "2026-10", category_id: null, amount_minor: 700000 },
  });
  await db.api.budget_set({
    input: { period: "2026-10", category_id: cat("餐饮"), amount_minor: 150000 },
  });

  db.persistNow();
  console.log("demo data ready:", dir);
})();
