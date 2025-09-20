/**
 * Common utility functions shared across the application
 */

export class Utils {
  /**
   * Format a timestamp into a human-readable "time ago" string
   */
  static formatTimeAgo(timestamp: number): string {
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

  /**
   * Escape HTML characters in text for safe display
   */
  static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show a toast message to the user
   */
  static showMessage(message: string, type: 'success' | 'warning' | 'error') {
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

  /**
   * Highlight an existing item with animation
   */
  static highlightExistingItem(itemId: string) {
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

  /**
   * Generic reorder function for arrays
   */
  static reorderArray<T>(items: T[], fromIndex: number, toIndex: number): T[] {
    if (fromIndex === toIndex) return items;
    
    // Create a new array with the item moved
    const newItems = [...items];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);
    
    return newItems;
  }

  /**
   * Generic localStorage save function
   */
  static saveToLocalStorage<T>(key: string, items: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch (error) {
      console.error(`Failed to save ${key} to localStorage:`, error);
    }
  }

  /**
   * Generic localStorage load function
   */
  static loadFromLocalStorage<T>(key: string): T[] {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error(`Failed to load ${key} from localStorage:`, error);
      return [];
    }
  }
}
