const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  call: (cmd, args) => ipcRenderer.invoke("api", { cmd, args }),
  dialogSave: (opts) => ipcRenderer.invoke("dialog:save", opts),
  dialogOpen: (opts) => ipcRenderer.invoke("dialog:open", opts),
});
