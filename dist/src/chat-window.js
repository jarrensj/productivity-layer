/**
 * Chat Window - Renderer Process
 * Handles AI chat functionality in a dedicated window
 */
class ChatWindow {
    messages = [];
    messagesContainer;
    chatInput;
    sendButton;
    typingIndicator;
    constructor() {
        this.messagesContainer = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-button');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.init();
    }
    init() {
        this.setupEventListeners();
        this.loadChatHistory();
        this.setupInitialMessageListener();
        this.focusInput();
    }
    setupEventListeners() {
        // Send button click
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });
        // Enter key to send (Shift+Enter for new line)
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        // Auto-resize textarea
        this.chatInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });
        // Window controls
        document.getElementById('close-btn')?.addEventListener('click', async () => {
            await window.electronAPI.window.close();
        });
    }
    autoResizeTextarea() {
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 100) + 'px';
    }
    focusInput() {
        this.chatInput.focus();
    }
    setupInitialMessageListener() {
        // Listen for initial message from main process
        window.electronAPI.chat.onInitialMessage((message) => {
            this.chatInput.value = message;
            this.autoResizeTextarea();
            // Automatically send the initial message
            setTimeout(() => {
                this.sendMessage();
            }, 100);
        });
    }
    async sendMessage() {
        const messageText = this.chatInput.value.trim();
        if (!messageText)
            return;
        // Clear input immediately
        this.chatInput.value = '';
        this.autoResizeTextarea();
        // Add user message
        const userMessage = {
            id: this.generateId(),
            role: 'user',
            content: messageText,
            timestamp: Date.now()
        };
        this.messages.push(userMessage);
        this.renderMessages();
        this.saveChatHistory();
        // Show typing indicator
        this.showTypingIndicator();
        this.sendButton.disabled = true;
        try {
            // Send to OpenAI API
            const response = await window.electronAPI.chat.sendMessage(messageText, this.messages);
            if (response.success && response.result) {
                // Add assistant message
                const assistantMessage = {
                    id: this.generateId(),
                    role: 'assistant',
                    content: response.result,
                    timestamp: Date.now()
                };
                this.messages.push(assistantMessage);
                this.renderMessages();
                this.saveChatHistory();
            }
            else {
                this.showError(response.error || 'Failed to get response from AI');
            }
        }
        catch (error) {
            console.error('Chat error:', error);
            this.showError('Failed to send message. Please try again.');
        }
        finally {
            this.hideTypingIndicator();
            this.sendButton.disabled = false;
            this.focusInput();
        }
    }
    showTypingIndicator() {
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }
    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none';
    }
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        this.messagesContainer.appendChild(errorDiv);
        this.scrollToBottom();
        // Remove error message after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
    renderMessages() {
        if (this.messages.length === 0) {
            this.messagesContainer.innerHTML = `
        <div class="no-messages">
          Start a conversation with the AI assistant! Ask questions, get help with tasks, or just chat.
        </div>
      `;
            return;
        }
        this.messagesContainer.innerHTML = this.messages
            .map(message => this.renderMessage(message))
            .join('');
        this.scrollToBottom();
    }
    renderMessage(message) {
        const timeAgo = this.formatTimeAgo(message.timestamp);
        const content = this.escapeHtml(message.content).replace(/\n/g, '<br>');
        return `
      <div class="message ${message.role}">
        <div class="message-time">${timeAgo}</div>
        <div class="message-content">${content}</div>
      </div>
    `;
    }
    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 50);
    }
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        if (diff < 60000)
            return 'Just now';
        if (diff < 3600000)
            return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000)
            return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    }
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    saveChatHistory() {
        try {
            localStorage.setItem('chatMessages', JSON.stringify(this.messages));
        }
        catch (error) {
            console.error('Failed to save chat history:', error);
        }
    }
    loadChatHistory() {
        try {
            const stored = localStorage.getItem('chatMessages');
            if (stored) {
                this.messages = JSON.parse(stored);
                this.renderMessages();
            }
        }
        catch (error) {
            console.error('Failed to load chat history:', error);
            this.messages = [];
        }
    }
}
// Initialize the chat window when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.electronAPI) {
        new ChatWindow();
    }
    else {
        // Retry after a short delay
        setTimeout(() => {
            if (window.electronAPI) {
                new ChatWindow();
            }
            else {
                console.error('Electron API not available');
            }
        }, 100);
    }
});
//# sourceMappingURL=chat-window.js.map