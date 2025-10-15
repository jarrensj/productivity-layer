export interface ClipboardItem {
  id: string;
  text: string;
  timestamp: number;
}

export interface LinkItem {
  id: string;
  name: string;
  url: string;
  timestamp: number;
}

export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  timestamp: number;
}

export interface ImageItem {
  id: string;
  originalImage?: string; // base64 data URL
  generatedImage?: string; // base64 data URL
  prompt: string;
  timestamp: number;
}

export interface ElectronAPI {
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
  links: {
    saveLink: (name: string, url: string, items: LinkItem[]) => Promise<{items: LinkItem[], savedItem: LinkItem} | {success: false, error: string}>;
    getSavedLinks: () => Promise<LinkItem[]>;
    deleteLink: (id: string, items: LinkItem[]) => Promise<LinkItem[]>;
    clearAllLinks: () => Promise<LinkItem[]>;
    openLink: (url: string) => Promise<{success: boolean; error?: string}>;
  };
  tasks: {
    saveTask: (text: string, items: TaskItem[]) => Promise<{items: TaskItem[], savedItem: TaskItem}>;
    getSavedTasks: () => Promise<TaskItem[]>;
    updateTask: (id: string, updates: Partial<TaskItem>, items: TaskItem[]) => Promise<TaskItem[]>;
    deleteTask: (id: string, items: TaskItem[]) => Promise<TaskItem[]>;
    clearAllTasks: () => Promise<TaskItem[]>;
  };
  window: {
    setOpacity: (opacity: number) => Promise<{success: boolean; error?: string}>;
  };
  chat: {
    openWindow: (initialMessage?: string) => Promise<{success: boolean; error?: string}>;
  };
  images: {
    generateImage: (prompt: string, imageData: string) => Promise<{success: boolean; type?: string; result?: string; error?: string}>;
  };
  app: {
    clearResetApp: () => Promise<{success: boolean; error?: string}>;
  };
}
