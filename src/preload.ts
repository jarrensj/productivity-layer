// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

interface ClipboardItem {
  id: string;
  text: string;
  timestamp: number;
}

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:write-text', text),
    readText: () => ipcRenderer.invoke('clipboard:read-text'),
    saveClipboardItem: (text: string, items: ClipboardItem[]) => ipcRenderer.invoke('clipboard:save-item', text, items),
    getSavedItems: () => ipcRenderer.invoke('clipboard:get-items'),
    deleteItem: (id: string, items: ClipboardItem[]) => ipcRenderer.invoke('clipboard:delete-item', id, items),
    clearAll: () => ipcRenderer.invoke('clipboard:clear-all'),
  },
  grammar: {
    checkGrammar: (text: string) => ipcRenderer.invoke('grammar:check', text),
  },
  chat: {
    sendMessage: (message: string) => ipcRenderer.invoke('chat:send-message', message),
    createChatWindow: (message: string, response: string) => ipcRenderer.invoke('chat:create-window', message, response),
    sendChatMessage: (conversationId: string, message: string) => ipcRenderer.invoke('chat:send-message-to-conversation', conversationId, message),
  },
  closeWindow: () => ipcRenderer.invoke('window:close'),
});
