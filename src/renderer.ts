/**
 * Extended Clipboard Manager - Renderer Process
 * Manages clipboard items with save, copy, and delete functionality
 */

import './index.css';

// Type definitions for the exposed API
interface ClipboardItem {
  id: string;
  text: string;
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

class ClipboardManager {
  private items: ClipboardItem[] = [];
  private itemsContainer: HTMLElement;
  private itemsCount: HTMLElement;
  private clipboardInput: HTMLTextAreaElement;

  constructor() {
    this.itemsContainer = document.getElementById('clipboard-items')!;
    this.itemsCount = document.getElementById('items-count')!;
    this.clipboardInput = document.getElementById('clipboard-input') as HTMLTextAreaElement;
    
    this.init();
  }

  private async init() {
    this.setupEventListeners();
    await this.loadSavedItems();
    this.setupKeyboardShortcuts();
    this.loadTabPreferences();
  }

  private saveToLocalStorage() {
    try {
      localStorage.setItem('clipboardItems', JSON.stringify(this.items));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  private loadFromLocalStorage(): ClipboardItem[] {
    try {
      const stored = localStorage.getItem('clipboardItems');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return [];
    }
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
  }

  private renderItem(item: ClipboardItem): string {
    const preview = item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text;
    const timeAgo = this.formatTimeAgo(item.timestamp);
    
    return `
      <div class="clipboard-item" data-id="${item.id}">
        <div class="item-content">
          <div class="item-text" title="${this.escapeHtml(item.text)}">${this.escapeHtml(preview)}</div>
          <div class="item-meta">${timeAgo}</div>
        </div>
        <div class="item-actions">
          <button class="copy-btn btn btn-small btn-primary" data-id="${item.id}" title="Copy to clipboard">Copy</button>
          <button class="delete-btn btn btn-small btn-danger" data-id="${item.id}" title="Delete item">×</button>
        </div>
      </div>
    `;
  }

  private formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

  private highlightExistingItem(itemId: string) {
    // Find the item element and add highlight
    const itemElement = document.querySelector(`[data-id="${itemId}"]`);
    if (itemElement) {
      itemElement.classList.add('highlight-existing');
      
      // Remove highlight after animation completes
      setTimeout(() => {
        itemElement.classList.remove('highlight-existing');
      }, 2000);
    }
  }

  private showMessage(message: string, type: 'success' | 'warning' | 'error') {
    // Remove any existing message
    const existingMessage = document.querySelector('.toast-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    // Create toast message
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.textContent = message;

    // Add to container (find the currently visible container)
    const container = document.querySelector('.overlay-container:not([style*="display: none"])');
    if (container) {
      container.appendChild(toast);

      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (toast.parentNode) {
          toast.classList.add('fade-out');
          setTimeout(() => {
            toast.remove();
          }, 300);
        }
      }, 3000);
    }
  }

  private navigateToSettings() {
    const mainApp = document.getElementById('main-app');
    const settingsPage = document.getElementById('settings-page');
    
    if (mainApp && settingsPage) {
      mainApp.style.display = 'none';
      settingsPage.style.display = 'flex';
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
    
    const preferences = {
      clipboardTab: clipboardEnabled,
      grammarTab: grammarEnabled
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
      const preferences = stored ? JSON.parse(stored) : { clipboardTab: true, grammarTab: true };
      
      // Update toggle states
      const clipboardToggle = document.getElementById('clipboard-tab-toggle') as HTMLInputElement;
      const grammarToggle = document.getElementById('grammar-tab-toggle') as HTMLInputElement;
      
      if (clipboardToggle) {
        clipboardToggle.checked = preferences.clipboardTab;
        this.toggleTabVisibility('clipboard', preferences.clipboardTab);
      }
      
      if (grammarToggle) {
        grammarToggle.checked = preferences.grammarTab;
        this.toggleTabVisibility('grammar', preferences.grammarTab);
      }
      
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
    
    if (!clipboardToggle || !grammarToggle) return false;
    
    // Count how many tabs would remain enabled after disabling this one
    const remainingTabs = [];
    if (tabName !== 'clipboard' && clipboardToggle.checked) remainingTabs.push('clipboard');
    if (tabName !== 'grammar' && grammarToggle.checked) remainingTabs.push('grammar');
    
    // Allow disabling only if at least one tab would remain
    return remainingTabs.length > 0;
  }
}

// Tab Management Class
class TabManager {
  private activeTab: string = 'clipboard';
  
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

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize tab manager
  new TabManager();
  
  // Initialize grammar checker
  new GrammarChecker();
  
  // Wait for electronAPI to be available for clipboard functionality
  if (window.electronAPI) {
    new ClipboardManager();
  } else {
    // Retry after a short delay
    setTimeout(() => {
      if (window.electronAPI) {
        new ClipboardManager();
      }
    }, 100);
  }
});
