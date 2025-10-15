"use strict";
// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose APIs to renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    clipboard: {
        writeText: (text) => electron_1.ipcRenderer.invoke('clipboard:write-text', text),
        readText: () => electron_1.ipcRenderer.invoke('clipboard:read-text'),
        saveClipboardItem: (text, items) => electron_1.ipcRenderer.invoke('clipboard:save-item', text, items),
        getSavedItems: () => electron_1.ipcRenderer.invoke('clipboard:get-items'),
        deleteItem: (id, items) => electron_1.ipcRenderer.invoke('clipboard:delete-item', id, items),
        clearAll: () => electron_1.ipcRenderer.invoke('clipboard:clear-all'),
    },
    grammar: {
        checkGrammar: (text) => electron_1.ipcRenderer.invoke('grammar:check', text),
    },
    links: {
        saveLink: (name, url, items) => electron_1.ipcRenderer.invoke('links:save-item', name, url, items),
        getSavedLinks: () => electron_1.ipcRenderer.invoke('links:get-items'),
        deleteLink: (id, items) => electron_1.ipcRenderer.invoke('links:delete-item', id, items),
        clearAllLinks: () => electron_1.ipcRenderer.invoke('links:clear-all'),
        openLink: (url) => electron_1.ipcRenderer.invoke('links:open-link', url),
    },
    tasks: {
        saveTask: (text, items) => electron_1.ipcRenderer.invoke('tasks:save-item', text, items),
        getSavedTasks: () => electron_1.ipcRenderer.invoke('tasks:get-items'),
        updateTask: (id, updates, items) => electron_1.ipcRenderer.invoke('tasks:update-item', id, updates, items),
        deleteTask: (id, items) => electron_1.ipcRenderer.invoke('tasks:delete-item', id, items),
        clearAllTasks: () => electron_1.ipcRenderer.invoke('tasks:clear-all'),
    },
    window: {
        setOpacity: (opacity) => electron_1.ipcRenderer.invoke('window:set-opacity', opacity),
        close: () => electron_1.ipcRenderer.invoke('chat-window:close'),
        minimize: () => electron_1.ipcRenderer.invoke('chat-window:minimize'),
        maximize: () => electron_1.ipcRenderer.invoke('chat-window:maximize'),
    },
    chat: {
        openWindow: (initialMessage) => electron_1.ipcRenderer.invoke('chat:open-window', initialMessage),
        sendMessage: (message, conversationHistory) => electron_1.ipcRenderer.invoke('chat:send-message', message, conversationHistory),
        onInitialMessage: (callback) => electron_1.ipcRenderer.on('initial-message', (event, message) => callback(message)),
    },
    images: {
        generateImage: (prompt, imageData) => electron_1.ipcRenderer.invoke('images:generate', prompt, imageData),
    },
    app: {
        clearResetApp: () => electron_1.ipcRenderer.invoke('app:clear-reset'),
    },
});
//# sourceMappingURL=preload.js.map