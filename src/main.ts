import { app, BrowserWindow, screen, clipboard, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { ChatWindowManager } from './chat/ChatWindowManager';

// Load environment variables
dotenv.config();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
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
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Position the window in the top-right corner
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  
  mainWindow.setPosition(screenWidth - 400, 0);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clipboard storage
interface ClipboardItem {
  id: string;
  text: string;
  timestamp: number;
}

let savedClipboardItems: ClipboardItem[] = [];

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// IPC handlers for clipboard operations
ipcMain.handle('clipboard:write-text', (event, text: string) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('clipboard:read-text', () => {
  return clipboard.readText();
});

ipcMain.handle('clipboard:save-item', (event, text: string, items: ClipboardItem[]) => {
  // Update the main process array with the current items from renderer
  savedClipboardItems = items || savedClipboardItems;
  
  // Check if item already exists to avoid duplicates
  const existingItem = savedClipboardItems.find(item => item.text === text);
  if (existingItem) {
    // Return the existing item with a flag indicating it's a duplicate
    return { items: savedClipboardItems, savedItem: { ...existingItem, isDuplicate: true } };
  }

  const newItem: ClipboardItem = {
    id: randomUUID(),
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

ipcMain.handle('clipboard:get-items', () => {
  return savedClipboardItems;
});

ipcMain.handle('clipboard:delete-item', (event, id: string, items: ClipboardItem[]) => {
  // Update the main process array with the current items from renderer
  savedClipboardItems = items || savedClipboardItems;
  savedClipboardItems = savedClipboardItems.filter(item => item.id !== id);
  return savedClipboardItems;
});

ipcMain.handle('clipboard:clear-all', () => {
  savedClipboardItems = [];
  return savedClipboardItems;
});

// Grammar checking with OpenAI
ipcMain.handle('grammar:check', async (event, text: string) => {
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
  } catch (error) {
    console.error('Grammar check error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

// Chat functionality with OpenAI
ipcMain.handle('chat:send-message', async (event, message: string) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found. Please add OPENAI_API_KEY to your .env file.');
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    return {
      success: true,
      result: completion.choices[0]?.message?.content || "Sorry, I couldn't process your message right now. Please try again."
    };
  } catch (error) {
    console.error('Chat error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

ipcMain.handle('chat:create-window', (event, message: string, response: string) => {
  try {
    const chatWindowManager = ChatWindowManager.getInstance();
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    chatWindowManager.createChatWindow(message, response, parentWindow);
    return true;
  } catch (error) {
    console.error('Failed to create chat window:', error);
    return false;
  }
});

// Handle window close request
ipcMain.handle('window:close', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.close();
  }
});

// Handle sending chat messages in the new window
ipcMain.handle('chat:send-message-to-conversation', async (event, conversationId: string, message: string) => {
  try {
    console.log('🤖 Chat message received:', { conversationId, message });
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found. Please add OPENAI_API_KEY to your .env file.');
    }

    // Import conversation manager
    const { conversationManager } = await import('./chat/ConversationManager');
    
    // Add the user message to the conversation first
    conversationManager.addMessage(conversationId, 'user', message);
    
    // Get the full conversation history
    const conversation = conversationManager.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    console.log('📝 Conversation history:', conversation.history);

    // Convert conversation history to OpenAI format
    const messages = conversation.history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    console.log('🚀 Sending to OpenAI with messages:', messages);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || "Sorry, I couldn't process your message right now. Please try again.";

    console.log('✅ OpenAI response received:', response);

    // Add the assistant's response to the conversation
    conversationManager.addMessage(conversationId, 'assistant', response);

    return {
      success: true,
      data: response
    };
  } catch (error) {
    console.error('❌ Chat error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.