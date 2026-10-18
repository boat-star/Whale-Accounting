import { createContext, useContext } from "react";
import type { AccountView, AppSettings, CategoryView, TxnView } from "./types";

export interface AppCtx {
  month: string;
  setMonth: (m: string) => void;
  accounts: AccountView[];
  categories: CategoryView[];
  settings: AppSettings;
  saveSettings: (s: AppSettings) => Promise<void>;
  version: number;
  bump: () => void;
  toast: (msg: string, isError?: boolean) => void;
  openTxn: (txn?: TxnView | null, kind?: number) => void;
  reload: () => void;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("AppContext missing");
  return ctx;
}
