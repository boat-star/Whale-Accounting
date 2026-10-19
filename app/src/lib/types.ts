export type Kind = 0 | 1 | 2 | 3;

export interface Overview {
  month_expense_minor: number;
  month_income_minor: number;
  today_expense_minor: number;
  asset_minor: number;
  liability_minor: number;
  net_asset_minor: number;
  txn_count: number;
  month: string;
}

export interface TxnView {
  id: string;
  kind: number;
  amount_minor: number;
  account_id: string;
  account_name: string;
  to_account_id: string | null;
  to_account_name: string | null;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  occurred_on: string;
  note: string | null;
  created_at: string;
}

export interface TxnInput {
  kind: number;
  amount_minor: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  occurred_on: string;
  note: string | null;
}

export interface AccountView {
  id: string;
  name: string;
  kind: number;
  initial_minor: number;
  balance_minor: number;
  include_in_net: number;
  archived: number;
  sort_order: number;
}

export interface CategoryView {
  id: string;
  parent_id: string | null;
  name: string;
  kind: number;
  icon: string;
  color: string;
  sort_order: number;
  archived: number;
}

export interface BudgetView {
  id: string;
  period: string;
  category_id: string | null;
  category_name: string | null;
  amount_minor: number;
  used_minor: number;
}

export interface Summary {
  expense_minor: number;
  income_minor: number;
  net_minor: number;
  count: number;
}

export interface CategoryStat {
  id: string;
  name: string;
  icon: string;
  color: string;
  total_minor: number;
}

export interface TrendPoint {
  date: string;
  expense_minor: number;
  income_minor: number;
}

export interface AppSettings {
  nickname: string;
  theme: string;
  mascot: string;
  motion: string;
}

export interface DataStats {
  txn_count: number;
  account_count: number;
  category_count: number;
  db_size_kb: number;
  data_dir: string;
  backup_dir: string;
}

export interface BackupItem {
  name: string;
  path: string;
  size_kb: number;
  created_at: string;
}

export interface ImportResult {
  total: number;
  imported: number;
  duplicate: number;
  invalid: number;
  messages: string[];
}

export interface TxnFilter {
  start: string;
  end: string;
  kind?: number | null;
  category_id?: string | null;
  account_id?: string | null;
  keyword?: string | null;
  limit?: number | null;
}
