"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const electron_squirrel_startup_1 = __importDefault(require("electron-squirrel-startup"));
const crypto_1 = require("crypto");
const openai_1 = __importDefault(require("openai"));
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (electron_squirrel_startup_1.default) {
    electron_1.app.quit();
}
const createWindow = () => {
    // Create the browser window.
    const mainWindow = new electron_1.BrowserWindow({
        width: 400,
        height: 500,
        alwaysOnTop: true,
        frame: false,
        transparent: true,
        opacity: 0.8,
        resizable: false,
        movable: true,
        skipTaskbar: true,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    // Position the window in the top-right corner
    const primaryDisplay = electron_1.screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    mainWindow.setPosition(screenWidth - 400, 0);
    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    }
    else {
        mainWindow.loadFile(node_path_1.default.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
};
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
electron_1.app.on('ready', createWindow);
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
let savedClipboardItems = [];
let savedLinkItems = [];
let savedTaskItems = [];
let chatWindow = null;
// Initialize OpenAI client
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
// Create chat window function
const createChatWindow = (initialMessage) => {
    if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.focus();
        // If there's an initial message and window already exists, send it
        if (initialMessage) {
            chatWindow.webContents.send('initial-message', initialMessage);
        }
        return;
    }
    chatWindow = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        frame: false,
        transparent: true,
        resizable: true,
        movable: true,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    // Load the chat window HTML
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        chatWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/chat-window.html`);
    }
    else {
        chatWindow.loadFile(node_path_1.default.join(__dirname, '../renderer/chat-window.html'));
    }
    // Send initial message once the window is ready
    if (initialMessage) {
        chatWindow.webContents.once('dom-ready', () => {
            chatWindow.webContents.send('initial-message', initialMessage);
        });
    }
    // Handle window closed
    chatWindow.on('closed', () => {
        chatWindow = null;
    });
};
// IPC handlers for clipboard operations
electron_1.ipcMain.handle('clipboard:write-text', (event, text) => {
    electron_1.clipboard.writeText(text);
    return true;
});
electron_1.ipcMain.handle('clipboard:read-text', () => {
    return electron_1.clipboard.readText();
});
electron_1.ipcMain.handle('clipboard:save-item', (event, text, items) => {
    // Update the main process array with the current items from renderer
    savedClipboardItems = items || savedClipboardItems;
    // Check if item already exists to avoid duplicates
    const existingItem = savedClipboardItems.find(item => item.text === text);
    if (existingItem) {
        // Return the existing item with a flag indicating it's a duplicate
        return { items: savedClipboardItems, savedItem: { ...existingItem, isDuplicate: true } };
    }
    const newItem = {
        id: (0, crypto_1.randomUUID)(),
        text,
        timestamp: Date.now(),
    };
    // Add to beginning of array (most recent first)
    savedClipboardItems.unshift(newItem);
    // Limit to 50 items to prevent memory issues
    if (savedClipboardItems.length > 50) {
        savedClipboardItems = savedClipboardItems.slice(0, 50);
    }
    return { items: savedClipboardItems, savedItem: newItem };
});
electron_1.ipcMain.handle('clipboard:get-items', () => {
    return savedClipboardItems;
});
electron_1.ipcMain.handle('clipboard:delete-item', (event, id, items) => {
    // Update the main process array with the current items from renderer
    savedClipboardItems = items || savedClipboardItems;
    savedClipboardItems = savedClipboardItems.filter(item => item.id !== id);
    return savedClipboardItems;
});
electron_1.ipcMain.handle('clipboard:clear-all', () => {
    savedClipboardItems = [];
    return savedClipboardItems;
});
// Images generation with Gemini
electron_1.ipcMain.handle('images:generate', async (event, prompt, imageData) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return {
                success: false,
                error: 'Gemini API key not configured. Please add GEMINI_API_KEY to your .env file.'
            };
        }
        // Convert image data URL to base64 (remove data:image/...;base64, prefix)
        const base64Image = imageData.split(',')[1];
        const mimeType = imageData.split(';')[0].split(':')[1];
        // Build the parts array - always include text, optionally include image
        const parts = [{ text: prompt }];
        if (base64Image && mimeType) {
            parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: base64Image
                }
            });
        }
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: parts
                    }
                ]
            })
        });
        const data = await response.json();
        if (!response.ok) {
            return {
                success: false,
                error: `API call failed: ${JSON.stringify(data)}`
            };
        }
        // Extract base64 image data if present
        let extractedImageData = null;
        // First check: direct data field (matches curl command expectation)
        if (data.data) {
            extractedImageData = data.data;
        }
        // Second check: candidates response structure
        else if (data.candidates?.[0]?.content?.parts) {
            for (const part of data.candidates[0].content.parts) {
                if (part.inlineData?.data) {
                    extractedImageData = part.inlineData.data;
                    break;
                }
                if (part.inline_data?.data) {
                    extractedImageData = part.inline_data.data;
                    break;
                }
            }
        }
        if (extractedImageData) {
            const generatedImageData = `data:image/png;base64,${extractedImageData}`;
            return {
                success: true,
                type: 'image',
                result: generatedImageData
            };
        }
        else {
            // Check for text response (fallback for analysis)
            const candidate = data.candidates?.[0];
            const generatedText = candidate?.content?.parts?.[0]?.text || "No response generated";
            return {
                success: true,
                type: 'text',
                result: generatedText
            };
        }
    }
    catch (error) {
        console.error('Gemini API error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
});
// Grammar checking with OpenAI
electron_1.ipcMain.handle('grammar:check', async (event, text) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not found. Please add OPENAI_API_KEY to your .env file.');
        }
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "user",
                    content: `Check the grammar of this sentence and specifically look for:
1. Words that should be written as one word or two words (like "everyday" vs "every day", "into" vs "in to", "cannot" vs "can not", "maybe" vs "may be", etc.)
2. Words that should be hyphenated or not hyphenated (like "well-known" vs "well known", "twenty-one" vs "twenty one", "self-aware" vs "self aware", "up-to-date" vs "up to date", compound adjectives, etc.)

For each correction you suggest, please explain why the correction is needed and provide the reasoning behind the grammar rule.

Text to check: "${text}"`
                }
            ],
            max_tokens: 500,
            temperature: 0.3,
        });
        return {
            success: true,
            result: completion.choices[0]?.message?.content || "Sorry, I couldn't analyze your text right now. Please try again."
        };
    }
    catch (error) {
        console.error('Grammar check error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
});
// Links management handlers
electron_1.ipcMain.handle('links:save-item', (event, name, url, items) => {
    // Update the main process array with the current items from renderer
    savedLinkItems = items || savedLinkItems;
    let normalizedUrl = url.trim();
    if (!normalizedUrl || normalizedUrl.length < 3) {
        return {
            success: false,
            error: 'Please enter a valid URL.'
        };
    }
    let hostnameToValidate = normalizedUrl;
    if (normalizedUrl.startsWith('http://')) {
        hostnameToValidate = normalizedUrl.substring(7);
    }
    else if (normalizedUrl.startsWith('https://')) {
        hostnameToValidate = normalizedUrl.substring(8);
    }
    hostnameToValidate = hostnameToValidate.split('/')[0].split(':')[0];
    const isValidDomain = (hostname) => {
        if (hostname === 'localhost') {
            return true;
        }
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipRegex.test(hostname)) {
            return true;
        }
        if (!hostname.includes('.')) {
            return false;
        }
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
        if (!domainRegex.test(hostname)) {
            return false;
        }
        const parts = hostname.split('.');
        const tld = parts[parts.length - 1];
        if (tld.length < 2) {
            return false;
        }
        return true;
    };
    if (!isValidDomain(hostnameToValidate)) {
        return {
            success: false,
            error: 'Invalid domain name".'
        };
    }
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
    }
    try {
        const urlObj = new URL(normalizedUrl);
        normalizedUrl = urlObj.toString();
    }
    catch (error) {
        return {
            success: false,
            error: 'Invalid URL format.'
        };
    }
    // Check if link already exists to avoid duplicates
    const existingItem = savedLinkItems.find(item => item.url === normalizedUrl);
    if (existingItem) {
        return { items: savedLinkItems, savedItem: { ...existingItem, isDuplicate: true } };
    }
    const newItem = {
        id: (0, crypto_1.randomUUID)(),
        name,
        url: normalizedUrl,
        timestamp: Date.now(),
    };
    // Add to beginning of array (most recent first)
    savedLinkItems.unshift(newItem);
    // Limit to 50 items to prevent memory issues
    if (savedLinkItems.length > 50) {
        savedLinkItems = savedLinkItems.slice(0, 50);
    }
    return { items: savedLinkItems, savedItem: newItem };
});
electron_1.ipcMain.handle('links:get-items', () => {
    return savedLinkItems;
});
electron_1.ipcMain.handle('links:delete-item', (event, id, items) => {
    // Update the main process array with the current items from renderer
    savedLinkItems = items || savedLinkItems;
    savedLinkItems = savedLinkItems.filter(item => item.id !== id);
    return savedLinkItems;
});
electron_1.ipcMain.handle('links:clear-all', () => {
    savedLinkItems = [];
    return savedLinkItems;
});
electron_1.ipcMain.handle('links:open-link', async (event, url) => {
    try {
        await electron_1.shell.openExternal(url);
        return { success: true };
    }
    catch (error) {
        console.error('Failed to open link:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to open link'
        };
    }
});
// Tasks management handlers
electron_1.ipcMain.handle('tasks:save-item', (event, text, items) => {
    // Update the main process array with the current items from renderer
    savedTaskItems = items || savedTaskItems;
    const newItem = {
        id: (0, crypto_1.randomUUID)(),
        text,
        completed: false,
        timestamp: Date.now(),
    };
    // Add to beginning of array (most recent first)
    savedTaskItems.unshift(newItem);
    // Limit to 100 items to prevent memory issues
    if (savedTaskItems.length > 100) {
        savedTaskItems = savedTaskItems.slice(0, 100);
    }
    return { items: savedTaskItems, savedItem: newItem };
});
electron_1.ipcMain.handle('tasks:get-items', () => {
    return savedTaskItems;
});
electron_1.ipcMain.handle('tasks:update-item', (event, id, updates, items) => {
    // Update the main process array with the current items from renderer
    savedTaskItems = items || savedTaskItems;
    const itemIndex = savedTaskItems.findIndex(item => item.id === id);
    if (itemIndex !== -1) {
        savedTaskItems[itemIndex] = { ...savedTaskItems[itemIndex], ...updates };
    }
    return savedTaskItems;
});
electron_1.ipcMain.handle('tasks:delete-item', (event, id, items) => {
    // Update the main process array with the current items from renderer
    savedTaskItems = items || savedTaskItems;
    savedTaskItems = savedTaskItems.filter(item => item.id !== id);
    return savedTaskItems;
});
electron_1.ipcMain.handle('tasks:clear-all', () => {
    savedTaskItems = [];
    return savedTaskItems;
});
// Window opacity handler
electron_1.ipcMain.handle('window:set-opacity', (event, opacity) => {
    try {
        const window = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (window) {
            // Ensure opacity is within valid range (0.1 to 1.0)
            const normalizedOpacity = Math.max(0.1, Math.min(1.0, opacity / 100));
            window.setOpacity(normalizedOpacity);
            return { success: true };
        }
        return { success: false, error: 'Window not found' };
    }
    catch (error) {
        console.error('Failed to set opacity:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to set opacity'
        };
    }
});
// Chat window handlers
electron_1.ipcMain.handle('chat:open-window', (event, initialMessage) => {
    createChatWindow(initialMessage);
    return { success: true };
});
electron_1.ipcMain.handle('chat:send-message', async (event, message, conversationHistory) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not found. Please add OPENAI_API_KEY to your .env file.');
        }
        // Convert conversation history to OpenAI format
        const messages = [
            {
                role: "system",
                content: "You are a helpful AI assistant. Provide clear, concise, and helpful responses. Be friendly and conversational while being informative."
            },
            ...conversationHistory
                .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                .slice(-10) // Keep only last 10 messages for context
                .map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        ];
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            max_tokens: 1000,
            temperature: 0.7,
        });
        return {
            success: true,
            result: completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response right now. Please try again."
        };
    }
    catch (error) {
        console.error('Chat error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
});
// Chat window control handlers
electron_1.ipcMain.handle('chat-window:close', (event) => {
    const window = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.close();
    }
});
electron_1.ipcMain.handle('chat-window:minimize', (event) => {
    const window = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.minimize();
    }
});
electron_1.ipcMain.handle('chat-window:maximize', (event) => {
    const window = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (window) {
        if (window.isMaximized()) {
            window.unmaximize();
        }
        else {
            window.maximize();
        }
    }
});
// App reset handler
electron_1.ipcMain.handle('app:clear-reset', () => {
    try {
        // Clear all stored data
        savedClipboardItems = [];
        savedLinkItems = [];
        savedTaskItems = [];
        return { success: true };
    }
    catch (error) {
        console.error('Failed to reset app data:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to reset app data'
        };
    }
});
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
//# sourceMappingURL=main.js.map