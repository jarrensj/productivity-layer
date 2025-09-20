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
        const tabOrder = preferences.tabOrder || ['clipboard', 'grammar', 'links', 'tasks', 'chat'];
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
    
    // Get current tab order from localStorage or use default
    const stored = localStorage.getItem('tabPreferences');
    const currentPreferences = stored ? JSON.parse(stored) : {};
    const defaultOrder = ['clipboard', 'grammar', 'links', 'tasks', 'chat'];
    
    const preferences = {
      clipboardTab: clipboardEnabled,
      grammarTab: grammarEnabled,
      linksTab: linksEnabled,
      tasksTab: tasksEnabled,
      chatTab: chatEnabled,
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
        tabOrder: ['clipboard', 'grammar', 'links', 'tasks', 'chat']
      };
      
      // Apply tab order first
      if (preferences.tabOrder) {
        this.applyTabOrder(preferences.tabOrder);
      }
      
      // Update toggle states
      const clipboardToggle = document.getElementById('clipboard-tab-toggle') as HTMLInputElement;
      const grammarToggle = document.getElementById('grammar-tab-toggle') as HTMLInputElement;
      const linksToggle = document.getElementById('links-tab-toggle') as HTMLInputElement;
      const tasksToggle = document.getElementById('tasks-tab-toggle') as HTMLInputElement;
      const chatToggle = document.getElementById('chat-tab-toggle') as HTMLInputElement;
      
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
      
      // Initialize tab order UI in settings
      this.initializeTabOrderUI(preferences.tabOrder || ['clipboard', 'grammar', 'links', 'tasks', 'chat']);
      
      // Ensure at least one tab is visible and active (with a small delay to ensure DOM is ready)
      setTimeout(() => {
        this.ensureActiveTab();
      }, 100);
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
    
    if (!clipboardToggle || !grammarToggle || !linksToggle || !tasksToggle || !chatToggle) return false;
    
    // Count how many tabs would remain enabled after disabling this one
    const remainingTabs = [];
    if (tabName !== 'clipboard' && clipboardToggle.checked) remainingTabs.push('clipboard');
    if (tabName !== 'grammar' && grammarToggle.checked) remainingTabs.push('grammar');
    if (tabName !== 'links' && linksToggle.checked) remainingTabs.push('links');
    if (tabName !== 'tasks' && tasksToggle.checked) remainingTabs.push('tasks');
    if (tabName !== 'chat' && chatToggle.checked) remainingTabs.push('chat');
    
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

        // Find the Chat Tab toggle (last toggle) to insert after it
        const settingItems = Array.from(interfaceSection.querySelectorAll('.setting-item'));
        const chatTabToggle = settingItems.find(item => {
          const strong = item.querySelector('strong');
          return strong && strong.textContent?.trim() === 'Chat Tab';
        });
        
        if (chatTabToggle) {
          chatTabToggle.insertAdjacentHTML('afterend', tabOrderHTML);
          tabOrderContainer = document.getElementById('tab-order-container');
          console.log('Tab order container created after Chat Tab toggle');
        } else {
          // Fallback: insert at the end of the interface section
          interfaceSection.insertAdjacentHTML('beforeend', tabOrderHTML);
          tabOrderContainer = document.getElementById('tab-order-container');
          console.log('Tab order container created as fallback');
        }
      }

      if (tabOrderContainer) {
        this.renderTabOrderList(tabOrder);
        this.setupTabOrderDragAndDrop();
        console.log('Tab order UI initialized with order:', tabOrder);
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
      chat: 'Chat'
    };

    const tabOrderHTML = tabOrder.map(tabName => `
      <div class="tab-order-item" data-tab="${tabName}" draggable="true">
        <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
        <span class="tab-name">${tabLabels[tabName as keyof typeof tabLabels] || tabName}</span>
      </div>
    `).join('');

    tabOrderList.innerHTML = tabOrderHTML;
    console.log('Rendered tab order list with HTML:', tabOrderHTML);
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

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize tab manager
  new TabManager();
  
  // Initialize grammar checker
  new GrammarChecker();
  
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
