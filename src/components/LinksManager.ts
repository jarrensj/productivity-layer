import { Utils } from '../utils';
import { DragToReorderUtil } from './DragToReorderUtil';
import type { LinkItem } from '../types';

export class LinksManager {
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
      const result = await (window as any).electronAPI.links.saveLink(name, url, this.items);

      if ('success' in result && !result.success) {
        this.showMessage(result.error || 'Invalid URL format', 'error');
        return;
      }

      if ('items' in result && 'savedItem' in result) {
        this.items = result.items;
        this.saveToLocalStorage();
        this.renderItems();

        if (result.savedItem && (result.savedItem as any).isDuplicate) {
          this.showMessage('Link already exists', 'warning');
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
      const localItems = this.loadFromLocalStorage();
      if (localItems.length > 0) {
        this.items = localItems;
      } else {
        this.items = await (window as any).electronAPI.links.getSavedLinks();
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

    this.itemsContainer.querySelectorAll('.link-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if ((e.target as HTMLElement).classList.contains('delete-btn') ||
            (e.target as HTMLElement).classList.contains('drag-handle')) {
          return;
        }

        const id = (item as HTMLElement).dataset.id!;
        const linkItem = this.items.find(i => i.id === id);
        if (linkItem) {
          try {
            await (window as any).electronAPI.links.openLink(linkItem.url);
          } catch (error) {
            console.error('Failed to open link:', error);
            this.showMessage('Failed to open link', 'error');
          }
        }
      });
    });

    this.itemsContainer.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (e.target as HTMLElement).dataset.id!;
        this.items = await (window as any).electronAPI.links.deleteLink(id, this.items);
        this.saveToLocalStorage();
        this.renderItems();
      });
    });

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
