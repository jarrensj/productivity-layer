import { app, BrowserWindow, screen, clipboard, ipcMain, shell, desktopCapturer } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { Resend } from 'resend';

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

// Links storage
interface LinkItem {
  id: string;
  name: string;
  url: string;
  timestamp: number;
}

// Tasks storage
interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  timestamp: number;
}

let savedClipboardItems: ClipboardItem[] = [];
let savedLinkItems: LinkItem[] = [];
let savedTaskItems: TaskItem[] = [];
let chatWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let screenshotInterval: NodeJS.Timeout | null = null;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Create chat window function
const createChatWindow = (initialMessage?: string) => {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.focus();
    // If there's an initial message and window already exists, send it
    if (initialMessage) {
      chatWindow.webContents.send('initial-message', initialMessage);
    }
    return;
  }

  chatWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the chat window HTML
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    chatWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/chat-window.html`);
  } else {
    chatWindow.loadFile(path.join(__dirname, '../renderer/chat-window.html'));
  }

  // Send initial message once the window is ready
  if (initialMessage) {
    chatWindow.webContents.once('dom-ready', () => {
      chatWindow!.webContents.send('initial-message', initialMessage);
    });
  }

  // Handle window closed
  chatWindow.on('closed', () => {
    chatWindow = null;
  });
};

// Create overlay window function
const createOverlayWindow = () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus();
    return;
  }

  overlayWindow = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    opacity: 0.9,
    minWidth: 200,
    minHeight: 150,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the overlay HTML
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/overlay.html`);
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay.html'));
  }

  // Position the overlay window in the center
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const overlayWidth = 600;
  const overlayHeight = 400;
  overlayWindow.setPosition(
    Math.floor((screenWidth - overlayWidth) / 2),
    Math.floor((screenHeight - overlayHeight) / 2)
  );

  // Handle window closed
  overlayWindow.on('closed', () => {
    overlayWindow = null;
    stopScreenshotInterval();
  });
};

// Start screenshot interval
const startScreenshotInterval = (intervalSeconds = 300) => {
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
  }
  
  // Take initial screenshot
  takeScreenshotForOverlay();
  
 // Set interval based on provided seconds
  const intervalMs = intervalSeconds * 1000;
  screenshotInterval = setInterval(() => {
    takeScreenshotForOverlay();
  }, intervalMs);
  
};

// Stop screenshot interval
const stopScreenshotInterval = () => {
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
    screenshotInterval = null;
  }
};

// Take screenshot for overlay
const takeScreenshotForOverlay = async () => {
  try {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      return;
    }

    // Get overlay window bounds
    const bounds = overlayWindow.getBounds();
    
    // Temporarily hide the overlay window to capture what's behind it
    const wasVisible = overlayWindow.isVisible();
    if (wasVisible) {
      overlayWindow.hide();
      // Wait a moment for the window to hide
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Get all available screens
    const allDisplays = screen.getAllDisplays();

    // Find which display the overlay is on
    const overlayDisplay = allDisplays.find(display => {
      const displayBounds = display.bounds;
      return bounds.x >= displayBounds.x && 
             bounds.x < displayBounds.x + displayBounds.width &&
             bounds.y >= displayBounds.y && 
             bounds.y < displayBounds.y + displayBounds.height;
    });


    // Use desktopCapturer to get the screen, but with better source selection
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    if (sources.length === 0) {
      // Restore overlay visibility
      if (wasVisible) {
        overlayWindow.show();
      }
      return;
    }


    // For now, use the first source and rely on cropping to get the right area
    const fullScreenshot = sources[0].thumbnail;
    
    // Restore overlay visibility
    if (wasVisible) {
      overlayWindow.show();
    }
    
    // Send full screenshot to overlay window for display
    overlayWindow.webContents.send('new-screenshot', fullScreenshot.toDataURL());
    
    // For AI summarization, we need to crop the screenshot to the overlay area
    // Create a hidden BrowserWindow to handle the cropping
    const cropWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    // Get screen dimensions for cropping calculations
    const targetDisplay = overlayDisplay || screen.getPrimaryDisplay();
    const screenSize = targetDisplay.workAreaSize;
    const displayScaleFactor = targetDisplay.scaleFactor;
    
    
    // Calculate overlay position relative to the target display
    const relativeX = bounds.x - targetDisplay.bounds.x;
    const relativeY = bounds.y - targetDisplay.bounds.y;
    
    // Create HTML content for cropping
    const cropHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; padding: 0; }
          canvas { display: block; }
        </style>
      </head>
      <body>
        <canvas id="cropCanvas" width="${bounds.width}" height="${bounds.height}"></canvas>
        <script>
          const canvas = document.getElementById('cropCanvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          img.onload = () => {
            
            // Calculate the scale factor between the screenshot and actual screen
            const screenScaleX = img.width / ${screenSize.width};
            const screenScaleY = img.height / ${screenSize.height};
            
            
            // Calculate the source coordinates and dimensions for cropping
            // Use relative position to the display
            const sourceX = ${relativeX} * screenScaleX;
            const sourceY = ${relativeY} * screenScaleY;
            const sourceWidth = ${bounds.width} * screenScaleX;
            const sourceHeight = ${bounds.height} * screenScaleY;
            
            
            // Ensure we don't go outside the image bounds
            const clampedSourceX = Math.max(0, Math.min(sourceX, img.width));
            const clampedSourceY = Math.max(0, Math.min(sourceY, img.height));
            const clampedSourceWidth = Math.min(sourceWidth, img.width - clampedSourceX);
            const clampedSourceHeight = Math.min(sourceHeight, img.height - clampedSourceY);
            
            
            // Clear the canvas first
            ctx.clearRect(0, 0, ${bounds.width}, ${bounds.height});
            
            // Draw the cropped portion of the screenshot to the canvas
            ctx.drawImage(
              img,
              clampedSourceX, clampedSourceY, clampedSourceWidth, clampedSourceHeight,
              0, 0, ${bounds.width}, ${bounds.height}
            );
            
            // Convert the cropped canvas to data URL and send back to main process
            const croppedDataUrl = canvas.toDataURL('image/png');
            require('electron').ipcRenderer.send('cropped-screenshot', croppedDataUrl);
          };
          
          img.onerror = (e) => {
            console.error('Error loading image:', e);
            require('electron').ipcRenderer.send('cropped-screenshot', '');
          };
          
          img.src = '${fullScreenshot.toDataURL()}';
        </script>
      </body>
      </html>
    `;

    // Set up IPC listener for the cropped screenshot
    const handleCroppedScreenshot = (event: any, croppedDataUrl: string) => {
      if (!croppedDataUrl) {
        console.error('Failed to crop screenshot');
        cropWindow.close();
        ipcMain.removeListener('cropped-screenshot', handleCroppedScreenshot);
        return;
      }
      
      
      // Generate AI summary with the cropped screenshot (content underneath overlay)
      summarizeScreenshot(croppedDataUrl).then(summaryResult => {
        if (summaryResult.success) {
          overlayWindow.webContents.send('new-summary', summaryResult.result);
          
          // Also send the summary to the main window
          const mainWindow = BrowserWindow.getAllWindows().find(window => 
            window !== overlayWindow && !window.isDestroyed() && window !== cropWindow
          );
          if (mainWindow) {
            mainWindow.webContents.send('overlay-summary', summaryResult.result);
          }
        } else {
          console.error('AI Summary failed:', summaryResult.error);
        }
        
        // Clean up
        cropWindow.close();
        ipcMain.removeListener('cropped-screenshot', handleCroppedScreenshot);
      });
    };

    ipcMain.on('cropped-screenshot', handleCroppedScreenshot);
    
    // Load the HTML content
    cropWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(cropHTML)}`);
    
  } catch (error) {
    console.error('Error taking screenshot for overlay:', error);
  }
};

// Summarize screenshot function
const summarizeScreenshot = async (imageData: string): Promise<{success: boolean; result?: string; error?: string}> => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found. Please add OPENAI_API_KEY to your .env file.');
    }

    // Convert image data URL to base64 (remove data:image/...;base64, prefix)
    const base64Image = imageData.split(',')[1];
    const mimeType = imageData.split(';')[0].split(':')[1];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
                        {
                          type: "text",
                          text: "Analyze this screenshot and create a concise bullet point summary. Format as bullet points and keep it brief (3-5 bullet points max)."
                        },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    return {
      success: true,
      result: completion.choices[0]?.message?.content || "No summary generated"
    };
  } catch (error) {
    console.error('Screenshot summarization error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to summarize screenshot'
    };
  }
};

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

// Images generation with Gemini
ipcMain.handle('images:generate', async (event, prompt: string, imageData: string) => {
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
    const parts: any[] = [{ text: prompt }];
    
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
    } else {
      // Check for text response (fallback for analysis)
      const candidate = data.candidates?.[0];
      const generatedText = candidate?.content?.parts?.[0]?.text || "No response generated";
      return {
        success: true,
        type: 'text',
        result: generatedText
      };
    }
    
  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
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

// Links management handlers
ipcMain.handle('links:save-item', (event, name: string, url: string, items: LinkItem[]) => {
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
  } else if (normalizedUrl.startsWith('https://')) {
    hostnameToValidate = normalizedUrl.substring(8);
  }
  
  hostnameToValidate = hostnameToValidate.split('/')[0].split(':')[0];
  
  const isValidDomain = (hostname: string): boolean => {
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
  } catch (error) {
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

  const newItem: LinkItem = {
    id: randomUUID(),
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

ipcMain.handle('links:get-items', () => {
  return savedLinkItems;
});

ipcMain.handle('links:delete-item', (event, id: string, items: LinkItem[]) => {
  // Update the main process array with the current items from renderer
  savedLinkItems = items || savedLinkItems;
  savedLinkItems = savedLinkItems.filter(item => item.id !== id);
  return savedLinkItems;
});

ipcMain.handle('links:clear-all', () => {
  savedLinkItems = [];
  return savedLinkItems;
});

ipcMain.handle('links:open-link', async (event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open link:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to open link'
    };
  }
});

// Tasks management handlers
ipcMain.handle('tasks:save-item', (event, text: string, items: TaskItem[]) => {
  // Update the main process array with the current items from renderer
  savedTaskItems = items || savedTaskItems;
  
  const newItem: TaskItem = {
    id: randomUUID(),
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

ipcMain.handle('tasks:get-items', () => {
  return savedTaskItems;
});

ipcMain.handle('tasks:update-item', (event, id: string, updates: Partial<TaskItem>, items: TaskItem[]) => {
  // Update the main process array with the current items from renderer
  savedTaskItems = items || savedTaskItems;
  
  const itemIndex = savedTaskItems.findIndex(item => item.id === id);
  if (itemIndex !== -1) {
    savedTaskItems[itemIndex] = { ...savedTaskItems[itemIndex], ...updates };
  }
  
  return savedTaskItems;
});

ipcMain.handle('tasks:delete-item', (event, id: string, items: TaskItem[]) => {
  // Update the main process array with the current items from renderer
  savedTaskItems = items || savedTaskItems;
  savedTaskItems = savedTaskItems.filter(item => item.id !== id);
  return savedTaskItems;
});

ipcMain.handle('tasks:clear-all', () => {
  savedTaskItems = [];
  return savedTaskItems;
});

// Window opacity handler
ipcMain.handle('window:set-opacity', (event, opacity: number) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      // Ensure opacity is within valid range (0.1 to 1.0)
      const normalizedOpacity = Math.max(0.1, Math.min(1.0, opacity / 100));
      window.setOpacity(normalizedOpacity);
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  } catch (error) {
    console.error('Failed to set opacity:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to set opacity'
    };
  }
});

// Chat window handlers
ipcMain.handle('chat:open-window', (event, initialMessage?: string) => {
  createChatWindow(initialMessage);
  return { success: true };
});

ipcMain.handle('chat:send-message', async (event, message: string, conversationHistory: any[]) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found. Please add OPENAI_API_KEY to your .env file.');
    }

    // Convert conversation history to OpenAI format
    const messages = [
      {
        role: "system" as const,
        content: "You are a helpful AI assistant. Provide clear, concise, and helpful responses. Be friendly and conversational while being informative."
      },
      ...conversationHistory
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .slice(-10) // Keep only last 10 messages for context
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
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
  } catch (error) {
    console.error('Chat error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

// Chat window control handlers
ipcMain.handle('chat-window:close', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.close();
  }
});

ipcMain.handle('chat-window:minimize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.minimize();
  }
});

ipcMain.handle('chat-window:maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  }
});

// App reset handler
ipcMain.handle('app:clear-reset', () => {
  try {
    // Clear all stored data
    savedClipboardItems = [];
    savedLinkItems = [];
    savedTaskItems = [];
    
    return { success: true };
  } catch (error) {
    console.error('Failed to reset app data:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to reset app data'
    };
  }
});

// Overlay window handlers
ipcMain.handle('overlay:create', () => {
  createOverlayWindow();
  return { success: true };
});

ipcMain.handle('overlay:close', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.close();
  }
});

ipcMain.handle('overlay:stop-interval', () => {
  stopScreenshotInterval();
  return { success: true };
});

ipcMain.handle('overlay:close-window', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
  return { success: true };
});

ipcMain.handle('overlay:start-recording', (event, interval) => {
  startScreenshotInterval(interval);
  return { success: true };
});

// Handle cropped screenshot from crop window
ipcMain.on('cropped-screenshot', () => {
  // This will be handled by the takeScreenshotForOverlay function
  // The event is already set up there with ipcMain.on
});

// Screenshot capture functionality
ipcMain.handle('screenshot:capture', async () => {
  try {
    // Get all available sources
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    if (sources.length === 0) {
      return {
        success: false,
        error: 'No screen sources available'
      };
    }

    // Use the primary display source
    const primarySource = sources[0];
    
    return {
      success: true,
      dataUrl: primarySource.thumbnail.toDataURL()
    };
  } catch (error) {
    console.error('Screenshot capture error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to capture screenshot'
    };
  }
});

// AI summarization of screenshots
ipcMain.handle('screenshot:summarize', async (event, imageData: string) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found. Please add OPENAI_API_KEY to your .env file.');
    }

    // Convert image data URL to base64 (remove data:image/...;base64, prefix)
    const base64Image = imageData.split(',')[1];
    const mimeType = imageData.split(';')[0].split(':')[1];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this screenshot and provide a detailed summary of its contents. Include any text, UI elements, layout, and overall purpose or context you can identify."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    return {
      success: true,
      result: completion.choices[0]?.message?.content || "No summary generated"
    };
  } catch (error) {
    console.error('Screenshot summarization error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to summarize screenshot'
    };
  }
});

// Email functionality
interface EmailConfig {
  recipientEmail: string;
  keywords: string[];
  enabled: boolean;
}

interface SummaryData {
  summary: string;
  timestamp: string;
  keywords: string[];
}

// Generate email HTML for summaries
function generateSummaryEmailHTML(summaryData: SummaryData, weekRange?: string) {
  const formattedDate = new Date(summaryData.timestamp).toLocaleDateString('en-US', { 
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const keywordsHTML = summaryData.keywords.length > 0 ? 
    `<div style="margin-bottom: 16px;">
      <strong>Triggered Keywords:</strong> 
      ${summaryData.keywords.map(keyword => 
        `<span style="background-color: #e5e7eb; color: #374151; padding: 4px 8px; border-radius: 4px; font-size: 14px; margin-right: 8px;">${keyword}</span>`
      ).join('')}
    </div>` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Screen Summary - ${formattedDate}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <header style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: bold;">📊 Screen Summary</h1>
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; opacity: 0.9;">${formattedDate}</h2>
        </header>
        
        <div style="padding: 32px 24px;">
          ${keywordsHTML}
          
          <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 24px; border-radius: 6px;">
            <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
              🤖 AI Summary
            </h3>
            <div style="color: #374151; line-height: 1.7;">
              ${summaryData.summary.split('\n').map(line => `<p style="margin: 0 0 8px 0;">${line}</p>`).join('')}
            </div>
          </div>
          
          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-top: 24px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              This summary was automatically generated from your screen activity and sent because it matched your configured keywords.
            </p>
          </div>
        </div>
        
        <footer style="background-color: #f3f4f6; padding: 16px 24px; text-align: center; color: #6b7280; font-size: 14px;">
          <p style="margin: 0;">Generated by Productivity Layer on ${new Date().toLocaleDateString('en-US', { 
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })}</p>
        </footer>
      </div>
    </body>
    </html>
  `;
}

// Check if summary contains any of the configured keywords
function checkKeywordsMatch(summary: string, keywords: string[]): string[] {
  const matchedKeywords: string[] = [];
  const summaryLower = summary.toLowerCase();
  
  keywords.forEach(keyword => {
    if (summaryLower.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  });
  
  return matchedKeywords;
}

// Send email with summary
ipcMain.handle('email:send-summary', async (event, summaryData: SummaryData, emailConfig: EmailConfig) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('Resend API key not found. Please add RESEND_API_KEY to your .env file.');
    }

    if (!emailConfig.enabled || !emailConfig.recipientEmail) {
      return {
        success: false,
        error: 'Email notifications are disabled or no recipient email configured'
      };
    }

    const matchedKeywords = checkKeywordsMatch(summaryData.summary, emailConfig.keywords);
    
    if (matchedKeywords.length === 0) {
      return {
        success: true,
        message: 'Summary does not match any configured keywords, email not sent',
        matchedKeywords: []
      };
    }

    const emailHTML = generateSummaryEmailHTML({
      ...summaryData,
      keywords: matchedKeywords
    });

    const { data, error } = await resend.emails.send({
      from: 'Productivity Layer <onboarding@resend.dev>',
      to: [emailConfig.recipientEmail],
      subject: `Screen Summary - ${matchedKeywords.join(', ')} - ${new Date().toLocaleDateString()}`,
      html: emailHTML,
      reply_to: 'onboarding@resend.dev',
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        success: false,
        error: 'Failed to send email',
        details: error
      };
    }

    return {
      success: true,
      messageId: data?.id,
      matchedKeywords,
      message: 'Email sent successfully'
    };
  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    };
  }
});

// Save email configuration
ipcMain.handle('email:save-config', (event, config: EmailConfig) => {
  try {
    // In a real app, you might want to save this to a file or database
    // For now, we'll just validate the config
    if (config.recipientEmail && !config.recipientEmail.includes('@')) {
      return {
        success: false,
        error: 'Please enter a valid email address'
      };
    }

    if (config.keywords && config.keywords.some(keyword => keyword.trim() === '')) {
      return {
        success: false,
        error: 'Keywords cannot be empty'
      };
    }

    return {
      success: true,
      message: 'Email configuration saved successfully'
    };
  } catch (error) {
    console.error('Email config save error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save email configuration'
    };
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
