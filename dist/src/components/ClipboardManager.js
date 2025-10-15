"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClipboardManager = void 0;
const utils_1 = require("../utils");
const DragToReorderUtil_1 = require("./DragToReorderUtil");
class ClipboardManager {
    items = [];
    itemsContainer;
    itemsCount;
    clipboardInput;
    dragUtil;
    constructor() {
        this.itemsContainer = document.getElementById('clipboard-items');
        this.itemsCount = document.getElementById('items-count');
        this.clipboardInput = document.getElementById('clipboard-input');
        this.dragUtil = new DragToReorderUtil_1.DragToReorderUtil();
        this.init();
    }
    async init() {
        this.setupEventListeners();
        await this.loadSavedItems();
        this.setupKeyboardShortcuts();
        this.loadTabPreferences();
        this.loadOpacityPreference();
    }
    saveToLocalStorage() {
        utils_1.Utils.saveToLocalStorage('clipboardItems', this.items);
    }
    loadFromLocalStorage() {
        return utils_1.Utils.loadFromLocalStorage('clipboardItems');
    }
    setupEventListeners() {
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.navigateToSettings();
        });
        document.getElementById('back-to-app')?.addEventListener('click', () => {
            this.navigateToMainApp();
        });
        document.getElementById('clear-all')?.addEventListener('click', async () => {
            if (confirm('Clear all saved clipboard items?')) {
                this.items = await window.electronAPI.clipboard.clearAll();
                this.saveToLocalStorage();
                this.renderItems();
            }
        });
        document.getElementById('clear-all-links')?.addEventListener('click', async () => {
            if (confirm('Clear all saved links?')) {
                try {
                    await window.electronAPI.links.clearAllLinks();
                    const linksEvent = new CustomEvent('clearAllLinks');
                    document.dispatchEvent(linksEvent);
                    this.showMessage('All links cleared successfully', 'success');
                }
                catch (error) {
                    console.error('Failed to clear links:', error);
                    this.showMessage('Failed to clear links', 'error');
                }
            }
        });
        document.getElementById('clear-all-tasks')?.addEventListener('click', async () => {
            if (confirm('Clear all tasks?')) {
                try {
                    await window.electronAPI.tasks.clearAllTasks();
                    const tasksEvent = new CustomEvent('clearAllTasks');
                    document.dispatchEvent(tasksEvent);
                    this.showMessage('All tasks cleared successfully', 'success');
                }
                catch (error) {
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
                    await window.electronAPI.app.clearResetApp();
                    localStorage.clear();
                    document.dispatchEvent(new CustomEvent('clearAllClipboard'));
                    document.dispatchEvent(new CustomEvent('clearAllLinks'));
                    document.dispatchEvent(new CustomEvent('clearAllTasks'));
                    document.dispatchEvent(new CustomEvent('clearAllImages'));
                    document.dispatchEvent(new CustomEvent('resetAllSettings'));
                    this.resetToDefaults();
                    this.showMessage('App has been reset successfully', 'success');
                }
                catch (error) {
                    console.error('Failed to reset app:', error);
                    this.showMessage('Failed to reset app', 'error');
                }
            }
        });
        document.getElementById('clipboard-tab-toggle')?.addEventListener('change', (e) => {
            const toggle = e.target;
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
            const toggle = e.target;
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
            const toggle = e.target;
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
            const toggle = e.target;
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
            const toggle = e.target;
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
            const toggle = e.target;
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
            const toggle = e.target;
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
            const slider = e.target;
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
        const chatInput = document.getElementById('chat-input');
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
            }
            catch (error) {
                console.error('Failed to open chat window:', error);
                this.showMessage('Failed to open chat window', 'error');
            }
        };
        const openChatHistory = async () => {
            try {
                await window.electronAPI.chat.openWindow();
                this.showMessage('Chat window opened', 'success');
            }
            catch (error) {
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
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', async (e) => {
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
    async saveItem(text) {
        try {
            const result = await window.electronAPI.clipboard.saveClipboardItem(text, this.items);
            this.items = result.items;
            this.saveToLocalStorage();
            this.renderItems();
            if (result.savedItem && result.savedItem.isDuplicate) {
                this.showMessage('Item already exists in clipboard history', 'warning');
                this.highlightExistingItem(result.savedItem.id);
            }
            else {
                this.showMessage('Item saved to clipboard history', 'success');
            }
        }
        catch (error) {
            console.error('Failed to save clipboard item:', error);
            this.showMessage('Failed to save clipboard item', 'error');
        }
    }
    async loadSavedItems() {
        try {
            const localItems = this.loadFromLocalStorage();
            if (localItems.length > 0) {
                this.items = localItems;
            }
            else {
                this.items = await window.electronAPI.clipboard.getSavedItems();
            }
            this.renderItems();
        }
        catch (error) {
            console.error('Failed to load clipboard items:', error);
        }
    }
    renderItems() {
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
                const id = e.target.dataset.id;
                const item = this.items.find(i => i.id === id);
                if (item) {
                    await window.electronAPI.clipboard.writeText(item.text);
                    this.showFeedback(e.target, 'Copied!');
                }
            });
        });
        this.itemsContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                this.items = await window.electronAPI.clipboard.deleteItem(id, this.items);
                this.saveToLocalStorage();
                this.renderItems();
            });
        });
        this.dragUtil.setupDragAndDrop(this.itemsContainer, '.clipboard-item', this.items, (fromIndex, toIndex) => this.reorderItems(fromIndex, toIndex));
    }
    renderItem(item) {
        const preview = item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text;
        const timeAgo = utils_1.Utils.formatTimeAgo(item.timestamp);
        return `
      <div class="clipboard-item" data-id="${item.id}" draggable="true">
        <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
        <div class="item-content">
          <div class="item-text" title="${utils_1.Utils.escapeHtml(item.text)}">${utils_1.Utils.escapeHtml(preview)}</div>
          <div class="item-meta">${timeAgo}</div>
        </div>
        <div class="item-actions">
          <button class="copy-btn btn btn-small btn-primary" data-id="${item.id}" title="Copy to clipboard">Copy</button>
          <button class="delete-btn btn btn-small btn-danger" data-id="${item.id}" title="Delete item">×</button>
        </div>
      </div>
    `;
    }
    showFeedback(element, message) {
        const originalText = element.textContent;
        element.textContent = message;
        element.classList.add('feedback');
        setTimeout(() => {
            element.textContent = originalText;
            element.classList.remove('feedback');
        }, 1000);
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
    navigateToSettings() {
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
    navigateToMainApp() {
        const mainApp = document.getElementById('main-app');
        const settingsPage = document.getElementById('settings-page');
        if (mainApp && settingsPage) {
            settingsPage.style.display = 'none';
            mainApp.style.display = 'flex';
        }
    }
    toggleTabVisibility(tabName, isVisible) {
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabButton && tabContent) {
            if (isVisible) {
                tabButton.style.display = 'block';
            }
            else {
                tabButton.style.display = 'none';
                tabContent.classList.remove('active');
                if (tabButton.classList.contains('active')) {
                    tabButton.classList.remove('active');
                    const firstVisibleTab = document.querySelector('.tab-btn:not([style*="display: none"])');
                    if (firstVisibleTab) {
                        firstVisibleTab.click();
                    }
                }
            }
        }
    }
    saveTabPreferences() {
        const clipboardEnabled = document.getElementById('clipboard-tab-toggle')?.checked ?? true;
        const grammarEnabled = document.getElementById('grammar-tab-toggle')?.checked ?? true;
        const linksEnabled = document.getElementById('links-tab-toggle')?.checked ?? true;
        const tasksEnabled = document.getElementById('tasks-tab-toggle')?.checked ?? true;
        const chatEnabled = document.getElementById('chat-tab-toggle')?.checked ?? true;
        const imagesEnabled = document.getElementById('images-tab-toggle')?.checked ?? true;
        const timerEnabled = document.getElementById('timer-tab-toggle')?.checked ?? true;
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
        }
        catch (error) {
            console.error('Failed to save tab preferences:', error);
        }
    }
    loadTabPreferences() {
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
            const clipboardToggle = document.getElementById('clipboard-tab-toggle');
            const grammarToggle = document.getElementById('grammar-tab-toggle');
            const linksToggle = document.getElementById('links-tab-toggle');
            const tasksToggle = document.getElementById('tasks-tab-toggle');
            const chatToggle = document.getElementById('chat-tab-toggle');
            const imagesToggle = document.getElementById('images-tab-toggle');
            const timerToggle = document.getElementById('timer-tab-toggle');
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
        }
        catch (error) {
            console.error('Failed to load tab preferences:', error);
        }
    }
    ensureActiveTab() {
        const activeTab = document.querySelector('.tab-btn.active:not([style*="display: none"])');
        if (!activeTab) {
            const firstVisibleTab = document.querySelector('.tab-btn:not([style*="display: none"])');
            if (firstVisibleTab) {
                firstVisibleTab.click();
            }
        }
        else {
            const tabName = activeTab.getAttribute('data-tab');
            if (tabName) {
                const tabContent = document.getElementById(`${tabName}-tab`);
                if (tabContent && !tabContent.classList.contains('active')) {
                    activeTab.click();
                }
            }
        }
    }
    canDisableTab(tabName) {
        const clipboardToggle = document.getElementById('clipboard-tab-toggle');
        const grammarToggle = document.getElementById('grammar-tab-toggle');
        const linksToggle = document.getElementById('links-tab-toggle');
        const tasksToggle = document.getElementById('tasks-tab-toggle');
        const chatToggle = document.getElementById('chat-tab-toggle');
        const imagesToggle = document.getElementById('images-tab-toggle');
        if (!clipboardToggle || !grammarToggle || !linksToggle || !tasksToggle || !chatToggle || !imagesToggle)
            return false;
        const remainingTabs = [];
        if (tabName !== 'clipboard' && clipboardToggle.checked)
            remainingTabs.push('clipboard');
        if (tabName !== 'grammar' && grammarToggle.checked)
            remainingTabs.push('grammar');
        if (tabName !== 'links' && linksToggle.checked)
            remainingTabs.push('links');
        if (tabName !== 'tasks' && tasksToggle.checked)
            remainingTabs.push('tasks');
        if (tabName !== 'chat' && chatToggle.checked)
            remainingTabs.push('chat');
        if (tabName !== 'images' && imagesToggle.checked)
            remainingTabs.push('images');
        return remainingTabs.length > 0;
    }
    updateOpacityValue(opacity) {
        const opacityValue = document.getElementById('opacity-value');
        if (opacityValue) {
            opacityValue.textContent = `${opacity}%`;
        }
    }
    async setWindowOpacity(opacity) {
        try {
            const result = await window.electronAPI.window.setOpacity(opacity);
            if (!result.success) {
                console.error('Failed to set opacity:', result.error);
                this.showMessage('Failed to update window opacity', 'error');
            }
            else {
                this.saveOpacityPreference(opacity);
            }
        }
        catch (error) {
            console.error('Error setting opacity:', error);
            this.showMessage('Failed to update window opacity', 'error');
        }
    }
    saveOpacityPreference(opacity) {
        try {
            localStorage.setItem('windowOpacity', opacity.toString());
        }
        catch (error) {
            console.error('Failed to save opacity preference:', error);
        }
    }
    applyTabOrder(tabOrder) {
        const tabNavigation = document.querySelector('.tab-navigation');
        if (!tabNavigation)
            return;
        const tabButtons = Array.from(tabNavigation.querySelectorAll('.tab-btn'));
        const buttonMap = new Map();
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
    initializeTabOrderUI(tabOrder) {
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
                }
                else {
                    interfaceSection.insertAdjacentHTML('beforeend', tabOrderHTML);
                    tabOrderContainer = document.getElementById('tab-order-container');
                }
            }
            if (tabOrderContainer) {
                this.renderTabOrderList(tabOrder);
                this.setupTabOrderDragAndDrop();
            }
            else {
                console.error('Failed to create tab order container');
            }
        }, 200);
    }
    renderTabOrderList(tabOrder) {
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
    setupTabOrderDragAndDrop() {
        const tabOrderList = document.getElementById('tab-order-list');
        if (!tabOrderList)
            return;
        const dragUtil = new DragToReorderUtil_1.DragToReorderUtil();
        const getCurrentTabOrder = () => {
            return Array.from(tabOrderList.querySelectorAll('.tab-order-item')).map(item => item.getAttribute('data-tab')).filter(tab => tab);
        };
        dragUtil.setupDragAndDrop(tabOrderList, '.tab-order-item', getCurrentTabOrder(), (fromIndex, toIndex) => {
            const currentOrder = getCurrentTabOrder();
            const newOrder = utils_1.Utils.reorderArray(currentOrder, fromIndex, toIndex);
            this.renderTabOrderList(newOrder);
            this.applyTabOrder(newOrder);
            this.saveTabOrder(newOrder);
            setTimeout(() => this.setupTabOrderDragAndDrop(), 100);
        });
    }
    saveTabOrder(tabOrder) {
        try {
            const stored = localStorage.getItem('tabPreferences');
            const preferences = stored ? JSON.parse(stored) : {};
            preferences.tabOrder = tabOrder;
            localStorage.setItem('tabPreferences', JSON.stringify(preferences));
        }
        catch (error) {
            console.error('Failed to save tab order:', error);
        }
    }
    loadOpacityPreference() {
        try {
            const stored = localStorage.getItem('windowOpacity');
            const opacity = stored ? parseInt(stored) : 80;
            const opacitySlider = document.getElementById('opacity-slider');
            if (opacitySlider) {
                opacitySlider.value = opacity.toString();
                this.updateOpacityValue(opacity);
                window.electronAPI.window.setOpacity(opacity).catch(console.error);
            }
        }
        catch (error) {
            console.error('Failed to load opacity preference:', error);
        }
    }
    resetToDefaults() {
        this.items = [];
        this.renderItems();
        const defaultOpacity = 80;
        const opacitySlider = document.getElementById('opacity-slider');
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
            const toggle = document.getElementById(toggleId);
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
            const clipboardTab = document.querySelector('[data-tab="clipboard"]');
            if (clipboardTab) {
                clipboardTab.click();
            }
        }, 100);
    }
}
exports.ClipboardManager = ClipboardManager;
//# sourceMappingURL=ClipboardManager.js.map