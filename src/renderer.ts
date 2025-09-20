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
    // Clear all button
    document.getElementById('clear-all')?.addEventListener('click', async () => {
      if (confirm('Clear all saved clipboard items?')) {
        this.items = await window.electronAPI.clipboard.clearAll();
        this.saveToLocalStorage();
        this.renderItems();
      }
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

    // Add drag and drop event listeners
    this.setupDragAndDrop();
  }

  private renderItem(item: ClipboardItem): string {
    const preview = item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text;
    const timeAgo = this.formatTimeAgo(item.timestamp);
    
    return `
      <div class="clipboard-item" data-id="${item.id}" draggable="true">
        <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
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

  private setupDragAndDrop() {
    let draggedElement: HTMLElement | null = null;
    let draggedIndex: number = -1;

    this.itemsContainer.querySelectorAll('.clipboard-item').forEach((item, index) => {
      const element = item as HTMLElement;
      
      element.addEventListener('dragstart', (e) => {
        draggedElement = element;
        draggedIndex = index;
        element.classList.add('dragging');
        
        // Set drag effect
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/html', element.outerHTML);
        }
      });

      element.addEventListener('dragend', () => {
        element.classList.remove('dragging');
        draggedElement = null;
        draggedIndex = -1;
        
        // Remove all drop indicators
        this.itemsContainer.querySelectorAll('.clipboard-item').forEach(item => {
          item.classList.remove('drag-over-top', 'drag-over-bottom');
        });
      });

      element.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedElement && draggedElement !== element) {
          const rect = element.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          
          // Remove previous indicators
          element.classList.remove('drag-over-top', 'drag-over-bottom');
          
          // Add appropriate indicator
          if (e.clientY < midY) {
            element.classList.add('drag-over-top');
          } else {
            element.classList.add('drag-over-bottom');
          }
        }
      });

      element.addEventListener('dragleave', (e) => {
        // Only remove indicators if we're actually leaving the element
        const rect = element.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || 
            e.clientY < rect.top || e.clientY > rect.bottom) {
          element.classList.remove('drag-over-top', 'drag-over-bottom');
        }
      });

      element.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedElement && draggedElement !== element && draggedIndex !== -1) {
          const rect = element.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const dropIndex = index;
          let newIndex = dropIndex;
          
          // Determine if we're dropping above or below
          if (e.clientY < midY) {
            newIndex = dropIndex;
          } else {
            newIndex = dropIndex + 1;
          }
          
          // Adjust for the dragged item's current position
          if (draggedIndex < newIndex) {
            newIndex--;
          }
          
          // Reorder the items array
          this.reorderItems(draggedIndex, newIndex);
        }
        
        // Clean up
        element.classList.remove('drag-over-top', 'drag-over-bottom');
      });
    });
  }

  private reorderItems(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    
    // Create a new array with the item moved
    const newItems = [...this.items];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);
    
    // Update the items array
    this.items = newItems;
    
    // Save to localStorage and re-render
    this.saveToLocalStorage();
    this.renderItems();
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

    // Add to container
    const container = document.querySelector('.overlay-container');
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
}

// Initialize the clipboard manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait for electronAPI to be available
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
