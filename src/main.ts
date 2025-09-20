import { app, BrowserWindow, screen, clipboard, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { randomUUID } from 'crypto';

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
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  mainWindow.setPosition(screenWidth - 400, 0);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Only open DevTools in development
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
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

// IPC handlers for clipboard operations
ipcMain.handle('clipboard:write-text', (event, text: string) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('clipboard:read-text', () => {
  return clipboard.readText();
});

ipcMain.handle('clipboard:save-item', (event, text: string) => {
  // Check if item already exists to avoid duplicates
  const existingItem = savedClipboardItems.find(item => item.text === text);
  if (existingItem) {
    // Return the existing item with a flag indicating it's a duplicate
    return { ...existingItem, isDuplicate: true };
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
  
  return newItem;
});

ipcMain.handle('clipboard:get-items', () => {
  return savedClipboardItems;
});

ipcMain.handle('clipboard:delete-item', (event, id: string) => {
  savedClipboardItems = savedClipboardItems.filter(item => item.id !== id);
  return true;
});

ipcMain.handle('clipboard:clear-all', () => {
  savedClipboardItems = [];
  return true;
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
