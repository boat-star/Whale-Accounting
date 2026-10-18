export function fmtMoney(minor: number, withSign = false): string {
  const v = minor / 100;
  const s = Math.abs(v).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = v < 0 ? "-" : withSign && v > 0 ? "+" : "";
  return `${sign}¥${s}`;
}

export function fmtMoneyShort(minor: number): string {
  const v = Math.abs(minor) / 100;
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`;
  return `¥${v.toFixed(0)}`;
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${pad(last)}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const now = new Date();
  if (Number(y) === now.getFullYear()) return `${Number(m)} 月`;
  return `${y} 年 ${Number(m)} 月`;
}

/** 支持 12.5+8、30-5 这类简单表达式（需求 FR-01-02） */
export function evalAmount(raw: string): number {
  const s = raw.replace(/[¥￥,\s]/g, "");
  if (!s) return 0;
  if (/^[\d.]+$/.test(s)) return Math.round(parseFloat(s) * 100);
  const parts = s.match(/[+-]?[\d.]+/g);
  if (!parts) return 0;
  let sum = 0;
  for (const p of parts) {
    const v = parseFloat(p);
    if (!Number.isNaN(v)) sum += v;
  }
  return Math.round(sum * 100);
}

export function weekdayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
}

export function dayLabel(dateStr: string): string {
  const t = todayStr();
  if (dateStr === t) return "今天";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const ys = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
  if (dateStr === ys) return "昨天";
  const [, m, d] = dateStr.split("-");
  return `${Number(m)} 月 ${Number(d)} 日`;
}

export const KIND_EXPENSE = 0;
export const KIND_INCOME = 1;
export const KIND_TRANSFER = 2;
export const KIND_ADJUST = 3;

export const ACCOUNT_KINDS: { value: number; label: string; icon: string }[] = [
  { value: 0, label: "现金", icon: "💵" },
  { value: 1, label: "储蓄卡", icon: "💳" },
  { value: 2, label: "信用卡", icon: "🪙" },
  { value: 3, label: "第三方支付", icon: "📱" },
  { value: 4, label: "投资", icon: "📈" },
  { value: 5, label: "借款", icon: "📄" },
];

export function accountIcon(kind: number): string {
  return ACCOUNT_KINDS.find((k) => k.value === kind)?.icon ?? "💳";
}

export function accountKindLabel(kind: number): string {
  return ACCOUNT_KINDS.find((k) => k.value === kind)?.label ?? "账户";
}
