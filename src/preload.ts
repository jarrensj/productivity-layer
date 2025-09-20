// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Expose clipboard API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:write-text', text),
    readText: () => ipcRenderer.invoke('clipboard:read-text'),
    saveClipboardItem: (text: string, items: any[]) => ipcRenderer.invoke('clipboard:save-item', text, items),
    getSavedItems: () => ipcRenderer.invoke('clipboard:get-items'),
    deleteItem: (id: string, items: any[]) => ipcRenderer.invoke('clipboard:delete-item', id, items),
    clearAll: () => ipcRenderer.invoke('clipboard:clear-all'),
  },
});
