/**
 * Extended Clipboard Manager - Renderer Process
 * Manages clipboard items with save, copy, and delete functionality
 */

import './index.css';
import { Utils } from './utils';

// Type definitions for the exposed API
interface ClipboardItem {
  id: string;
  text: string;
  timestamp: number;
}

interface LinkItem {
  id: string;
  name: string;
  url: string;
  timestamp: number;
}

interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  timestamp: number;
}

interface ImageItem {
  id: string;
  originalImage?: string; // base64 data URL
  generatedImage?: string; // base64 data URL
  prompt: string;
  timestamp: number;
}

interface ElectronAPI {
  clipboard: {
    writeText: (text: string) => Promise<boolean>;
    readText: () => Promise<string>;
    saveClipboardItem: (text: string, items: ClipboardItem[]) => Promise<{items: ClipboardItem[], savedItem: ClipboardItem}>;
    getSavedItems: () => Promise<ClipboardItem[]>;
    deleteItem: (id: string, items: ClipboardItem[]) => Promise<ClipboardItem[]>;
    clearAll: () => Promise<ClipboardItem[]>;
  };
  grammar: {
    checkGrammar: (text: string) => Promise<{success: boolean; result?: string; error?: string}>;
  };
  links: {
    saveLink: (name: string, url: string, items: LinkItem[]) => Promise<{items: LinkItem[], savedItem: LinkItem} | {success: false, error: string}>;
    getSavedLinks: () => Promise<LinkItem[]>;
    deleteLink: (id: string, items: LinkItem[]) => Promise<LinkItem[]>;
    clearAllLinks: () => Promise<LinkItem[]>;
    openLink: (url: string) => Promise<{success: boolean; error?: string}>;
  };
  tasks: {
    saveTask: (text: string, items: TaskItem[]) => Promise<{items: TaskItem[], savedItem: TaskItem}>;
    getSavedTasks: () => Promise<TaskItem[]>;
    updateTask: (id: string, updates: Partial<TaskItem>, items: TaskItem[]) => Promise<TaskItem[]>;
    deleteTask: (id: string, items: TaskItem[]) => Promise<TaskItem[]>;
    clearAllTasks: () => Promise<TaskItem[]>;
  };
  window: {
    setOpacity: (opacity: number) => Promise<{success: boolean; error?: string}>;
  };
  chat: {
    openWindow: (initialMessage?: string) => Promise<{success: boolean; error?: string}>;
  };
  images: {
    generateImage: (prompt: string, imageData: string) => Promise<{success: boolean; type?: string; result?: string; error?: string}>;
  };
  app: {
    clearResetApp: () => Promise<{success: boolean; error?: string}>;
  };
  screenshot: {
    capture: () => Promise<{success: boolean; dataUrl?: string; error?: string}>;
    summarize: (imageData: string) => Promise<{success: boolean; result?: string; error?: string}>;
  };
  overlay: {
    create: () => Promise<{success: boolean}>;
    close: () => Promise<void>;
    startRecording: (interval: number) => Promise<{success: boolean}>;
    stopInterval: () => Promise<{success: boolean}>;
    closeWindow: () => Promise<{success: boolean}>;
    onNewScreenshot: (callback: (dataUrl: string) => void) => void;
    onNewSummary: (callback: (summary: string) => void) => void;
    onOverlaySummary: (callback: (summary: string) => void) => void;
  };
  email: {
    sendSummary: (summaryData: any, emailConfig: any) => Promise<{success: boolean; message?: string; error?: string; matchedKeywords?: string[]}>;
    saveConfig: (config: any) => Promise<{success: boolean; message?: string; error?: string}>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

class DragToReorderUtil {
  private draggedElement: HTMLElement | null = null;
  private draggedIndex = -1;

  setupDragAndDrop<T>(
    container: HTMLElement,
    itemSelector: string,
    items: T[],
    onReorder: (fromIndex: number, toIndex: number) => void
  ) {
    container.querySelectorAll(itemSelector).forEach((item, index) => {
      const element = item as HTMLElement;
      
      element.addEventListener('dragstart', (e) => {
        this.draggedElement = element;
        this.draggedIndex = index;
        element.classList.add('dragging');
        
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/html', element.outerHTML);
        }
      });

      element.addEventListener('dragend', () => {
        element.classList.remove('dragging');
        this.draggedElement = null;
        this.draggedIndex = -1;
        
        // Remove all drop indicators
        container.querySelectorAll(itemSelector).forEach(item => {
          item.classList.remove('drag-over-top', 'drag-over-bottom');
        });
      });

      element.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (this.draggedElement && this.draggedElement !== element) {
          const rect = element.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          
          // Remove previous indicators from all items
          container.querySelectorAll(itemSelector).forEach(item => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
          });
          
          const threshold = rect.height * 0.3;
          if (e.clientY < midY - threshold) {
            element.classList.add('drag-over-top');
          } else if (e.clientY > midY + threshold) {
            element.classList.add('drag-over-bottom');
          } else {
            if (e.clientY < midY) {
              element.classList.add('drag-over-top');
            } else {
              element.classList.add('drag-over-bottom');
            }
          }
        }
      });

      element.addEventListener('dragleave', (e) => {
        const rect = element.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || 
            e.clientY < rect.top || e.clientY > rect.bottom) {
          element.classList.remove('drag-over-top', 'drag-over-bottom');
        }
      });

      element.addEventListener('drop', (e) => {
        e.preventDefault();
        if (this.draggedElement && this.draggedElement !== element && this.draggedIndex !== -1) {
          const rect = element.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const dropIndex = index;
          let newIndex = dropIndex;
          
          const threshold = rect.height * 0.3;
          if (e.clientY < midY - threshold || (e.clientY < midY && e.clientY >= midY - threshold)) {
            newIndex = dropIndex;
          } else {
            newIndex = dropIndex + 1;
          }
          
          if (this.draggedIndex < newIndex) {
            newIndex--;
          }
          
          if (this.draggedIndex !== newIndex) {
            onReorder(this.draggedIndex, newIndex);
          }
        }
        
        // Clean up all indicators
        container.querySelectorAll(itemSelector).forEach(item => {
          item.classList.remove('drag-over-top', 'drag-over-bottom');
        });
      });
    });
  }
}

class ClipboardManager {
  private items: ClipboardItem[] = [];
  private itemsContainer: HTMLElement;
  private itemsCount: HTMLElement;
  private clipboardInput: HTMLTextAreaElement;
  private dragUtil: DragToReorderUtil;

  constructor() {
    this.itemsContainer = document.getElementById('clipboard-items')!;
    this.itemsCount = document.getElementById('items-count')!;
    this.clipboardInput = document.getElementById('clipboard-input') as HTMLTextAreaElement;
    this.dragUtil = new DragToReorderUtil();
    
    this.init();
  }

  private async init() {
    this.setupEventListeners();
    await this.loadSavedItems();
    this.setupKeyboardShortcuts();
    this.loadTabPreferences();
    this.loadOpacityPreference();
  }

  private saveToLocalStorage() {
    Utils.saveToLocalStorage('clipboardItems', this.items);
  }

  private loadFromLocalStorage(): ClipboardItem[] {
    return Utils.loadFromLocalStorage<ClipboardItem>('clipboardItems');
  }

  private setupEventListeners() {
    // Settings button - navigates to settings page
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      this.navigateToSettings();
    });

    // Back to app button - navigates back to main app
    document.getElementById('back-to-app')?.addEventListener('click', () => {
      this.navigateToMainApp();
    });

    // Clear all button (now in settings page)
    document.getElementById('clear-all')?.addEventListener('click', async () => {
      if (confirm('Clear all saved clipboard items?')) {
        this.items = await window.electronAPI.clipboard.clearAll();
        this.saveToLocalStorage();
        this.renderItems();
      }
    });

    // Clear all links button
    document.getElementById('clear-all-links')?.addEventListener('click', async () => {
      if (confirm('Clear all saved links?')) {
        try {
          await window.electronAPI.links.clearAllLinks();
          // Find the links manager instance and update it
          const linksEvent = new CustomEvent('clearAllLinks');
          document.dispatchEvent(linksEvent);
          this.showMessage('All links cleared successfully', 'success');
        } catch (error) {
          console.error('Failed to clear links:', error);
          this.showMessage('Failed to clear links', 'error');
        }
      }
    });

    // Clear all tasks button
    document.getElementById('clear-all-tasks')?.addEventListener('click', async () => {
      if (confirm('Clear all tasks?')) {
        try {
          await window.electronAPI.tasks.clearAllTasks();
          // Find the tasks manager instance and update it
          const tasksEvent = new CustomEvent('clearAllTasks');
          document.dispatchEvent(tasksEvent);
          this.showMessage('All tasks cleared successfully', 'success');
        } catch (error) {
          console.error('Failed to clear tasks:', error);
          this.showMessage('Failed to clear tasks', 'error');
        }
      }
    });

    // Reset App button
    document.getElementById('clear-reset-app')?.addEventListener('click', async () => {
      const confirmMessage = 'Are you sure you want to reset the entire app? This will:\n\n' +
        '• Clear all clipboard items\n' +
        '• Clear all favorite links\n' +
        '• Clear all tasks\n' +
        '• Clear uploaded images\n' +
        '• Reset timer state\n' +
        '• Reset all settings to defaults\n\n' +
        'This action cannot be undone!';
        
      if (confirm(confirmMessage)) {
        try {
          // Call the main process to clear all data
          await window.electronAPI.app.clearResetApp();
          
          // Clear localStorage completely
          localStorage.clear();
          
          // Dispatch events to update all managers
          document.dispatchEvent(new CustomEvent('clearAllClipboard'));
          document.dispatchEvent(new CustomEvent('clearAllLinks'));
          document.dispatchEvent(new CustomEvent('clearAllTasks'));
          document.dispatchEvent(new CustomEvent('clearAllImages'));
          document.dispatchEvent(new CustomEvent('resetAllSettings'));
          
          // Reset UI state
          this.resetToDefaults();
          
          this.showMessage('App has been reset successfully', 'success');
        } catch (error) {
          console.error('Failed to reset app:', error);
          this.showMessage('Failed to reset app', 'error');
        }
      }
    });

    // Tab visibility toggles
    document.getElementById('clipboard-tab-toggle')?.addEventListener('change', (e) => {
      const toggle = e.target as HTMLInputElement;
      const isEnabled = toggle.checked;
      
      if (!isEnabled && !this.canDisableTab('clipboard')) {
        // Prevent disabling if it's the last tab
        toggle.checked = true;
        this.showMessage('At least one tab must remain enabled', 'warning');
        return;
      }
      
      this.toggleTabVisibility('clipboard', isEnabled);
      this.saveTabPreferences();
      setTimeout(() => this.ensureActiveTab(), 50);
    });

    document.getElementById('grammar-tab-toggle')?.addEventListener('change', (e) => {
      const toggle = e.target as HTMLInputElement;
      const isEnabled = toggle.checked;
      
      if (!isEnabled && !this.canDisableTab('grammar')) {
        // Prevent disabling if it's the last tab
        toggle.checked = true;
        this.showMessage('At least one tab must remain enabled', 'warning');
        return;
      }
      
      this.toggleTabVisibility('grammar', isEnabled);
      this.saveTabPreferences();
      setTimeout(() => this.ensureActiveTab(), 50);
    });

    document.getElementById('links-tab-toggle')?.addEventListener('change', (e) => {
      const toggle = e.target as HTMLInputElement;
      const isEnabled = toggle.checked;
      
      if (!isEnabled && !this.canDisableTab('links')) {
        // Prevent disabling if it's the last tab
        toggle.checked = true;
        this.showMessage('At least one tab must remain enabled', 'warning');
        return;
      }
      
      this.toggleTabVisibility('links', isEnabled);
      this.saveTabPreferences();
      setTimeout(() => this.ensureActiveTab(), 50);
    });

    document.getElementById('tasks-tab-toggle')?.addEventListener('change', (e) => {
      const toggle = e.target as HTMLInputElement;
      const isEnabled = toggle.checked;
      
      if (!isEnabled && !this.canDisableTab('tasks')) {
        // Prevent disabling if it's the last tab
        toggle.checked = true;
        this.showMessage('At least one tab must remain enabled', 'warning');
        return;
      }
      
      this.toggleTabVisibility('tasks', isEnabled);
      this.saveTabPreferences();
      setTimeout(() => this.ensureActiveTab(), 50);
    });

    document.getElementById('chat-tab-toggle')?.addEventListener('change', (e) => {
      const toggle = e.target as HTMLInputElement;
      const isEnabled = toggle.checked;
      
      if (!isEnabled && !this.canDisableTab('chat')) {
        // Prevent disabling if it's the last tab
        toggle.checked = true;
        this.showMessage('At least one tab must remain enabled', 'warning');
        return;
      }
      
      this.toggleTabVisibility('chat', isEnabled);
      this.saveTabPreferences();
      setTimeout(() => this.ensureActiveTab(), 50);
    });

    document.getElementById('images-tab-toggle')?.addEventListener('change', (e) => {
      const toggle = e.target as HTMLInputElement;
      const isEnabled = toggle.checked;
      
      if (!isEnabled && !this.canDisableTab('images')) {
        // Prevent disabling if it's the last tab
        toggle.checked = true;
        this.showMessage('At least one tab must remain enabled', 'warning');
        return;
      }
      
      this.toggleTabVisibility('images', isEnabled);
      this.saveTabPreferences();
      setTimeout(() => this.ensureActiveTab(), 50);
    });

    document.getElementById('summarize-tab-toggle')?.addEventListener('change', (e) => {
      const toggle = e.target as HTMLInputElement;
      const isEnabled = toggle.checked;
      
      if (!isEnabled && !this.canDisableTab('summarize')) {
        // Prevent disabling if it's the last tab
        toggle.checked = true;
        this.showMessage('At least one tab must remain enabled', 'warning');
        return;
      }
      
      this.toggleTabVisibility('summarize', isEnabled);
      this.saveTabPreferences();
      setTimeout(() => this.ensureActiveTab(), 50);
    });

    document.getElementById('timer-tab-toggle')?.addEventListener('change', (e) => {
      const toggle = e.target as HTMLInputElement;
      const isEnabled = toggle.checked;
      
      if (!isEnabled && !this.canDisableTab('timer')) {
        // Prevent disabling if it's the last tab
        toggle.checked = true;
        this.showMessage('At least one tab must remain enabled', 'warning');
        return;
      }
      
      this.toggleTabVisibility('timer', isEnabled);
      this.saveTabPreferences();
      setTimeout(() => this.ensureActiveTab(), 50);
    });

    // Opacity slider control
    document.getElementById('opacity-slider')?.addEventListener('input', (e) => {
      const slider = e.target as HTMLInputElement;
      const opacity = parseInt(slider.value);
      this.updateOpacityValue(opacity);
      this.setWindowOpacity(opacity);
    });

    // Save input button
    document.getElementById('save-input')?.addEventListener('click', async () => {
      const text = this.clipboardInput.value.trim();
      if (text) {
        await this.saveItem(text);
        this.clipboardInput.value = '';
      }
    });

    // Auto-save when pasting into input
    this.clipboardInput.addEventListener('paste', async (e) => {
      // Wait for paste to complete
      setTimeout(async () => {
        const text = this.clipboardInput.value.trim();
        if (text) {
          await this.saveItem(text);
        }
      }, 100);
    });

    // Enter key to save (Ctrl/Cmd + Enter for new line)
    this.clipboardInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const text = this.clipboardInput.value.trim();
        if (text) {
          await this.saveItem(text);
          this.clipboardInput.value = '';
        }
      }
    });

    // Chat input and send button
    const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
    const sendChatButton = document.getElementById('send-chat-message');
    const openHistoryButton = document.getElementById('open-chat-history');

    const sendChatMessage = async () => {
      const message = chatInput?.value.trim();
      if (!message) {
        this.showMessage('Please enter a message', 'warning');
        return;
      }

      try {
        await window.electronAPI.chat.openWindow(message);
        chatInput.value = '';
        this.showMessage('Chat window opened with your message', 'success');
      } catch (error) {
        console.error('Failed to open chat window:', error);
        this.showMessage('Failed to open chat window', 'error');
      }
    };

    const openChatHistory = async () => {
      try {
        await window.electronAPI.chat.openWindow();
        this.showMessage('Chat window opened', 'success');
      } catch (error) {
        console.error('Failed to open chat window:', error);
        this.showMessage('Failed to open chat window', 'error');
      }
    };

    sendChatButton?.addEventListener('click', sendChatMessage);
    openHistoryButton?.addEventListener('click', openChatHistory);

    // Enter key to send message (Ctrl/Cmd + Enter for new line)
    chatInput?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        await sendChatMessage();
      }
    });
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
      // Cmd/Ctrl + Shift + C to clear all
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        if (confirm('Clear all saved clipboard items?')) {
          this.items = await window.electronAPI.clipboard.clearAll();
          this.saveToLocalStorage();
          this.renderItems();
        }
      }
    });
  }

  private async saveItem(text: string) {
    try {
      const result = await window.electronAPI.clipboard.saveClipboardItem(text, this.items);
      
      this.items = result.items;
      this.saveToLocalStorage();
      this.renderItems();
      
      // Show feedback message based on whether it was a duplicate
      if (result.savedItem && (result.savedItem as any).isDuplicate) {
        this.showMessage('Item already exists in clipboard history', 'warning');
        // Highlight the existing item
        this.highlightExistingItem(result.savedItem.id);
      } else {
        this.showMessage('Item saved to clipboard history', 'success');
      }
    } catch (error) {
      console.error('Failed to save clipboard item:', error);
      this.showMessage('Failed to save clipboard item', 'error');
    }
  }

  private async loadSavedItems() {
    try {
      // First try to load from localStorage
      const localItems = this.loadFromLocalStorage();
      if (localItems.length > 0) {
        this.items = localItems;
      } else {
        // Fallback to main process if localStorage is empty
        this.items = await window.electronAPI.clipboard.getSavedItems();
      }
      this.renderItems();
    } catch (error) {
      console.error('Failed to load clipboard items:', error);
    }
  }

  private renderItems() {
    this.itemsCount.textContent = this.items.length.toString();
    
    if (this.items.length === 0) {
      this.itemsContainer.innerHTML = '<div class="no-items">No saved clipboard items</div>';
      return;
    }

    this.itemsContainer.innerHTML = this.items
      .map(item => this.renderItem(item))
      .join('');

    // Add event listeners to newly created buttons
    this.itemsContainer.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        const item = this.items.find(i => i.id === id);
        if (item) {
          await window.electronAPI.clipboard.writeText(item.text);
          this.showFeedback(e.target as HTMLElement, 'Copied!');
        }
      });
    });

    this.itemsContainer.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        this.items = await window.electronAPI.clipboard.deleteItem(id, this.items);
        this.saveToLocalStorage();
        this.renderItems();
      });
    });

    // Add drag and drop event listeners
    this.dragUtil.setupDragAndDrop(
      this.itemsContainer,
      '.clipboard-item',
      this.items,
      (fromIndex: number, toIndex: number) => this.reorderItems(fromIndex, toIndex)
    );
  }

  private renderItem(item: ClipboardItem): string {
    const preview = item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text;
    const timeAgo = Utils.formatTimeAgo(item.timestamp);
    
    return `
      <div class="clipboard-item" data-id="${item.id}" draggable="true">
        <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
        <div class="item-content">
          <div class="item-text" title="${Utils.escapeHtml(item.text)}">${Utils.escapeHtml(preview)}</div>
          <div class="item-meta">${timeAgo}</div>
        </div>
        <div class="item-actions">
          <button class="copy-btn btn btn-small btn-primary" data-id="${item.id}" title="Copy to clipboard">Copy</button>
          <button class="delete-btn btn btn-small btn-danger" data-id="${item.id}" title="Delete item">×</button>
        </div>
      </div>
    `;
  }

  private showFeedback(element: HTMLElement, message: string) {
    const originalText = element.textContent;
    element.textContent = message;
    element.classList.add('feedback');
    
    setTimeout(() => {
      element.textContent = originalText;
      element.classList.remove('feedback');
    }, 1000);
  }

  private reorderItems(fromIndex: number, toIndex: number) {
    this.items = Utils.reorderArray(this.items, fromIndex, toIndex);
    this.saveToLocalStorage();
    this.renderItems();
  }

  private highlightExistingItem(itemId: string) {
    Utils.highlightExistingItem(itemId);
  }

  private showMessage(message: string, type: 'success' | 'warning' | 'error') {
    Utils.showMessage(message, type);
  }

  private navigateToSettings() {
    const mainApp = document.getElementById('main-app');
    const settingsPage = document.getElementById('settings-page');
    
    if (mainApp && settingsPage) {
      mainApp.style.display = 'none';
      settingsPage.style.display = 'flex';
      
      // Initialize tab order UI when settings page is shown
      setTimeout(() => {
        const stored = localStorage.getItem('tabPreferences');
        const preferences = stored ? JSON.parse(stored) : {};
        const tabOrder = preferences.tabOrder || ['clipboard', 'grammar', 'links', 'tasks', 'chat', 'images', 'timer'];
        this.initializeTabOrderUI(tabOrder);
      }, 100);
    }
  }

  private navigateToMainApp() {
    const mainApp = document.getElementById('main-app');
    const settingsPage = document.getElementById('settings-page');
    
    if (mainApp && settingsPage) {
      settingsPage.style.display = 'none';
      mainApp.style.display = 'flex';
    }
  }

  private toggleTabVisibility(tabName: string, isVisible: boolean) {
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`) as HTMLElement;
    const tabContent = document.getElementById(`${tabName}-tab`) as HTMLElement;
    
    if (tabButton && tabContent) {
      if (isVisible) {
        tabButton.style.display = 'block';
      } else {
        tabButton.style.display = 'none';
        tabContent.classList.remove('active');
        
        // If this was the active tab, switch to the first visible tab
        if (tabButton.classList.contains('active')) {
          tabButton.classList.remove('active');
          const firstVisibleTab = document.querySelector('.tab-btn:not([style*="display: none"])') as HTMLElement;
          if (firstVisibleTab) {
            firstVisibleTab.click();
          }
        }
      }
    }
  }

  private saveTabPreferences() {
    const clipboardEnabled = (document.getElementById('clipboard-tab-toggle') as HTMLInputElement)?.checked ?? true;
    const grammarEnabled = (document.getElementById('grammar-tab-toggle') as HTMLInputElement)?.checked ?? true;
    const linksEnabled = (document.getElementById('links-tab-toggle') as HTMLInputElement)?.checked ?? true;
    const tasksEnabled = (document.getElementById('tasks-tab-toggle') as HTMLInputElement)?.checked ?? true;
    const chatEnabled = (document.getElementById('chat-tab-toggle') as HTMLInputElement)?.checked ?? true;
    const imagesEnabled = (document.getElementById('images-tab-toggle') as HTMLInputElement)?.checked ?? true;
    const summarizeEnabled = (document.getElementById('summarize-tab-toggle') as HTMLInputElement)?.checked ?? true;
    const timerEnabled = (document.getElementById('timer-tab-toggle') as HTMLInputElement)?.checked ?? true;
    
    // Get current tab order from localStorage or use default
    const stored = localStorage.getItem('tabPreferences');
    const currentPreferences = stored ? JSON.parse(stored) : {};
    const defaultOrder = ['clipboard', 'grammar', 'links', 'tasks', 'chat', 'images', 'summarize', 'timer'];
    
    const preferences = {
      clipboardTab: clipboardEnabled,
      grammarTab: grammarEnabled,
      linksTab: linksEnabled,
      tasksTab: tasksEnabled,
      chatTab: chatEnabled,
      imagesTab: imagesEnabled,
      summarizeTab: summarizeEnabled,
      timerTab: timerEnabled,
      tabOrder: currentPreferences.tabOrder || defaultOrder
    };
    
    try {
      localStorage.setItem('tabPreferences', JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save tab preferences:', error);
    }
  }

  private loadTabPreferences() {
    try {
      const stored = localStorage.getItem('tabPreferences');
      const preferences = stored ? JSON.parse(stored) : { 
        clipboardTab: true, 
        grammarTab: true, 
        linksTab: true, 
        tasksTab: true, 
        chatTab: true,
        imagesTab: true,
        summarizeTab: true,
        timerTab: true,
        tabOrder: ['clipboard', 'grammar', 'links', 'tasks', 'chat', 'images', 'summarize', 'timer']
      };

      // Migration: Add Images and Timer tabs if they don't exist in stored preferences
      if (stored) {
        let needsUpdate = false;
        
        // Add imagesTab if missing
        if (preferences.imagesTab === undefined) {
          preferences.imagesTab = true;
          needsUpdate = true;
        }
        
        // Add timerTab if missing
        if (preferences.timerTab === undefined) {
          preferences.timerTab = true;
          needsUpdate = true;
        }
        
        // Add 'images' to tabOrder if missing
        if (!preferences.tabOrder || !preferences.tabOrder.includes('images')) {
          preferences.tabOrder = preferences.tabOrder || ['clipboard', 'grammar', 'links', 'tasks', 'chat'];
          preferences.tabOrder.push('images');
          needsUpdate = true;
        }
        
        // Add summarizeTab if missing
        if (preferences.summarizeTab === undefined) {
          preferences.summarizeTab = true;
          needsUpdate = true;
        }
        
        // Add 'summarize' to tabOrder if missing
        if (!preferences.tabOrder || !preferences.tabOrder.includes('summarize')) {
          preferences.tabOrder = preferences.tabOrder || ['clipboard', 'grammar', 'links', 'tasks', 'chat', 'images'];
          preferences.tabOrder.push('summarize');
          needsUpdate = true;
        }
        
        // Add 'timer' to tabOrder if missing
        if (!preferences.tabOrder || !preferences.tabOrder.includes('timer')) {
          preferences.tabOrder = preferences.tabOrder || ['clipboard', 'grammar', 'links', 'tasks', 'chat', 'images', 'timer'];
          if (!preferences.tabOrder.includes('timer')) {
            preferences.tabOrder.push('timer');
          }
          needsUpdate = true;
        }
        
        // Save updated preferences
        if (needsUpdate) {
          localStorage.setItem('tabPreferences', JSON.stringify(preferences));
        }
      }
      
      // Apply tab order first (with a small delay to ensure DOM is ready)
      setTimeout(() => {
        if (preferences.tabOrder) {
          this.applyTabOrder(preferences.tabOrder);
        }
        
        // Update toggle states
      const clipboardToggle = document.getElementById('clipboard-tab-toggle') as HTMLInputElement;
      const grammarToggle = document.getElementById('grammar-tab-toggle') as HTMLInputElement;
      const linksToggle = document.getElementById('links-tab-toggle') as HTMLInputElement;
      const tasksToggle = document.getElementById('tasks-tab-toggle') as HTMLInputElement;
      const chatToggle = document.getElementById('chat-tab-toggle') as HTMLInputElement;
      const imagesToggle = document.getElementById('images-tab-toggle') as HTMLInputElement;
      const summarizeToggle = document.getElementById('summarize-tab-toggle') as HTMLInputElement;
      const timerToggle = document.getElementById('timer-tab-toggle') as HTMLInputElement;
      
      if (clipboardToggle) {
        clipboardToggle.checked = preferences.clipboardTab;
        this.toggleTabVisibility('clipboard', preferences.clipboardTab);
      }
      
      if (grammarToggle) {
        grammarToggle.checked = preferences.grammarTab;
        this.toggleTabVisibility('grammar', preferences.grammarTab);
      }
      
      if (linksToggle) {
        linksToggle.checked = preferences.linksTab ?? true;
        this.toggleTabVisibility('links', preferences.linksTab ?? true);
      }
      
      if (tasksToggle) {
        tasksToggle.checked = preferences.tasksTab ?? true;
        this.toggleTabVisibility('tasks', preferences.tasksTab ?? true);
      }
      
      if (chatToggle) {
        chatToggle.checked = preferences.chatTab ?? true;
        this.toggleTabVisibility('chat', preferences.chatTab ?? true);
      }
      
      if (imagesToggle) {
        imagesToggle.checked = preferences.imagesTab ?? true;
        this.toggleTabVisibility('images', preferences.imagesTab ?? true);
      }
      
      if (summarizeToggle) {
        summarizeToggle.checked = preferences.summarizeTab ?? true;
        // Always show the summarize tab by default
        this.toggleTabVisibility('summarize', true);
      }
      
      if (timerToggle) {
        timerToggle.checked = preferences.timerTab ?? true;
        this.toggleTabVisibility('timer', preferences.timerTab ?? true);
      }
      
        // Initialize tab order UI in settings
        this.initializeTabOrderUI(preferences.tabOrder || ['clipboard', 'grammar', 'links', 'tasks', 'chat', 'images', 'summarize', 'timer']);
        
        // Ensure at least one tab is visible and active (with a small delay to ensure DOM is ready)
        setTimeout(() => {
          this.ensureActiveTab();
        }, 100);
      }, 50);
    } catch (error) {
      console.error('Failed to load tab preferences:', error);
    }
  }

  private ensureActiveTab() {
    const activeTab = document.querySelector('.tab-btn.active:not([style*="display: none"])');
    if (!activeTab) {
      // Find the first visible tab and make it active
      const firstVisibleTab = document.querySelector('.tab-btn:not([style*="display: none"])') as HTMLElement;
      if (firstVisibleTab) {
        firstVisibleTab.click();
      }
    } else {
      // Ensure the active tab's content is actually visible
      const tabName = activeTab.getAttribute('data-tab');
      if (tabName) {
        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent && !tabContent.classList.contains('active')) {
          (activeTab as HTMLElement).click();
        }
      }
    }
  }

  private canDisableTab(tabName: string): boolean {
    const clipboardToggle = document.getElementById('clipboard-tab-toggle') as HTMLInputElement;
    const grammarToggle = document.getElementById('grammar-tab-toggle') as HTMLInputElement;
    const linksToggle = document.getElementById('links-tab-toggle') as HTMLInputElement;
    const tasksToggle = document.getElementById('tasks-tab-toggle') as HTMLInputElement;
    const chatToggle = document.getElementById('chat-tab-toggle') as HTMLInputElement;
    const imagesToggle = document.getElementById('images-tab-toggle') as HTMLInputElement;
    const summarizeToggle = document.getElementById('summarize-tab-toggle') as HTMLInputElement;
    
    if (!clipboardToggle || !grammarToggle || !linksToggle || !tasksToggle || !chatToggle || !imagesToggle || !summarizeToggle) return false;
    
    // Count how many tabs would remain enabled after disabling this one
    const remainingTabs = [];
    if (tabName !== 'clipboard' && clipboardToggle.checked) remainingTabs.push('clipboard');
    if (tabName !== 'grammar' && grammarToggle.checked) remainingTabs.push('grammar');
    if (tabName !== 'links' && linksToggle.checked) remainingTabs.push('links');
    if (tabName !== 'tasks' && tasksToggle.checked) remainingTabs.push('tasks');
    if (tabName !== 'chat' && chatToggle.checked) remainingTabs.push('chat');
    if (tabName !== 'images' && imagesToggle.checked) remainingTabs.push('images');
    if (tabName !== 'summarize' && summarizeToggle.checked) remainingTabs.push('summarize');
    
    // Allow disabling only if at least one tab would remain
    return remainingTabs.length > 0;
  }

  private updateOpacityValue(opacity: number) {
    const opacityValue = document.getElementById('opacity-value');
    if (opacityValue) {
      opacityValue.textContent = `${opacity}%`;
    }
  }

  private async setWindowOpacity(opacity: number) {
    try {
      const result = await window.electronAPI.window.setOpacity(opacity);
      if (!result.success) {
        console.error('Failed to set opacity:', result.error);
        this.showMessage('Failed to update window opacity', 'error');
      } else {
        // Save the opacity preference
        this.saveOpacityPreference(opacity);
      }
    } catch (error) {
      console.error('Error setting opacity:', error);
      this.showMessage('Failed to update window opacity', 'error');
    }
  }

  private saveOpacityPreference(opacity: number) {
    try {
      localStorage.setItem('windowOpacity', opacity.toString());
    } catch (error) {
      console.error('Failed to save opacity preference:', error);
    }
  }

  private applyTabOrder(tabOrder: string[]) {
    const tabNavigation = document.querySelector('.tab-navigation');
    if (!tabNavigation) return;

    // Get all current tab buttons
    const tabButtons = Array.from(tabNavigation.querySelectorAll('.tab-btn')) as HTMLElement[];
    
    // Create a map for quick lookup
    const buttonMap = new Map<string, HTMLElement>();
    tabButtons.forEach(btn => {
      const tabName = btn.getAttribute('data-tab');
      if (tabName) {
        buttonMap.set(tabName, btn);
      }
    });

    // Clear the navigation and add buttons in the specified order
    tabNavigation.innerHTML = '';
    tabOrder.forEach(tabName => {
      const button = buttonMap.get(tabName);
      if (button) {
        tabNavigation.appendChild(button);
      }
    });
  }

  private initializeTabOrderUI(tabOrder: string[]) {
    // Use a timeout to ensure DOM is ready
    setTimeout(() => {
      // Create the tab order section if it doesn't exist
      const settingsPage = document.getElementById('settings-page');
      if (!settingsPage) {
        console.warn('Settings page not found');
        return;
      }

      // Find the interface customization section
      const interfaceSection = settingsPage.querySelector('.settings-section');
      if (!interfaceSection) {
        console.warn('Interface section not found');
        return;
      }

      // Check if tab order UI already exists
      let tabOrderContainer = document.getElementById('tab-order-container');
      if (!tabOrderContainer) {
        // Create the tab order section
        const tabOrderHTML = `
          <div class="setting-item" id="tab-order-container">
            <div class="setting-description">
              <strong>Tab Order</strong>
              <p>Drag and drop to reorder tabs in your preferred sequence.</p>
            </div>
            <div id="tab-order-list" class="tab-order-list"></div>
          </div>
        `;

        // Find the Timer Tab toggle (last toggle) to insert after it
        const settingItems = Array.from(interfaceSection.querySelectorAll('.setting-item'));
        const timerTabToggle = settingItems.find(item => {
          const strong = item.querySelector('strong');
          return strong && strong.textContent?.trim() === 'Timer Tab';
        });
        
        if (timerTabToggle) {
          timerTabToggle.insertAdjacentHTML('afterend', tabOrderHTML);
          tabOrderContainer = document.getElementById('tab-order-container');
        } else {
          // Fallback: insert at the end of the interface section
          interfaceSection.insertAdjacentHTML('beforeend', tabOrderHTML);
          tabOrderContainer = document.getElementById('tab-order-container');
        }
      }

      if (tabOrderContainer) {
        this.renderTabOrderList(tabOrder);
        this.setupTabOrderDragAndDrop();
      } else {
        console.error('Failed to create tab order container');
      }
    }, 200);
  }

  private renderTabOrderList(tabOrder: string[]) {
    const tabOrderList = document.getElementById('tab-order-list');
    if (!tabOrderList) {
      console.error('Tab order list element not found');
      return;
    }

    const tabLabels = {
      clipboard: 'Clipboard',
      grammar: 'Grammar Checker',
      links: 'Favorite Links',
      tasks: 'Tasks',
      chat: 'Chat',
      images: 'Images',
      summarize: 'Summarize',
      timer: 'Timer'
    };

    const tabOrderHTML = tabOrder.map(tabName => `
      <div class="tab-order-item" data-tab="${tabName}" draggable="true">
        <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
        <span class="tab-name">${tabLabels[tabName as keyof typeof tabLabels] || tabName}</span>
      </div>
    `).join('');

    tabOrderList.innerHTML = tabOrderHTML;
  }

  private setupTabOrderDragAndDrop() {
    const tabOrderList = document.getElementById('tab-order-list');
    if (!tabOrderList) return;

    const dragUtil = new DragToReorderUtil();
    
    // Get current tab order from DOM
    const getCurrentTabOrder = () => {
      return Array.from(tabOrderList.querySelectorAll('.tab-order-item')).map(item => 
        item.getAttribute('data-tab')
      ).filter(tab => tab) as string[];
    };

    dragUtil.setupDragAndDrop(
      tabOrderList,
      '.tab-order-item',
      getCurrentTabOrder(),
      (fromIndex: number, toIndex: number) => {
        const currentOrder = getCurrentTabOrder();
        const newOrder = Utils.reorderArray(currentOrder, fromIndex, toIndex);
        
        // Update the UI
        this.renderTabOrderList(newOrder);
        
        // Apply the new order to the main tabs
        this.applyTabOrder(newOrder);
        
        // Save the new order
        this.saveTabOrder(newOrder);
        
        // Re-setup drag and drop for the newly rendered items
        setTimeout(() => this.setupTabOrderDragAndDrop(), 100);
      }
    );
  }

  private saveTabOrder(tabOrder: string[]) {
    try {
      const stored = localStorage.getItem('tabPreferences');
      const preferences = stored ? JSON.parse(stored) : {};
      preferences.tabOrder = tabOrder;
      localStorage.setItem('tabPreferences', JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save tab order:', error);
    }
  }

  private loadOpacityPreference() {
    try {
      const stored = localStorage.getItem('windowOpacity');
      const opacity = stored ? parseInt(stored) : 80; // Default to 80%
      
      // Update slider and value display
      const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement;
      if (opacitySlider) {
        opacitySlider.value = opacity.toString();
        this.updateOpacityValue(opacity);
        // Set the window opacity without saving (to avoid recursion)
        window.electronAPI.window.setOpacity(opacity).catch(console.error);
      }
    } catch (error) {
      console.error('Failed to load opacity preference:', error);
    }
  }

  private resetToDefaults() {
    // Clear all items
    this.items = [];
    this.renderItems();
    
    // Reset opacity to default
    const defaultOpacity = 80;
    const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement;
    if (opacitySlider) {
      opacitySlider.value = defaultOpacity.toString();
      this.updateOpacityValue(defaultOpacity);
      this.setWindowOpacity(defaultOpacity);
    }
    
    // Reset all tab toggles to enabled (default state)
    const tabToggles = [
      'clipboard-tab-toggle',
      'grammar-tab-toggle', 
      'links-tab-toggle',
      'tasks-tab-toggle',
      'chat-tab-toggle',
      'images-tab-toggle',
      'timer-tab-toggle'
    ];
    
    tabToggles.forEach(toggleId => {
      const toggle = document.getElementById(toggleId) as HTMLInputElement;
      if (toggle) {
        toggle.checked = true;
        const tabName = toggleId.replace('-tab-toggle', '');
        this.toggleTabVisibility(tabName, true);
      }
    });
    
    // Reset tab order to default
    const defaultTabOrder = ['clipboard', 'grammar', 'links', 'tasks', 'chat', 'images', 'timer'];
    this.applyTabOrder(defaultTabOrder);
    
    const settingsPage = document.getElementById('settings-page');
    if (settingsPage && settingsPage.style.display !== 'none') {
      this.initializeTabOrderUI(defaultTabOrder);
    }
    
    // Ensure clipboard tab is active
    setTimeout(() => {
      const clipboardTab = document.querySelector('[data-tab="clipboard"]') as HTMLElement;
      if (clipboardTab) {
        clipboardTab.click();
      }
    }, 100);
  }
}

// Tab Management Class
class TabManager {
  private activeTab = 'clipboard';
  
  constructor() {
    this.init();
  }
  
  private init() {
    this.setupTabListeners();
  }
  
  private setupTabListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.dataset.tab;
        if (tabName) {
          this.switchTab(tabName);
        }
      });
    });
  }
  
  private switchTab(tabName: string) {
    if (this.activeTab === tabName) return;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
    
    this.activeTab = tabName;
  }
}

// Grammar Checker Class
class GrammarChecker {
  private grammarInput: HTMLTextAreaElement;
  private grammarResults: HTMLElement;
  private checkButton: HTMLElement;
  
  constructor() {
    this.grammarInput = document.getElementById('grammar-input') as HTMLTextAreaElement;
    this.grammarResults = document.getElementById('grammar-results')!;
    this.checkButton = document.getElementById('check-grammar')!;
    
    this.init();
  }
  
  private init() {
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    this.checkButton.addEventListener('click', () => {
      this.checkGrammar();
    });
    
    // Allow Ctrl/Cmd + Enter to check grammar
    this.grammarInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.checkGrammar();
      }
    });
  }
  
  private async checkGrammar() {
    const text = this.grammarInput.value.trim();
    
    if (!text) {
      this.showResults('Please enter some text to check.', 'error');
      return;
    }
    
    // Show loading state
    this.showResults('Checking grammar...', 'loading');
    this.checkButton.textContent = 'Checking...';
    this.checkButton.setAttribute('disabled', 'true');
    
    try {
      // Simple grammar check implementation
      const result = await this.performGrammarCheck(text);
      this.showResults(result, 'success');
    } catch (error) {
      this.showResults('Error checking grammar. Please try again.', 'error');
    } finally {
      this.checkButton.textContent = 'Check Grammar';
      this.checkButton.removeAttribute('disabled');
    }
  }
  
  private async performGrammarCheck(text: string): Promise<string> {
    try {
      const response = await window.electronAPI.grammar.checkGrammar(text);
      
      if (response.success) {
        return response.result || "No response received from OpenAI.";
      } else {
        return `Error: ${response.error || "Unknown error occurred"}`;
      }
    } catch (error) {
      console.error('Grammar check error:', error);
      return "Error: Failed to check grammar. Please try again.";
    }
  }
  
  private showResults(content: string, type: 'success' | 'error' | 'loading') {
    this.grammarResults.innerHTML = content;
    this.grammarResults.className = `grammar-results ${type}`;
  }
}

// Links Manager Class
class LinksManager {
  private items: LinkItem[] = [];
  private itemsContainer: HTMLElement;
  private itemsCount: HTMLElement;
  private linkNameInput: HTMLInputElement;
  private linkUrlInput: HTMLInputElement;
  private dragUtil: DragToReorderUtil;

  constructor() {
    this.itemsContainer = document.getElementById('links-items')!;
    this.itemsCount = document.getElementById('links-count')!;
    this.linkNameInput = document.getElementById('link-name-input') as HTMLInputElement;
    this.linkUrlInput = document.getElementById('link-url-input') as HTMLInputElement;
    this.dragUtil = new DragToReorderUtil();
    
    this.init();
  }

  private async init() {
    this.setupEventListeners();
    await this.loadSavedItems();
    this.setupGlobalEventListeners();
  }

  private setupGlobalEventListeners() {
    document.addEventListener('clearAllLinks', async () => {
      this.items = [];
      this.saveToLocalStorage();
      this.renderItems();
    });
  }

  private saveToLocalStorage() {
    Utils.saveToLocalStorage('linkItems', this.items);
  }

  private loadFromLocalStorage(): LinkItem[] {
    return Utils.loadFromLocalStorage<LinkItem>('linkItems');
  }

  private validateUrl(url: string): boolean {
    if (!url || url.length < 3) {
      return false;
    }
    
    const withoutProtocol = url.replace(/^https?:\/\//, '');
    if (!withoutProtocol.includes('.')) {
      return false;
    }
    
    if (/^[^a-zA-Z0-9]/.test(withoutProtocol) || /[^a-zA-Z0-9]$/.test(withoutProtocol)) {
      return false;
    }
    
    return true;
  }

  private setupEventListeners() {
    document.getElementById('add-link')?.addEventListener('click', async () => {
      const name = this.linkNameInput.value.trim();
      const url = this.linkUrlInput.value.trim();
      
      if (!url) {
        this.showMessage('Please enter a URL', 'error');
        return;
      }
      
      if (!this.validateUrl(url)) {
        this.showMessage('Please enter a valid URL', 'error');
        return;
      }
      
      await this.saveItem(name || url, url);
      this.linkNameInput.value = '';
      this.linkUrlInput.value = '';
    });

    [this.linkNameInput, this.linkUrlInput].forEach(input => {
      input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const name = this.linkNameInput.value.trim();
          const url = this.linkUrlInput.value.trim();
          
          if (!url) {
            this.showMessage('Please enter a URL', 'error');
            return;
          }
          
          if (!this.validateUrl(url)) {
            this.showMessage('Please enter a valid URL', 'error');
            return;
          }
          
          await this.saveItem(name || url, url);
          this.linkNameInput.value = '';
          this.linkUrlInput.value = '';
        }
      });
    });
  }

  private async saveItem(name: string, url: string) {
    try {
      const result = await window.electronAPI.links.saveLink(name, url, this.items);
      
      // Check if validation failed
      if ('success' in result && !result.success) {
        this.showMessage(result.error || 'Invalid URL format', 'error');
        return;
      }
      
      // Type guard to ensure we have the success result
      if ('items' in result && 'savedItem' in result) {
        this.items = result.items;
        this.saveToLocalStorage();
        this.renderItems();
        
        // Show feedback message based on whether it was a duplicate
        if (result.savedItem && (result.savedItem as any).isDuplicate) {
          this.showMessage('Link already exists', 'warning');
          // Highlight the existing item
          this.highlightExistingItem(result.savedItem.id);
        } else {
          this.showMessage('Link saved successfully', 'success');
        }
      }
    } catch (error) {
      console.error('Failed to save link:', error);
      this.showMessage('Failed to save link', 'error');
    }
  }

  private async loadSavedItems() {
    try {
      // First try to load from localStorage
      const localItems = this.loadFromLocalStorage();
      if (localItems.length > 0) {
        this.items = localItems;
      } else {
        // Fallback to main process if localStorage is empty
        this.items = await window.electronAPI.links.getSavedLinks();
      }
      this.renderItems();
    } catch (error) {
      console.error('Failed to load links:', error);
    }
  }

  private renderItems() {
    this.itemsCount.textContent = this.items.length.toString();
    
    if (this.items.length === 0) {
      this.itemsContainer.innerHTML = '<div class="no-items">No saved links</div>';
      return;
    }

    this.itemsContainer.innerHTML = this.items
      .map(item => this.renderItem(item))
      .join('');

    // Add event listeners to newly created items
    this.itemsContainer.querySelectorAll('.link-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        // Don't trigger on delete button clicks or drag handle
        if ((e.target as HTMLElement).classList.contains('delete-btn') || 
            (e.target as HTMLElement).classList.contains('drag-handle')) {
          return;
        }
        
        const id = (item as HTMLElement).dataset.id!;
        const linkItem = this.items.find(i => i.id === id);
        if (linkItem) {
          try {
            await window.electronAPI.links.openLink(linkItem.url);
          } catch (error) {
            console.error('Failed to open link:', error);
            this.showMessage('Failed to open link', 'error');
          }
        }
      });
    });

    this.itemsContainer.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent link opening
        const id = (e.target as HTMLElement).dataset.id!;
        this.items = await window.electronAPI.links.deleteLink(id, this.items);
        this.saveToLocalStorage();
        this.renderItems();
      });
    });

    // Add drag and drop event listeners
    this.dragUtil.setupDragAndDrop(
      this.itemsContainer,
      '.link-item',
      this.items,
      (fromIndex: number, toIndex: number) => this.reorderItems(fromIndex, toIndex)
    );
  }

  private renderItem(item: LinkItem): string {
    const timeAgo = Utils.formatTimeAgo(item.timestamp);
    
    return `
      <div class="link-item" data-id="${item.id}" title="Click to open ${Utils.escapeHtml(item.url)}" draggable="true">
        <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
        <div class="item-content">
          <div class="item-text">${Utils.escapeHtml(item.name)}</div>
          <div class="item-meta">${Utils.escapeHtml(item.url)} • ${timeAgo}</div>
        </div>
        <div class="item-actions">
          <button class="delete-btn btn btn-small btn-danger" data-id="${item.id}" title="Delete link">×</button>
        </div>
      </div>
    `;
  }

  private reorderItems(fromIndex: number, toIndex: number) {
    this.items = Utils.reorderArray(this.items, fromIndex, toIndex);
    this.saveToLocalStorage();
    this.renderItems();
  }

  private highlightExistingItem(itemId: string) {
    Utils.highlightExistingItem(itemId);
  }

  private showMessage(message: string, type: 'success' | 'warning' | 'error') {
    Utils.showMessage(message, type);
  }
}

// Tasks Manager Class
class TasksManager {
  private items: TaskItem[] = [];
  private itemsContainer: HTMLElement;
  private itemsCount: HTMLElement;
  private taskInput: HTMLInputElement;
  private dragUtil: DragToReorderUtil;
  private editingTaskId: string | null = null;

  constructor() {
    this.itemsContainer = document.getElementById('tasks-items')!;
    this.itemsCount = document.getElementById('tasks-count')!;
    this.taskInput = document.getElementById('task-input') as HTMLInputElement;
    this.dragUtil = new DragToReorderUtil();
    
    this.init();
  }

  private async init() {
    this.setupEventListeners();
    await this.loadSavedItems();
    this.setupGlobalEventListeners();
  }

  private setupGlobalEventListeners() {
    document.addEventListener('clearAllTasks', async () => {
      this.items = [];
      this.saveToLocalStorage();
      this.renderItems();
    });
  }

  private saveToLocalStorage() {
    Utils.saveToLocalStorage('taskItems', this.items);
  }

  private loadFromLocalStorage(): TaskItem[] {
    return Utils.loadFromLocalStorage<TaskItem>('taskItems');
  }

  private setupEventListeners() {
    document.getElementById('add-task')?.addEventListener('click', async () => {
      const text = this.taskInput.value.trim();
      
      if (!text) {
        this.showMessage('Please enter a task', 'error');
        return;
      }
      
      await this.saveItem(text);
      this.taskInput.value = '';
    });

    this.taskInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = this.taskInput.value.trim();
        
        if (!text) {
          this.showMessage('Please enter a task', 'error');
          return;
        }
        
        await this.saveItem(text);
        this.taskInput.value = '';
      }
    });
  }

  private async saveItem(text: string) {
    try {
      const result = await window.electronAPI.tasks.saveTask(text, this.items);
      
      this.items = result.items;
      this.saveToLocalStorage();
      this.renderItems();
      
      this.showMessage('Task added successfully', 'success');
    } catch (error) {
      console.error('Failed to save task:', error);
      this.showMessage('Failed to save task', 'error');
    }
  }

  private async loadSavedItems() {
    try {
      // First try to load from localStorage
      const localItems = this.loadFromLocalStorage();
      if (localItems.length > 0) {
        this.items = localItems;
      } else {
        // Fallback to main process if localStorage is empty
        this.items = await window.electronAPI.tasks.getSavedTasks();
      }
      this.renderItems();
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }

  private renderItems() {
    this.itemsCount.textContent = this.items.length.toString();
    
    if (this.items.length === 0) {
      this.itemsContainer.innerHTML = '<div class="no-items">No tasks yet</div>';
      return;
    }

    this.itemsContainer.innerHTML = this.items
      .map(item => this.renderItem(item))
      .join('');

    // Add event listeners to newly created items
    this.itemsContainer.querySelectorAll('.task-checkbox').forEach(checkbox => {
      checkbox.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (checkbox as HTMLElement).dataset.id!;
        const task = this.items.find(i => i.id === id);
        if (task) {
          await this.toggleTaskCompletion(task);
        }
      });
    });

    this.itemsContainer.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (e.target as HTMLElement).dataset.id!;
        if (this.editingTaskId && this.editingTaskId !== id) {
          await this.cancelEdit();
        }
        this.startEdit(id);
      });
    });

    this.itemsContainer.querySelectorAll('.save-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (e.target as HTMLElement).dataset.id!;
        await this.saveEdit(id);
      });
    });

    this.itemsContainer.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.cancelEdit();
      });
    });

    this.itemsContainer.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (e.target as HTMLElement).dataset.id!;
        this.items = await window.electronAPI.tasks.deleteTask(id, this.items);
        this.saveToLocalStorage();
        this.renderItems();
      });
    });

    this.itemsContainer.querySelectorAll('.task-edit-input').forEach(input => {
      input.addEventListener('keydown', async (e) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter') {
          e.preventDefault();
          const id = (input as HTMLElement).dataset.id!;
          await this.saveEdit(id);
        } else if (keyEvent.key === 'Escape') {
          e.preventDefault();
          await this.cancelEdit();
        }
      });
    });

    // Add drag and drop event listeners
    this.dragUtil.setupDragAndDrop(
      this.itemsContainer,
      '.task-item',
      this.items,
      (fromIndex: number, toIndex: number) => this.reorderItems(fromIndex, toIndex)
    );
  }

  private renderItem(item: TaskItem): string {
    const timeAgo = Utils.formatTimeAgo(item.timestamp);
    const isEditing = this.editingTaskId === item.id;
    
    return `
      <div class="task-item ${item.completed ? 'completed' : ''} ${isEditing ? 'editing' : ''}" data-id="${item.id}" draggable="true">
        <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
        <div class="task-checkbox ${item.completed ? 'checked' : ''}" data-id="${item.id}" title="${item.completed ? 'Mark incomplete' : 'Mark complete'}"></div>
        <div class="item-content">
          <div class="item-text" title="${Utils.escapeHtml(item.text)}">${Utils.escapeHtml(item.text)}</div>
          <input type="text" class="task-edit-input" data-id="${item.id}" value="${Utils.escapeHtml(item.text)}" />
          <div class="item-meta">${timeAgo}</div>
        </div>
        <div class="task-actions">
          ${isEditing ? `
            <button class="save-btn edit-btn" data-id="${item.id}" title="Save changes">✓</button>
            <button class="cancel-btn edit-btn" data-id="${item.id}" title="Cancel editing">✕</button>
          ` : `
            <button class="edit-btn" data-id="${item.id}" title="Edit task">✎</button>
            <button class="delete-btn btn btn-small btn-danger" data-id="${item.id}" title="Delete task">×</button>
          `}
        </div>
      </div>
    `;
  }

  private async toggleTaskCompletion(task: TaskItem) {
    try {
      const updates = { completed: !task.completed };
      this.items = await window.electronAPI.tasks.updateTask(task.id, updates, this.items);
      this.saveToLocalStorage();
      this.renderItems();
      
      this.showMessage(
        task.completed ? 'Task marked incomplete' : 'Task completed!',
        'success'
      );
    } catch (error) {
      console.error('Failed to update task:', error);
      this.showMessage('Failed to update task', 'error');
    }
  }

  private startEdit(taskId: string) {
    this.editingTaskId = taskId;
    this.renderItems();
    
    // Focus the input
    const input = document.querySelector(`[data-id="${taskId}"].task-edit-input`) as HTMLInputElement;
    if (input) {
      input.focus();
      input.select();
    }
  }

  private async saveEdit(taskId: string) {
    const input = document.querySelector(`[data-id="${taskId}"].task-edit-input`) as HTMLInputElement;
    if (!input) return;
    
    const newText = input.value.trim();
    if (!newText) {
      this.showMessage('Task cannot be empty', 'error');
      return;
    }
    
    try {
      const updates = { text: newText };
      this.items = await window.electronAPI.tasks.updateTask(taskId, updates, this.items);
      this.saveToLocalStorage();
      this.editingTaskId = null;
      this.renderItems();
      
      this.showMessage('Task updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update task:', error);
      this.showMessage('Failed to update task', 'error');
    }
  }

  private async cancelEdit() {
    this.editingTaskId = null;
    this.renderItems();
  }

  private reorderItems(fromIndex: number, toIndex: number) {
    this.items = Utils.reorderArray(this.items, fromIndex, toIndex);
    this.saveToLocalStorage();
    this.renderItems();
  }

  private showMessage(message: string, type: 'success' | 'warning' | 'error') {
    Utils.showMessage(message, type);
  }
}

// Images Manager Class
class ImagesManager {
  private currentImageData: string | null = null;
  private uploadArea: HTMLElement;
  private fileInput: HTMLInputElement;
  private uploadPlaceholder: HTMLElement;
  private currentImageContainer: HTMLElement;
  private currentImageElement: HTMLImageElement;
  private imagePrompt: HTMLTextAreaElement;
  private generateButton: HTMLElement;
  private imageResults: HTMLElement;
  private changeImageButton: HTMLElement;
  private clearImageButton: HTMLElement;

  constructor() {
    this.uploadArea = document.getElementById('image-upload-area')!;
    this.fileInput = document.getElementById('image-file-input') as HTMLInputElement;
    this.uploadPlaceholder = document.querySelector('.upload-placeholder')!;
    this.currentImageContainer = document.getElementById('current-image-container')!;
    this.currentImageElement = document.getElementById('current-image') as HTMLImageElement;
    this.imagePrompt = document.getElementById('image-prompt') as HTMLTextAreaElement;
    this.generateButton = document.getElementById('generate-image')!;
    this.imageResults = document.getElementById('image-results')!;
    this.changeImageButton = document.getElementById('change-image')!;
    this.clearImageButton = document.getElementById('clear-image')!;
    
    this.init();
  }

  private init() {
    this.setupEventListeners();
    this.setupGlobalEventListeners();
    this.loadSavedImage();
  }

  private setupGlobalEventListeners() {
    document.addEventListener('clearAllImages', () => {
      this.clearImage();
    });
  }

  private setupEventListeners() {
    // Upload area click
    this.uploadArea.addEventListener('click', (e) => {
      if (e.target === this.uploadArea || e.target === this.uploadPlaceholder || 
          this.uploadPlaceholder.contains(e.target as Node)) {
        this.fileInput.click();
      }
    });

    // File input change
    this.fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.handleImageUpload(file);
      }
    });

    // Drag and drop
    this.uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.uploadArea.classList.add('dragover');
    });

    this.uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.uploadArea.classList.remove('dragover');
    });

    this.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadArea.classList.remove('dragover');
      
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          this.handleImageUpload(file);
        } else {
          this.showMessage('Please upload an image file', 'error');
        }
      }
    });

    // Change image button
    this.changeImageButton.addEventListener('click', () => {
      this.fileInput.click();
    });

    // Clear image button
    this.clearImageButton.addEventListener('click', () => {
      this.clearImage();
    });

    // Generate button
    this.generateButton.addEventListener('click', () => {
      this.generateImage();
    });

    // Enter key to generate (Ctrl/Cmd + Enter for new line)
    this.imagePrompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.generateImage();
      }
    });
  }

  private handleImageUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      this.showMessage('Please select a valid image file', 'error');
      return;
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.showMessage('Image file is too large. Please select a file under 10MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      this.currentImageData = dataUrl;
      this.displayCurrentImage(dataUrl);
      this.saveImageToLocalStorage();
      this.showMessage('Image uploaded successfully', 'success');
    };
    reader.onerror = () => {
      this.showMessage('Failed to read image file', 'error');
    };
    reader.readAsDataURL(file);
  }

  private displayCurrentImage(dataUrl: string) {
    this.currentImageElement.src = dataUrl;
    this.uploadPlaceholder.style.display = 'none';
    this.currentImageContainer.style.display = 'flex';
  }

  private clearImage() {
    this.currentImageData = null;
    this.currentImageElement.src = '';
    this.uploadPlaceholder.style.display = 'flex';
    this.currentImageContainer.style.display = 'none';
    this.fileInput.value = '';
    this.saveImageToLocalStorage();
    this.showResults('Upload an image and enter a prompt to get started.', 'default');
    this.showMessage('Image cleared', 'success');
  }

  private async generateImage() {
    const prompt = this.imagePrompt.value.trim();
    
    if (!prompt) {
      this.showMessage('Please enter a prompt describing what you want to do with the image', 'error');
      return;
    }

    if (!this.currentImageData) {
      this.showMessage('Please upload an image first', 'error');
      return;
    }

    // Show loading state
    this.showResults('Generating image...', 'loading');
    this.generateButton.textContent = 'Generating...';
    this.generateButton.setAttribute('disabled', 'true');

    try {
      // For now, just simulate image generation
      // In a real implementation, you would call an API like OpenAI DALL-E or Stable Diffusion
      await this.simulateImageGeneration(prompt);
    } catch (error) {
      console.error('Image generation error:', error);
      this.showResults('Error generating image. Please try again.', 'error');
    } finally {
      this.generateButton.textContent = 'Generate Image';
      this.generateButton.removeAttribute('disabled');
    }
  }

  private async simulateImageGeneration(prompt: string): Promise<void> {
    try {
      // Use IPC to call the main process which has access to environment variables
      const response = await window.electronAPI.images.generateImage(prompt, this.currentImageData!);
      
      if (!response.success) {
        throw new Error(response.error || 'Unknown error occurred');
      }

      let resultHtml = '';
      
      if (response.type === 'image') {
        resultHtml = `
          <div class="generation-result">
            <p><strong>Your Prompt:</strong> ${Utils.escapeHtml(prompt)}</p>
            <div class="generated-image-container">
              <div class="image-container">
                <p><strong>Generated Image:</strong></p>
                <img src="${response.result}" alt="Generated image" class="generated-image" id="generated-image-${Date.now()}">
                <div class="image-actions">
                  <button class="btn btn-secondary copy-image-btn" data-image-src="${response.result}">Copy Image</button>
                </div>
              </div>
            </div>
          </div>
        `;
        this.showMessage('Image generated successfully!', 'success');
      } else {
        // We got a text response (fallback for analysis)
        resultHtml = `
          <div class="generation-result">
            <p><strong>Your Prompt:</strong> ${Utils.escapeHtml(prompt)}</p>
            <img src="${this.currentImageData}" alt="Original image" class="generated-image">
            <div class="ai-response">
              <p><strong>AI Response:</strong></p>
              <div class="response-text">${Utils.escapeHtml(response.result || 'No response generated')}</div>
            </div>
          </div>
        `;
        this.showMessage('AI response generated!', 'success');
      }
      
      this.showResults(resultHtml, 'success');
      
      // Add event listeners for copy buttons
      this.addCopyButtonListeners();
      
    } catch (error) {
      console.error('Image generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.showResults(`Error: ${errorMessage}`, 'error');
      this.showMessage('Failed to generate image', 'error');
    }
  }

  private showResults(content: string, type: 'success' | 'error' | 'loading' | 'default') {
    this.imageResults.innerHTML = content;
    this.imageResults.className = `image-results ${type}`;
  }

  private addCopyButtonListeners() {
    const copyButtons = this.imageResults.querySelectorAll('.copy-image-btn');
    copyButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        const target = e.target as HTMLButtonElement;
        const imageSrc = target.getAttribute('data-image-src');
        
        if (imageSrc) {
          try {
            await this.copyImageToClipboard(imageSrc);
            this.showMessage('Image copied to clipboard!', 'success');
            
            // Visual feedback - temporarily change button text
            const originalText = target.textContent;
            target.textContent = 'Copied!';
            target.disabled = true;
            
            setTimeout(() => {
              target.textContent = originalText;
              target.disabled = false;
            }, 2000);
            
          } catch (error) {
            console.error('Failed to copy image:', error);
            this.showMessage('Failed to copy image to clipboard', 'error');
          }
        }
      });
    });
  }

  private async copyImageToClipboard(dataUrl: string) {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Use the Clipboard API to copy the image
      if (navigator.clipboard && window.ClipboardItem) {
        const clipboardItem = new ClipboardItem({
          [blob.type]: blob
        });
        await navigator.clipboard.write([clipboardItem]);
      } else {
        // Fallback: create a temporary canvas and copy as image
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          
          canvas.toBlob(async (blob) => {
            if (blob && navigator.clipboard && window.ClipboardItem) {
              const clipboardItem = new ClipboardItem({
                [blob.type]: blob
              });
              await navigator.clipboard.write([clipboardItem]);
            }
          });
        };
        img.src = dataUrl;
      }
    } catch (error) {
      console.error('Error copying image to clipboard:', error);
      throw error;
    }
  }

  private saveImageToLocalStorage() {
    try {
      if (this.currentImageData) {
        localStorage.setItem('currentImage', this.currentImageData);
      } else {
        localStorage.removeItem('currentImage');
      }
    } catch (error) {
      console.error('Failed to save image to localStorage:', error);
    }
  }

  private loadSavedImage() {
    try {
      const savedImage = localStorage.getItem('currentImage');
      if (savedImage) {
        this.currentImageData = savedImage;
        this.displayCurrentImage(savedImage);
      }
    } catch (error) {
      console.error('Failed to load saved image:', error);
    }
  }

  private showMessage(message: string, type: 'success' | 'warning' | 'error') {
    Utils.showMessage(message, type);
  }
}

// Summarize Manager Class
class SummarizeManager {
  private overlayButton: HTMLElement;
  private recordingButton: HTMLElement;
  private intervalMinutesInput: HTMLInputElement;
  private intervalSecondsInput: HTMLInputElement;
  private overlaySummaryContainer: HTMLElement;
  private resultsContainer: HTMLElement;
  private isOverlayActive = false;
  private isRecordingActive = false;
  private currentInterval = 300; // Default 5 minutes in seconds
  
  // Email configuration elements
  private emailToggle: HTMLInputElement;
  private emailRecipientInput: HTMLInputElement;
  private emailKeywordsTextarea: HTMLTextAreaElement;
  private saveEmailConfigButton: HTMLElement;
  private testEmailButton: HTMLElement;
  private emailConfigSection: HTMLElement;
  
  // Email configuration state
  private emailConfig = {
    enabled: false,
    recipientEmail: '',
    keywords: [] as string[]
  };

  constructor() {
    this.overlayButton = document.getElementById('start-overlay')!;
    this.recordingButton = document.getElementById('start-recording')!;
    this.intervalMinutesInput = document.getElementById('interval-minutes') as HTMLInputElement;
    this.intervalSecondsInput = document.getElementById('interval-seconds') as HTMLInputElement;
    this.overlaySummaryContainer = document.getElementById('overlay-summary')!;
    this.resultsContainer = document.getElementById('overlay-summary')!; // Use same container
    
    // Email configuration elements
    this.emailToggle = document.getElementById('email-notifications-toggle') as HTMLInputElement;
    this.emailRecipientInput = document.getElementById('email-recipient') as HTMLInputElement;
    this.emailKeywordsTextarea = document.getElementById('email-keywords') as HTMLTextAreaElement;
    this.saveEmailConfigButton = document.getElementById('save-email-config')!;
    this.testEmailButton = document.getElementById('test-email')!;
    this.emailConfigSection = document.querySelector('.form-section:last-child') as HTMLElement;
    
    this.init();
  }

  private init() {
    this.setupEventListeners();
    this.setupOverlayStateListener();
    this.loadEmailConfiguration();
  }

  private setupEventListeners() {
    // Overlay button
    this.overlayButton.addEventListener('click', () => {
      this.toggleOverlay();
    });

    // Recording button
    this.recordingButton.addEventListener('click', () => {
      if (this.isRecordingActive) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });

    // Interval inputs
    this.intervalMinutesInput.addEventListener('input', () => {
      this.updateCurrentInterval();
    });

    this.intervalSecondsInput.addEventListener('input', () => {
      this.updateCurrentInterval();
    });

    // Load saved interval preference
    this.loadIntervalPreference();

    // Email configuration event listeners
    this.emailToggle.addEventListener('change', () => {
      this.toggleEmailNotifications();
    });

    this.saveEmailConfigButton.addEventListener('click', () => {
      this.saveEmailConfiguration();
    });

    this.testEmailButton.addEventListener('click', () => {
      this.sendTestEmail();
    });

    // Auto-save email config when inputs change
    this.emailRecipientInput.addEventListener('blur', () => {
      this.saveEmailConfiguration();
    });

    this.emailKeywordsTextarea.addEventListener('blur', () => {
      this.saveEmailConfiguration();
    });
  }

  private setupOverlayStateListener() {
    // Listen for when the overlay window is closed externally
    // This helps keep the button state in sync
    if (window.electronAPI) {
      // Listen for overlay summaries from the main process
      window.electronAPI.overlay.onOverlaySummary((summary) => {
        this.updateOverlaySummary(summary);
      });
      
      // We'll use a simple approach - check overlay state periodically
      // In a more sophisticated implementation, you'd use IPC events
      setInterval(() => {
        this.checkOverlayState();
      }, 2000); // Check every 2 seconds
    }
  }

  private async checkOverlayState() {
    // This is a simple way to check if overlay is still active
    // In a production app, you'd want proper IPC communication
    // For now, we'll assume the overlay is still active if the button shows "Stop Overlay"
    if (this.overlayButton.textContent === 'Stop Overlay' && !this.isOverlayActive) {
      this.isOverlayActive = true;
    } else if (this.overlayButton.textContent === 'Start Overlay' && this.isOverlayActive) {
      this.isOverlayActive = false;
    }
  }

  private async updateOverlaySummary(summary: string) {
    if (this.overlaySummaryContainer) {
      this.overlaySummaryContainer.textContent = summary;
      this.overlaySummaryContainer.className = 'overlay-summary success';
      
      // Show a brief success message
      this.showMessage('New overlay summary received!', 'success');
      
      // Automatically check if email should be sent based on keywords
      await this.checkAndSendEmail(summary);
    }
  }

  private async checkAndSendEmail(summary: string) {
    try {
      const summaryData = {
        summary: summary,
        timestamp: new Date().toISOString(),
        keywords: this.emailConfig.keywords
      };

      const result = await window.electronAPI.email.sendSummary(summaryData, this.emailConfig);
      
      if (result.success && result.matchedKeywords && result.matchedKeywords.length > 0) {
        this.showMessage(`Email sent! Matched keywords: ${result.matchedKeywords.join(', ')}`, 'success');
      } else if (result.success && !result.matchedKeywords?.length) {
        // Summary doesn't match any keywords, no email sent
      } else {
        console.error('Failed to send email:', result.error);
      }
    } catch (error) {
      console.error('Error checking keywords and sending email:', error);
    }
  }


  private async toggleOverlay() {
    try {
      if (this.isOverlayActive) {
        // Stop overlay and recording
        this.overlayButton.textContent = 'Stopping...';
        this.overlayButton.setAttribute('disabled', 'true');

        // Stop recording if it's active
        if (this.isRecordingActive) {
          await window.electronAPI.overlay.stopInterval();
          this.isRecordingActive = false;
          this.recordingButton.textContent = 'Start Recording';
          this.recordingButton.classList.remove('recording');
          this.intervalMinutesInput.removeAttribute('disabled');
          this.intervalSecondsInput.removeAttribute('disabled');
        }

        await window.electronAPI.overlay.closeWindow();
        
        this.isOverlayActive = false;
        this.overlayButton.textContent = 'Start Overlay';
        this.overlayButton.classList.remove('active');
        this.overlayButton.removeAttribute('disabled');
        this.updateOverlaySummary('No overlay summaries yet. Start the overlay to begin monitoring.');
        this.showMessage('Overlay and recording stopped successfully', 'success');
      } else {
        // Start overlay
        this.overlayButton.textContent = 'Starting...';
        this.overlayButton.setAttribute('disabled', 'true');

        const result = await window.electronAPI.overlay.create();
        
        if (result.success) {
          this.isOverlayActive = true;
          this.overlayButton.textContent = 'Stop Overlay';
          this.overlayButton.classList.add('active');
          this.overlayButton.removeAttribute('disabled');
          this.updateOverlaySummary('Overlay window opened. Start recording to begin monitoring.');
          this.showMessage('Overlay started! You can now start screen recording.', 'success');
        } else {
          this.showMessage('Failed to start overlay', 'error');
          this.overlayButton.textContent = 'Start Overlay';
          this.overlayButton.removeAttribute('disabled');
        }
      }
    } catch (error) {
      console.error('Overlay toggle error:', error);
      this.showMessage('Failed to toggle overlay', 'error');
      this.isOverlayActive = false;
      this.overlayButton.textContent = 'Start Overlay';
      this.overlayButton.classList.remove('active');
      this.overlayButton.removeAttribute('disabled');
    }
  }

  private async startRecording() {
    try {
      if (!this.isOverlayActive) {
        this.showMessage('Please start the overlay window first', 'warning');
        return;
      }

      this.recordingButton.textContent = 'Starting...';
      this.recordingButton.setAttribute('disabled', 'true');

      const result = await window.electronAPI.overlay.startRecording(this.currentInterval);
      
      if (result.success) {
        this.isRecordingActive = true;
        this.recordingButton.textContent = 'Stop Recording';
        this.recordingButton.classList.add('recording');
        this.recordingButton.removeAttribute('disabled');
        this.intervalMinutesInput.setAttribute('disabled', 'true');
        this.intervalSecondsInput.setAttribute('disabled', 'true');
        this.updateOverlaySummary('Recording started. Waiting for first summary...');
        this.showMessage(`Screen recording started! Screenshots will be taken every ${this.formatInterval(this.currentInterval)}.`, 'success');
      } else {
        this.showMessage('Failed to start recording', 'error');
        this.recordingButton.textContent = 'Start Recording';
        this.recordingButton.removeAttribute('disabled');
      }
    } catch (error) {
      console.error('Recording start error:', error);
      this.showMessage('Failed to start recording', 'error');
      this.recordingButton.textContent = 'Start Recording';
      this.recordingButton.removeAttribute('disabled');
    }
  }

  private async stopRecording() {
    try {
      this.recordingButton.textContent = 'Stopping...';
      this.recordingButton.setAttribute('disabled', 'true');

      await window.electronAPI.overlay.stopInterval();
      
      this.isRecordingActive = false;
      this.recordingButton.textContent = 'Start Recording';
      this.recordingButton.classList.remove('recording');
      this.recordingButton.removeAttribute('disabled');
      this.intervalMinutesInput.removeAttribute('disabled');
      this.intervalSecondsInput.removeAttribute('disabled');
      this.updateOverlaySummary('Recording stopped. Start recording to resume monitoring.');
      this.showMessage('Screen recording stopped', 'success');
    } catch (error) {
      console.error('Recording stop error:', error);
      this.showMessage('Failed to stop recording', 'error');
      this.recordingButton.textContent = 'Stop Recording';
      this.recordingButton.removeAttribute('disabled');
    }
  }

  private updateCurrentInterval() {
    const minutes = parseInt(this.intervalMinutesInput.value) || 0;
    const seconds = parseInt(this.intervalSecondsInput.value) || 0;
    this.currentInterval = minutes * 60 + seconds;
    
    // Ensure minimum of 30 seconds
    if (this.currentInterval < 30) {
      this.currentInterval = 30;
      this.intervalMinutesInput.value = '0';
      this.intervalSecondsInput.value = '30';
    }
    
    this.saveIntervalPreference();
  }

  private formatInterval(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (minutes === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
      } else {
        return `${hours}h ${minutes}m`;
      }
    }
  }

  private loadIntervalPreference() {
    try {
      const stored = localStorage.getItem('screenshotInterval');
      if (stored) {
        const interval = parseInt(stored);
        if (interval >= 30 && interval <= 600) {
          this.currentInterval = interval;
          const minutes = Math.floor(interval / 60);
          const seconds = interval % 60;
          this.intervalMinutesInput.value = minutes.toString();
          this.intervalSecondsInput.value = seconds.toString();
        }
      }
    } catch (error) {
      console.error('Failed to load interval preference:', error);
    }
  }

  private saveIntervalPreference() {
    try {
      localStorage.setItem('screenshotInterval', this.currentInterval.toString());
    } catch (error) {
      console.error('Failed to save interval preference:', error);
    }
  }

  private showMessage(message: string, type: 'success' | 'warning' | 'error') {
    Utils.showMessage(message, type);
  }

  // Email configuration methods
  private toggleEmailNotifications() {
    this.emailConfig.enabled = this.emailToggle.checked;
    
    // Update UI state
    if (this.emailConfig.enabled) {
      this.emailConfigSection.classList.remove('disabled');
      this.emailRecipientInput.removeAttribute('disabled');
      this.emailKeywordsTextarea.removeAttribute('disabled');
    } else {
      this.emailConfigSection.classList.add('disabled');
      this.emailRecipientInput.setAttribute('disabled', 'true');
      this.emailKeywordsTextarea.setAttribute('disabled', 'true');
    }
    
    this.saveEmailConfiguration();
  }

  private async saveEmailConfiguration() {
    try {
      // Update email config from UI
      this.emailConfig.enabled = this.emailToggle.checked;
      this.emailConfig.recipientEmail = this.emailRecipientInput.value.trim();
      
      // Parse keywords from textarea
      const keywordsText = this.emailKeywordsTextarea.value.trim();
      this.emailConfig.keywords = keywordsText 
        ? keywordsText.split(',').map(keyword => keyword.trim()).filter(keyword => keyword.length > 0)
        : [];

      // Validate configuration
      if (this.emailConfig.enabled) {
        if (!this.emailConfig.recipientEmail) {
          this.showMessage('Please enter a recipient email address', 'warning');
          return;
        }
        
        if (!this.emailConfig.recipientEmail.includes('@')) {
          this.showMessage('Please enter a valid email address', 'error');
          return;
        }
        
        if (this.emailConfig.keywords.length === 0) {
          this.showMessage('Please enter at least one keyword', 'warning');
          return;
        }
      }

      // Save to localStorage
      localStorage.setItem('emailConfiguration', JSON.stringify(this.emailConfig));
      
      this.showMessage('Email configuration saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save email configuration:', error);
      this.showMessage('Failed to save email configuration', 'error');
    }
  }

  private loadEmailConfiguration() {
    try {
      const saved = localStorage.getItem('emailConfiguration');
      if (saved) {
        this.emailConfig = JSON.parse(saved);
        
        // Update UI elements
        this.emailToggle.checked = this.emailConfig.enabled;
        this.emailRecipientInput.value = this.emailConfig.recipientEmail;
        this.emailKeywordsTextarea.value = this.emailConfig.keywords.join(', ');
        
        // Update UI state
        this.toggleEmailNotifications();
      }
    } catch (error) {
      console.error('Failed to load email configuration:', error);
    }
  }

  private async sendTestEmail() {
    try {
      if (!this.emailConfig.enabled) {
        this.showMessage('Please enable email notifications first', 'warning');
        return;
      }

      if (!this.emailConfig.recipientEmail) {
        this.showMessage('Please enter a recipient email address', 'warning');
        return;
      }

      if (this.emailConfig.keywords.length === 0) {
        this.showMessage('Please enter at least one keyword', 'warning');
        return;
      }

      this.testEmailButton.textContent = 'Sending...';
      this.testEmailButton.setAttribute('disabled', 'true');

      // Create a test summary with a keyword to ensure it gets sent
      const testSummary = `This is a test summary containing the keyword "${this.emailConfig.keywords[0]}" to verify email functionality is working correctly.`;
      
      const summaryData = {
        summary: testSummary,
        timestamp: new Date().toISOString(),
        keywords: this.emailConfig.keywords
      };

      const result = await window.electronAPI.email.sendSummary(summaryData, this.emailConfig);
      
      if (result.success && result.matchedKeywords && result.matchedKeywords.length > 0) {
        this.showMessage(`Test email sent successfully! Matched keywords: ${result.matchedKeywords.join(', ')}`, 'success');
      } else if (result.success && !result.matchedKeywords?.length) {
        this.showMessage('Test email not sent - no keywords matched', 'warning');
      } else {
        this.showMessage(`Failed to send test email: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Failed to send test email:', error);
      this.showMessage('Failed to send test email', 'error');
    } finally {
      this.testEmailButton.textContent = 'Send Test Email';
      this.testEmailButton.removeAttribute('disabled');
    }
  }
}

// Timer Manager Class
class TimerManager {
  private timerDisplay: HTMLElement;
  private timerStatus: HTMLElement;
  private hoursInput: HTMLInputElement;
  private minutesInput: HTMLInputElement;
  private secondsInput: HTMLInputElement;
  private startButton: HTMLElement;
  private pauseButton: HTMLElement;
  private resetButton: HTMLElement;
  private presetButtons: NodeListOf<HTMLElement>;
  
  private timeRemaining: number = 0; // in seconds
  private timerId: number | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  
  constructor() {
    this.timerDisplay = document.getElementById('timer-display')!;
    this.timerStatus = document.getElementById('timer-status')!;
    this.hoursInput = document.getElementById('timer-hours') as HTMLInputElement;
    this.minutesInput = document.getElementById('timer-minutes') as HTMLInputElement;
    this.secondsInput = document.getElementById('timer-seconds') as HTMLInputElement;
    this.startButton = document.getElementById('start-timer')!;
    this.pauseButton = document.getElementById('pause-timer')!;
    this.resetButton = document.getElementById('reset-timer')!;
    this.presetButtons = document.querySelectorAll('.preset-btn');
    
    this.init();
  }
  
  private init() {
    this.setupEventListeners();
    this.setupGlobalEventListeners();
    this.loadTimerState();
    this.updateDisplay();
    this.updateButtonStates();
  }

  private setupGlobalEventListeners() {
    document.addEventListener('resetAllSettings', () => {
      this.reset();
    });
  }
  
  private setupEventListeners() {
    // Control buttons
    this.startButton.addEventListener('click', () => this.start());
    this.pauseButton.addEventListener('click', () => this.pause());
    this.resetButton.addEventListener('click', () => this.reset());
    
    // Preset buttons
    this.presetButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const time = parseInt((e.target as HTMLElement).dataset.time || '0');
        this.setTime(time);
      });
    });
    
    // Input validation
    [this.hoursInput, this.minutesInput, this.secondsInput].forEach(input => {
      input.addEventListener('input', () => this.onInputChange());
      input.addEventListener('blur', () => this.validateInput(input));
    });
  }
  
  private start() {
    if (!this.isRunning) {
      // Get time from inputs if timer is not set
      if (this.timeRemaining === 0) {
        const hours = parseInt(this.hoursInput.value) || 0;
        const minutes = parseInt(this.minutesInput.value) || 0;
        const seconds = parseInt(this.secondsInput.value) || 0;
        this.timeRemaining = hours * 3600 + minutes * 60 + seconds;
      }
      
      if (this.timeRemaining > 0) {
        this.isRunning = true;
        this.isPaused = false;
        this.updateButtonStates();
        this.updateStatus('Running...');
        this.startCountdown();
        this.saveTimerState();
      } else {
        // Show a message if no time is set
        Utils.showMessage('Please set a time before starting the timer', 'warning');
      }
    }
  }
  
  private pause() {
    if (this.isRunning) {
      this.isRunning = false;
      this.isPaused = true;
      this.stopCountdown();
      this.updateButtonStates();
      this.updateStatus('Paused');
      this.saveTimerState();
    }
  }
  
  private reset() {
    this.isRunning = false;
    this.isPaused = false;
    this.timeRemaining = 0;
    this.stopCountdown();
    this.clearInputs();
    this.updateDisplay();
    this.updateButtonStates();
    this.updateStatus('Ready to start');
    this.removeTimerClasses();
    this.saveTimerState();
  }
  
  private startCountdown() {
    this.timerId = window.setInterval(() => {
      this.timeRemaining--;
      this.updateDisplay();
      this.saveTimerState();
      
      if (this.timeRemaining <= 0) {
        this.onTimerComplete();
      }
    }, 1000);
    
    this.timerDisplay.parentElement?.classList.add('running');
    this.timerDisplay.parentElement?.classList.remove('paused', 'finished');
  }
  
  private stopCountdown() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    
    if (this.isPaused) {
      this.timerDisplay.parentElement?.classList.add('paused');
      this.timerDisplay.parentElement?.classList.remove('running', 'finished');
    } else {
      this.timerDisplay.parentElement?.classList.remove('running', 'paused', 'finished');
    }
  }
  
  private onTimerComplete() {
    this.isRunning = false;
    this.isPaused = false;
    this.timeRemaining = 0;
    this.stopCountdown();
    this.updateDisplay();
    this.updateButtonStates();
    this.updateStatus('Time\'s up!');
    this.timerDisplay.parentElement?.classList.add('finished');
    this.timerDisplay.parentElement?.classList.remove('running', 'paused');
    this.saveTimerState();
    
    // Show notification
    this.showNotification();
  }
  
  private showNotification() {
    // Try to show system notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Timer Complete!', {
        body: 'Your timer has finished.',
        icon: '/icon.png'
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Timer Complete!', {
            body: 'Your timer has finished.',
            icon: '/icon.png'
          });
        }
      });
    }
    
    // Also show in-app message
    Utils.showMessage('Timer completed!', 'success');
  }
  
  private setTime(seconds: number) {
    // Reset timer state first
    this.isRunning = false;
    this.isPaused = false;
    this.stopCountdown();
    
    this.timeRemaining = seconds;
    this.updateInputsFromTime();
    this.updateDisplay();
    this.updateButtonStates();
    this.updateStatus('Ready to start');
    this.removeTimerClasses();
    this.saveTimerState();
  }
  
  private updateInputsFromTime() {
    const hours = Math.floor(this.timeRemaining / 3600);
    const minutes = Math.floor((this.timeRemaining % 3600) / 60);
    const seconds = this.timeRemaining % 60;
    
    this.hoursInput.value = hours > 0 ? hours.toString() : '';
    this.minutesInput.value = minutes > 0 ? minutes.toString() : '';
    this.secondsInput.value = seconds > 0 ? seconds.toString() : '';
  }
  
  private updateDisplay() {
    const hours = Math.floor(this.timeRemaining / 3600);
    const minutes = Math.floor((this.timeRemaining % 3600) / 60);
    const seconds = this.timeRemaining % 60;
    
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    this.timerDisplay.textContent = timeString;
  }
  
  private updateButtonStates() {
    const hasTime = this.timeRemaining > 0 || this.hasInputTime();
    
    // Force a reflow to ensure DOM is updated
    requestAnimationFrame(() => {
      if (this.isRunning) {
        this.startButton.style.display = 'none';
        this.pauseButton.style.display = 'inline-block';
        (this.pauseButton as HTMLButtonElement).disabled = false;
      } else {
        this.startButton.style.display = 'inline-block';
        this.pauseButton.style.display = 'none';
        (this.startButton as HTMLButtonElement).disabled = !hasTime;
      }
      
      (this.resetButton as HTMLButtonElement).disabled = !hasTime && !this.isRunning && !this.isPaused;
    });
  }
  
  private updateStatus(status: string) {
    this.timerStatus.textContent = status;
  }
  
  private hasInputTime(): boolean {
    const hours = parseInt(this.hoursInput.value) || 0;
    const minutes = parseInt(this.minutesInput.value) || 0;
    const seconds = parseInt(this.secondsInput.value) || 0;
    return hours > 0 || minutes > 0 || seconds > 0;
  }
  
  private onInputChange() {
    // Clear any existing timer state when user changes inputs
    if (!this.isRunning && !this.isPaused) {
      this.timeRemaining = 0;
      this.updateStatus('Ready to start');
    }
    
    // Update button states immediately
    this.updateButtonStates();
  }
  
  private validateInput(input: HTMLInputElement) {
    const value = parseInt(input.value);
    const max = input === this.hoursInput ? 23 : 59;
    
    if (isNaN(value) || value < 0) {
      input.value = '';
    } else if (value > max) {
      input.value = max.toString();
    }
  }
  
  private clearInputs() {
    this.hoursInput.value = '';
    this.minutesInput.value = '';
    this.secondsInput.value = '';
  }
  
  private removeTimerClasses() {
    this.timerDisplay.parentElement?.classList.remove('running', 'paused', 'finished');
  }
  
  private saveTimerState() {
    const state = {
      timeRemaining: this.timeRemaining,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem('timerState', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save timer state:', error);
    }
  }
  
  private loadTimerState() {
    try {
      const stored = localStorage.getItem('timerState');
      if (!stored) return;
      
      const state = JSON.parse(stored);
      const timeDiff = Math.floor((Date.now() - state.timestamp) / 1000);
      
      if (state.isRunning && state.timeRemaining > 0) {
        // Calculate remaining time accounting for elapsed time
        this.timeRemaining = Math.max(0, state.timeRemaining - timeDiff);
        
        if (this.timeRemaining > 0) {
          this.isRunning = true;
          this.isPaused = false;
          this.startCountdown();
          this.updateStatus('Running...');
        } else {
          // Timer should have completed while app was closed
          this.onTimerComplete();
        }
      } else if (state.isPaused) {
        this.timeRemaining = state.timeRemaining;
        this.isPaused = true;
        this.isRunning = false;
        this.updateInputsFromTime();
        this.updateStatus('Paused');
        this.timerDisplay.parentElement?.classList.add('paused');
      } else {
        this.timeRemaining = state.timeRemaining;
        this.updateInputsFromTime();
      }
      
      this.updateButtonStates();
    } catch (error) {
      console.error('Failed to load timer state:', error);
    }
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize tab manager
  new TabManager();
  
  // Initialize grammar checker
  new GrammarChecker();
  
  // Initialize images manager
  new ImagesManager();
  
  // Initialize summarize manager
  new SummarizeManager();
  
  // Initialize timer manager
  new TimerManager();
  
  // Wait for electronAPI to be available for clipboard functionality
  if (window.electronAPI) {
    new ClipboardManager();
    new LinksManager();
    new TasksManager();
  } else {
    // Retry after a short delay
    setTimeout(() => {
      if (window.electronAPI) {
        new ClipboardManager();
        new LinksManager();
        new TasksManager();
      }
    }, 100);
  }
});
