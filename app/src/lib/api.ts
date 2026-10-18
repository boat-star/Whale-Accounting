import { call } from "./bridge";
import type {
  AccountView,
  AppSettings,
  BackupItem,
  BudgetView,
  CategoryStat,
  CategoryView,
  DataStats,
  ImportResult,
  Overview,
  Summary,
  TrendPoint,
  TxnFilter,
  TxnInput,
  TxnView,
} from "./types";

export const api = {
  overview: (month: string) => call<Overview>("overview", { month }),
  txnList: (filter: TxnFilter) => call<TxnView[]>("txn_list", { filter }),
  txnCreate: (input: TxnInput) => call<string>("txn_create", { input }),
  txnUpdate: (input: TxnInput & { id: string }) => call<void>("txn_update", { input }),
  txnDelete: (id: string) => call<void>("txn_delete", { id }),

  accountList: () => call<AccountView[]>("account_list"),
  accountSave: (input: {
    id?: string | null;
    name: string;
    kind: number;
    initial_minor: number;
    include_in_net: number;
  }) => call<string>("account_save", { input }),
  accountArchive: (id: string, archived: boolean) =>
    call<void>("account_archive", { id, archived }),
  accountAdjust: (input: { id: string; target_minor: number }) =>
    call<void>("account_adjust", { input }),

  categoryList: () => call<CategoryView[]>("category_list"),
  categorySave: (input: {
    id?: string | null;
    parent_id?: string | null;
    name: string;
    kind: number;
    icon?: string | null;
    color?: string | null;
  }) => call<string>("category_save", { input }),
  categoryArchive: (id: string) => call<void>("category_archive", { id }),

  budgetList: (period: string) => call<BudgetView[]>("budget_list", { period }),
  budgetSet: (input: { period: string; category_id: string | null; amount_minor: number }) =>
    call<void>("budget_set", { input }),

  reportSummary: (range: { start: string; end: string }) =>
    call<Summary>("report_summary", { range }),
  reportByCategory: (input: { start: string; end: string; kind?: number | null }) =>
    call<CategoryStat[]>("report_by_category", { input }),
  reportTrend: (range: { start: string; end: string }) =>
    call<TrendPoint[]>("report_trend", { range }),

  exportCsv: (input: { path: string; start: string; end: string }) =>
    call<number>("export_csv", { input }),
  importCsv: (input: { path: string; account_id: string }) =>
    call<ImportResult>("import_csv", { input }),

  backupCreate: () => call<string>("backup_create"),
  backupList: () => call<BackupItem[]>("backup_list"),
  settingsGet: () => call<AppSettings>("settings_get"),
  settingsSet: (input: AppSettings) => call<void>("settings_set", { input }),
  dataStats: () => call<DataStats>("data_stats"),
  openDataDir: () => call<boolean>("open_data_dir"),
};
