export interface BridgeApi {
  call: (cmd: string, args?: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  dialogSave: (opts?: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<string | null>;
  dialogOpen: (opts?: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<string | null>;
}

declare global {
  interface Window {
    api: BridgeApi;
  }
}

export async function call<T>(cmd: string, args?: unknown): Promise<T> {
  const res = await window.api.call(cmd, args);
  if (!res.ok) throw new Error(res.error || "操作失败");
  return res.data as T;
}

export const saveFile = (opts?: Parameters<BridgeApi["dialogSave"]>[0]) =>
  window.api.dialogSave(opts);

export const openFile = (opts?: Parameters<BridgeApi["dialogOpen"]>[0]) =>
  window.api.dialogOpen(opts);
