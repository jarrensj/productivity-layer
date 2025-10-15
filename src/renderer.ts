/**
 * Extended Clipboard Manager - Renderer Process
 * Manages clipboard items with save, copy, and delete functionality
 */

import './index.css';
import { TabManager } from './components/TabManager';
import { GrammarChecker } from './components/GrammarChecker';
import { ImagesManager } from './components/ImagesManager';
import { TimerManager } from './components/TimerManager';
import { ClipboardManager } from './components/ClipboardManager';
import { LinksManager } from './components/LinksManager';
import { TasksManager } from './components/TasksManager';

document.addEventListener('DOMContentLoaded', () => {
  new TabManager();
  new GrammarChecker();
  new ImagesManager();
  new TimerManager();

  if ((window as any).electronAPI) {
    new ClipboardManager();
    new LinksManager();
    new TasksManager();
  } else {
    setTimeout(() => {
      if ((window as any).electronAPI) {
        new ClipboardManager();
        new LinksManager();
        new TasksManager();
      }
    }, 100);
  }
});
