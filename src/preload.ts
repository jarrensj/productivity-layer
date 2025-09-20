// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:write-text', text),
    readText: () => ipcRenderer.invoke('clipboard:read-text'),
    saveClipboardItem: (text: string, items: any[]) => ipcRenderer.invoke('clipboard:save-item', text, items),
    getSavedItems: () => ipcRenderer.invoke('clipboard:get-items'),
    deleteItem: (id: string, items: any[]) => ipcRenderer.invoke('clipboard:delete-item', id, items),
    clearAll: () => ipcRenderer.invoke('clipboard:clear-all'),
  },
  grammar: {
    checkGrammar: (text: string) => ipcRenderer.invoke('grammar:check', text),
  },
  links: {
    saveLink: (name: string, url: string, items: any[]) => ipcRenderer.invoke('links:save-item', name, url, items),
    getSavedLinks: () => ipcRenderer.invoke('links:get-items'),
    deleteLink: (id: string, items: any[]) => ipcRenderer.invoke('links:delete-item', id, items),
    clearAllLinks: () => ipcRenderer.invoke('links:clear-all'),
    openLink: (url: string) => ipcRenderer.invoke('links:open-link', url),
  },
  tasks: {
    saveTask: (text: string, items: any[]) => ipcRenderer.invoke('tasks:save-item', text, items),
    getSavedTasks: () => ipcRenderer.invoke('tasks:get-items'),
    updateTask: (id: string, updates: any, items: any[]) => ipcRenderer.invoke('tasks:update-item', id, updates, items),
    deleteTask: (id: string, items: any[]) => ipcRenderer.invoke('tasks:delete-item', id, items),
    clearAllTasks: () => ipcRenderer.invoke('tasks:clear-all'),
  },
  window: {
    setOpacity: (opacity: number) => ipcRenderer.invoke('window:set-opacity', opacity),
    close: () => ipcRenderer.invoke('chat-window:close'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    restore: () => ipcRenderer.invoke('window:restore'),
    chatMinimize: () => ipcRenderer.invoke('chat-window:minimize'),
    chatMaximize: () => ipcRenderer.invoke('chat-window:maximize'),
  },
  chat: {
    openWindow: (initialMessage?: string) => ipcRenderer.invoke('chat:open-window', initialMessage),
    sendMessage: (message: string, conversationHistory: any[]) => ipcRenderer.invoke('chat:send-message', message, conversationHistory),
    onInitialMessage: (callback: (message: string) => void) => ipcRenderer.on('initial-message', (event, message) => callback(message)),
  },
});
