"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinksManager = void 0;
const utils_1 = require("../utils");
const DragToReorderUtil_1 = require("./DragToReorderUtil");
class LinksManager {
    items = [];
    itemsContainer;
    itemsCount;
    linkNameInput;
    linkUrlInput;
    dragUtil;
    constructor() {
        this.itemsContainer = document.getElementById('links-items');
        this.itemsCount = document.getElementById('links-count');
        this.linkNameInput = document.getElementById('link-name-input');
        this.linkUrlInput = document.getElementById('link-url-input');
        this.dragUtil = new DragToReorderUtil_1.DragToReorderUtil();
        this.init();
    }
    async init() {
        this.setupEventListeners();
        await this.loadSavedItems();
        this.setupGlobalEventListeners();
    }
    setupGlobalEventListeners() {
        document.addEventListener('clearAllLinks', async () => {
            this.items = [];
            this.saveToLocalStorage();
            this.renderItems();
        });
    }
    saveToLocalStorage() {
        utils_1.Utils.saveToLocalStorage('linkItems', this.items);
    }
    loadFromLocalStorage() {
        return utils_1.Utils.loadFromLocalStorage('linkItems');
    }
    validateUrl(url) {
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
    setupEventListeners() {
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
    async saveItem(name, url) {
        try {
            const result = await window.electronAPI.links.saveLink(name, url, this.items);
            if ('success' in result && !result.success) {
                this.showMessage(result.error || 'Invalid URL format', 'error');
                return;
            }
            if ('items' in result && 'savedItem' in result) {
                this.items = result.items;
                this.saveToLocalStorage();
                this.renderItems();
                if (result.savedItem && result.savedItem.isDuplicate) {
                    this.showMessage('Link already exists', 'warning');
                    this.highlightExistingItem(result.savedItem.id);
                }
                else {
                    this.showMessage('Link saved successfully', 'success');
                }
            }
        }
        catch (error) {
            console.error('Failed to save link:', error);
            this.showMessage('Failed to save link', 'error');
        }
    }
    async loadSavedItems() {
        try {
            const localItems = this.loadFromLocalStorage();
            if (localItems.length > 0) {
                this.items = localItems;
            }
            else {
                this.items = await window.electronAPI.links.getSavedLinks();
            }
            this.renderItems();
        }
        catch (error) {
            console.error('Failed to load links:', error);
        }
    }
    renderItems() {
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
                if (e.target.classList.contains('delete-btn') ||
                    e.target.classList.contains('drag-handle')) {
                    return;
                }
                const id = item.dataset.id;
                const linkItem = this.items.find(i => i.id === id);
                if (linkItem) {
                    try {
                        await window.electronAPI.links.openLink(linkItem.url);
                    }
                    catch (error) {
                        console.error('Failed to open link:', error);
                        this.showMessage('Failed to open link', 'error');
                    }
                }
            });
        });
        this.itemsContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                this.items = await window.electronAPI.links.deleteLink(id, this.items);
                this.saveToLocalStorage();
                this.renderItems();
            });
        });
        this.dragUtil.setupDragAndDrop(this.itemsContainer, '.link-item', this.items, (fromIndex, toIndex) => this.reorderItems(fromIndex, toIndex));
    }
    renderItem(item) {
        const timeAgo = utils_1.Utils.formatTimeAgo(item.timestamp);
        return `
      <div class="link-item" data-id="${item.id}" title="Click to open ${utils_1.Utils.escapeHtml(item.url)}" draggable="true">
        <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
        <div class="item-content">
          <div class="item-text">${utils_1.Utils.escapeHtml(item.name)}</div>
          <div class="item-meta">${utils_1.Utils.escapeHtml(item.url)} • ${timeAgo}</div>
        </div>
        <div class="item-actions">
          <button class="delete-btn btn btn-small btn-danger" data-id="${item.id}" title="Delete link">×</button>
        </div>
      </div>
    `;
    }
    reorderItems(fromIndex, toIndex) {
        this.items = utils_1.Utils.reorderArray(this.items, fromIndex, toIndex);
        this.saveToLocalStorage();
        this.renderItems();
    }
    highlightExistingItem(itemId) {
        utils_1.Utils.highlightExistingItem(itemId);
    }
    showMessage(message, type) {
        utils_1.Utils.showMessage(message, type);
    }
}
exports.LinksManager = LinksManager;
//# sourceMappingURL=LinksManager.js.map