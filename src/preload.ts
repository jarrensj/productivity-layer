// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Expose clipboard API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:write-text', text),
    readText: () => ipcRenderer.invoke('clipboard:read-text'),
    saveClipboardItem: (text: string) => ipcRenderer.invoke('clipboard:save-item', text),
    getSavedItems: () => ipcRenderer.invoke('clipboard:get-items'),
    deleteItem: (id: string) => ipcRenderer.invoke('clipboard:delete-item', id),
    clearAll: () => ipcRenderer.invoke('clipboard:clear-all'),
  },
});
