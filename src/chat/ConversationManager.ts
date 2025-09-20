export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface Conversation {
  id: string;
  history: ConversationMessage[];
  window?: Electron.BrowserWindow;
}

export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();

  createConversation(message: string, response: string): Conversation {
    const id = Date.now().toString();
    const conversation: Conversation = {
      id,
      history: [
        { role: 'user', content: message, timestamp: Date.now() },
        { role: 'assistant', content: response, timestamp: Date.now() }
      ]
    };
    
    this.conversations.set(id, conversation);
    return conversation;
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  addMessage(conversationId: string, role: 'user' | 'assistant', content: string): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return false;

    conversation.history.push({
      role,
      content,
      timestamp: Date.now()
    });
    
    return true;
  }

  setWindow(conversationId: string, window: Electron.BrowserWindow): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return false;
    
    conversation.window = window;
    return true;
  }

  deleteConversation(id: string): boolean {
    return this.conversations.delete(id);
  }

  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values());
  }
}

// Singleton instance
export const conversationManager = new ConversationManager();
