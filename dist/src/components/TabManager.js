"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TabManager = void 0;
class TabManager {
    activeTab = 'clipboard';
    constructor() {
        this.init();
    }
    init() {
        this.setupTabListeners();
    }
    setupTabListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target;
                const tabName = target.dataset.tab;
                if (tabName) {
                    this.switchTab(tabName);
                }
            });
        });
    }
    switchTab(tabName) {
        if (this.activeTab === tabName)
            return;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`)?.classList.add('active');
        this.activeTab = tabName;
    }
}
exports.TabManager = TabManager;
//# sourceMappingURL=TabManager.js.map