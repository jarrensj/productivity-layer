"use strict";
/**
 * Extended Clipboard Manager - Renderer Process
 * Manages clipboard items with save, copy, and delete functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("./index.css");
const TabManager_1 = require("./components/TabManager");
const GrammarChecker_1 = require("./components/GrammarChecker");
const ImagesManager_1 = require("./components/ImagesManager");
const TimerManager_1 = require("./components/TimerManager");
const ClipboardManager_1 = require("./components/ClipboardManager");
const LinksManager_1 = require("./components/LinksManager");
const TasksManager_1 = require("./components/TasksManager");
document.addEventListener('DOMContentLoaded', () => {
    new TabManager_1.TabManager();
    new GrammarChecker_1.GrammarChecker();
    new ImagesManager_1.ImagesManager();
    new TimerManager_1.TimerManager();
    if (window.electronAPI) {
        new ClipboardManager_1.ClipboardManager();
        new LinksManager_1.LinksManager();
        new TasksManager_1.TasksManager();
    }
    else {
        setTimeout(() => {
            if (window.electronAPI) {
                new ClipboardManager_1.ClipboardManager();
                new LinksManager_1.LinksManager();
                new TasksManager_1.TasksManager();
            }
        }, 100);
    }
});
//# sourceMappingURL=renderer.js.map