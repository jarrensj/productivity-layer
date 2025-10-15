import { Utils } from '../utils';
import { DragToReorderUtil } from './DragToReorderUtil';
import type { ClipboardItem } from '../types';

export class ClipboardManager {
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
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      this.navigateToSettings();
    });

    document.getElementById('back-to-app')?.addEventListener('click', () => {
      this.navigateToMainApp();
    });

    document.getElementById('clear-all')?.addEventListener('click', async () => {
      if (confirm('Clear all saved clipboard items?')) {
        this.items = await (window as any).electronAPI.clipboard.clearAll();
        this.saveToLocalStorage();
        this.renderItems();
      }
    });

    document.getElementById('clear-all-links')?.addEventListener('click', async () => {
      if (confirm('Clear all saved links?')) {
        try {
          await (window as any).electronAPI.links.clearAllLinks();
          const linksEvent = new CustomEvent('clearAllLinks');
          document.dispatchEvent(linksEvent);
          this.showMessage('All links cleared successfully', 'success');
        } catch (error) {
          console.error('Failed to clear links:', error);
          this.showMessage('Failed to clear links', 'error');
        }
      }
    });

    document.getElementById('clear-all-tasks')?.addEventListener('click', async () => {
      if (confirm('Clear all tasks?')) {
        try {
          await (window as any).electronAPI.tasks.clearAllTasks();
          const tasksEvent = new CustomEvent('clearAllTasks');
          document.dispatchEvent(tasksEvent);
          this.showMessage('All tasks cleared successfully', 'success');
        } catch (error) {
          console.error('Failed to clear tasks:', error);
          this.showMessage('Failed to clear tasks', 'error');
        }
      }
    });

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
          await (window as any).electronAPI.app.clearResetApp();
          localStorage.clear();
          document.dispatchEvent(new CustomEvent('clearAllClipboard'));
          document.dispatchEvent(new CustomEvent('clearAllLinks'));
          document.dispatchEvent(new CustomEvent('clearAllTasks'));
          document.dispatchEvent(new CustomEvent('clearAllImages'));
          document.dispatchEvent(new CustomEvent('resetAllSettings'));
          this.resetToDefaults();
          this.showMessage('App has been reset successfully', 'success');
        } catch (error) {
          console.error('Failed to reset app:', error);
          this.showMessage('Failed to reset app', 'error');
        }
      }
    });

    document.getElementById('clipboard-tab-toggle')?.addEventListener('change', (e) => {
      const toggle = e.target as HTMLInputElement;
      const isEnabled = toggle.checked;

      if (!isEnabled && !this.canDisableTab('clipboard')) {
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
        toggle.checked = true;
        this.showMessage('At least one tab must remain enabled', 'warning');
        return;
      }

      this.toggleTabVisibility('images', isEnabled);
      this.saveTabPreferences();
      setTimeout(() => this.ensureActiveTab(), 50);
    });

    document.getElementById('timer-tab-toggle')?.addEventListener('change', (e) => {
      const toggle = e.target as HTMLInputElement;
      const isEnabled = toggle.checked;

      if (!isEnabled && !this.canDisableTab('timer')) {
        toggle.checked = true;
        this.showMessage('At least one tab must remain enabled', 'warning');
        return;
      }

      this.toggleTabVisibility('timer', isEnabled);
      this.saveTabPreferences();
      setTimeout(() => this.ensureActiveTab(), 50);
    });

    document.getElementById('opacity-slider')?.addEventListener('input', (e) => {
      const slider = e.target as HTMLInputElement;
      const opacity = parseInt(slider.value);
      this.updateOpacityValue(opacity);
      this.setWindowOpacity(opacity);
    });

    document.getElementById('save-input')?.addEventListener('click', async () => {
      const text = this.clipboardInput.value.trim();
      if (text) {
        await this.saveItem(text);
        this.clipboardInput.value = '';
      }
    });

    this.clipboardInput.addEventListener('paste', async () => {
      setTimeout(async () => {
        const text = this.clipboardInput.value.trim();
        if (text) {
          await this.saveItem(text);
        }
      }, 100);
    });

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
        await (window as any).electronAPI.chat.openWindow(message);
        chatInput.value = '';
        this.showMessage('Chat window opened with your message', 'success');
      } catch (error) {
        console.error('Failed to open chat window:', error);
        this.showMessage('Failed to open chat window', 'error');
      }
    };

    const openChatHistory = async () => {
      try {
        await (window as any).electronAPI.chat.openWindow();
        this.showMessage('Chat window opened', 'success');
      } catch (error) {
        console.error('Failed to open chat window:', error);
        this.showMessage('Failed to open chat window', 'error');
      }
    };

    sendChatButton?.addEventListener('click', sendChatMessage);
    openHistoryButton?.addEventListener('click', openChatHistory);

    chatInput?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        await sendChatMessage();
      }
    });
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        if (confirm('Clear all saved clipboard items?')) {
          this.items = await (window as any).electronAPI.clipboard.clearAll();
          this.saveToLocalStorage();
          this.renderItems();
        }
      }
    });
  }

  private async saveItem(text: string) {
    try {
      const result = await (window as any).electronAPI.clipboard.saveClipboardItem(text, this.items);

      this.items = result.items;
      this.saveToLocalStorage();
      this.renderItems();

      if (result.savedItem && (result.savedItem as any).isDuplicate) {
        this.showMessage('Item already exists in clipboard history', 'warning');
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
      const localItems = this.loadFromLocalStorage();
      if (localItems.length > 0) {
        this.items = localItems;
      } else {
        this.items = await (window as any).electronAPI.clipboard.getSavedItems();
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

    this.itemsContainer.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        const item = this.items.find(i => i.id === id);
        if (item) {
          await (window as any).electronAPI.clipboard.writeText(item.text);
          this.showFeedback(e.target as HTMLElement, 'Copied!');
        }
      });
    });

    this.itemsContainer.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        this.items = await (window as any).electronAPI.clipboard.deleteItem(id, this.items);
        this.saveToLocalStorage();
        this.renderItems();
      });
    });

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
    const timerEnabled = (document.getElementById('timer-tab-toggle') as HTMLInputElement)?.checked ?? true;

    const stored = localStorage.getItem('tabPreferences');
    const currentPreferences = stored ? JSON.parse(stored) : {};
    const defaultOrder = ['clipboard', 'grammar', 'links', 'tasks', 'chat', 'images', 'timer'];

    const preferences = {
      clipboardTab: clipboardEnabled,
      grammarTab: grammarEnabled,
      linksTab: linksEnabled,
      tasksTab: tasksEnabled,
      chatTab: chatEnabled,
      imagesTab: imagesEnabled,
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
      let preferences = stored ? JSON.parse(stored) : {
        clipboardTab: true,
        grammarTab: true,
        linksTab: true,
        tasksTab: true,
        chatTab: true,
        imagesTab: true,
        timerTab: true,
        tabOrder: ['clipboard', 'grammar', 'links', 'tasks', 'chat', 'images', 'timer']
      };

      if (stored) {
        let needsUpdate = false;

        if (preferences.imagesTab === undefined) {
          preferences.imagesTab = true;
          needsUpdate = true;
        }

        if (preferences.timerTab === undefined) {
          preferences.timerTab = true;
          needsUpdate = true;
        }

        if (!preferences.tabOrder || !preferences.tabOrder.includes('images')) {
          preferences.tabOrder = preferences.tabOrder || ['clipboard', 'grammar', 'links', 'tasks', 'chat'];
          preferences.tabOrder.push('images');
          needsUpdate = true;
        }

        if (!preferences.tabOrder || !preferences.tabOrder.includes('timer')) {
          preferences.tabOrder = preferences.tabOrder || ['clipboard', 'grammar', 'links', 'tasks', 'chat', 'images', 'timer'];
          if (!preferences.tabOrder.includes('timer')) {
            preferences.tabOrder.push('timer');
          }
          needsUpdate = true;
        }

        if (needsUpdate) {
          localStorage.setItem('tabPreferences', JSON.stringify(preferences));
        }
      }

      if (preferences.tabOrder) {
        this.applyTabOrder(preferences.tabOrder);
      }

      const clipboardToggle = document.getElementById('clipboard-tab-toggle') as HTMLInputElement;
      const grammarToggle = document.getElementById('grammar-tab-toggle') as HTMLInputElement;
      const linksToggle = document.getElementById('links-tab-toggle') as HTMLInputElement;
      const tasksToggle = document.getElementById('tasks-tab-toggle') as HTMLInputElement;
      const chatToggle = document.getElementById('chat-tab-toggle') as HTMLInputElement;
      const imagesToggle = document.getElementById('images-tab-toggle') as HTMLInputElement;
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

      if (timerToggle) {
        timerToggle.checked = preferences.timerTab ?? true;
        this.toggleTabVisibility('timer', preferences.timerTab ?? true);
      }

      this.initializeTabOrderUI(preferences.tabOrder || ['clipboard', 'grammar', 'links', 'tasks', 'chat', 'images', 'timer']);

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
      const firstVisibleTab = document.querySelector('.tab-btn:not([style*="display: none"])') as HTMLElement;
      if (firstVisibleTab) {
        firstVisibleTab.click();
      }
    } else {
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

    if (!clipboardToggle || !grammarToggle || !linksToggle || !tasksToggle || !chatToggle || !imagesToggle) return false;

    const remainingTabs: string[] = [];
    if (tabName !== 'clipboard' && clipboardToggle.checked) remainingTabs.push('clipboard');
    if (tabName !== 'grammar' && grammarToggle.checked) remainingTabs.push('grammar');
    if (tabName !== 'links' && linksToggle.checked) remainingTabs.push('links');
    if (tabName !== 'tasks' && tasksToggle.checked) remainingTabs.push('tasks');
    if (tabName !== 'chat' && chatToggle.checked) remainingTabs.push('chat');
    if (tabName !== 'images' && imagesToggle.checked) remainingTabs.push('images');

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
      const result = await (window as any).electronAPI.window.setOpacity(opacity);
      if (!result.success) {
        console.error('Failed to set opacity:', result.error);
        this.showMessage('Failed to update window opacity', 'error');
      } else {
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

    const tabButtons = Array.from(tabNavigation.querySelectorAll('.tab-btn')) as HTMLElement[];

    const buttonMap = new Map<string, HTMLElement>();
    tabButtons.forEach(btn => {
      const tabName = btn.getAttribute('data-tab');
      if (tabName) {
        buttonMap.set(tabName, btn);
      }
    });

    tabNavigation.innerHTML = '';
    tabOrder.forEach(tabName => {
      const button = buttonMap.get(tabName);
      if (button) {
        tabNavigation.appendChild(button);
      }
    });
  }

  private initializeTabOrderUI(tabOrder: string[]) {
    setTimeout(() => {
      const settingsPage = document.getElementById('settings-page');
      if (!settingsPage) {
        console.warn('Settings page not found');
        return;
      }

      const interfaceSection = settingsPage.querySelector('.settings-section');
      if (!interfaceSection) {
        console.warn('Interface section not found');
        return;
      }

      let tabOrderContainer = document.getElementById('tab-order-container');
      if (!tabOrderContainer) {
        const tabOrderHTML = `
          <div class="setting-item" id="tab-order-container">
            <div class="setting-description">
              <strong>Tab Order</strong>
              <p>Drag and drop to reorder tabs in your preferred sequence.</p>
            </div>
            <div id="tab-order-list" class="tab-order-list"></div>
          </div>
        `;

        const settingItems = Array.from(interfaceSection.querySelectorAll('.setting-item'));
        const timerTabToggle = settingItems.find(item => {
          const strong = item.querySelector('strong');
          return strong && strong.textContent?.trim() === 'Timer Tab';
        });

        if (timerTabToggle) {
          timerTabToggle.insertAdjacentHTML('afterend', tabOrderHTML);
          tabOrderContainer = document.getElementById('tab-order-container');
        } else {
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

    const tabLabels: Record<string, string> = {
      clipboard: 'Clipboard',
      grammar: 'Grammar Checker',
      links: 'Favorite Links',
      tasks: 'Tasks',
      chat: 'Chat',
      images: 'Images',
      timer: 'Timer'
    };

    const tabOrderHTML = tabOrder.map(tabName => `
      <div class="tab-order-item" data-tab="${tabName}" draggable="true">
        <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
        <span class="tab-name">${tabLabels[tabName] || tabName}</span>
      </div>
    `).join('');

    tabOrderList.innerHTML = tabOrderHTML;
  }

  private setupTabOrderDragAndDrop() {
    const tabOrderList = document.getElementById('tab-order-list');
    if (!tabOrderList) return;

    const dragUtil = new DragToReorderUtil();

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

        this.renderTabOrderList(newOrder);
        this.applyTabOrder(newOrder);
        this.saveTabOrder(newOrder);

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
      const opacity = stored ? parseInt(stored) : 80;

      const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement;
      if (opacitySlider) {
        opacitySlider.value = opacity.toString();
        this.updateOpacityValue(opacity);
        (window as any).electronAPI.window.setOpacity(opacity).catch(console.error);
      }
    } catch (error) {
      console.error('Failed to load opacity preference:', error);
    }
  }

  private resetToDefaults() {
    this.items = [];
    this.renderItems();

    const defaultOpacity = 80;
    const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement;
    if (opacitySlider) {
      opacitySlider.value = defaultOpacity.toString();
      this.updateOpacityValue(defaultOpacity);
      this.setWindowOpacity(defaultOpacity);
    }

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

    const defaultTabOrder = ['clipboard', 'grammar', 'links', 'tasks', 'chat', 'images', 'timer'];
    this.applyTabOrder(defaultTabOrder);

    const settingsPage = document.getElementById('settings-page');
    if (settingsPage && settingsPage.style.display !== 'none') {
      this.initializeTabOrderUI(defaultTabOrder);
    }

    setTimeout(() => {
      const clipboardTab = document.querySelector('[data-tab="clipboard"]') as HTMLElement;
      if (clipboardTab) {
        clipboardTab.click();
      }
    }, 100);
  }
}
