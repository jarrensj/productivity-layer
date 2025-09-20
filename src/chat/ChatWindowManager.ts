import { BrowserWindow } from 'electron';
import path from 'node:path';
import { conversationManager, Conversation } from './ConversationManager';

export class ChatWindowManager {
  private static instance: ChatWindowManager;
  
  static getInstance(): ChatWindowManager {
    if (!ChatWindowManager.instance) {
      ChatWindowManager.instance = new ChatWindowManager();
    }
    return ChatWindowManager.instance;
  }

  createChatWindow(message: string, response: string, parentWindow?: BrowserWindow): BrowserWindow {
    // Create conversation
    const conversation = conversationManager.createConversation(message, response);
    
    // Create the browser window
    const chatWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, '../preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      parent: parentWindow,
      modal: false,
      show: false,
    });

    // Associate window with conversation
    conversationManager.setWindow(conversation.id, chatWindow);

    // Load the chat window HTML
    this.loadChatWindow(chatWindow, conversation);

    return chatWindow;
  }

  private loadChatWindow(window: BrowserWindow, conversation: Conversation): void {
    // Set conversation ID for the renderer process
    const conversationId = conversation.id;
    
    // Load the HTML file
    const htmlPath = path.join(__dirname, 'chat-window.html');
    
    // For development, we'll use loadFile
    // For production, you might want to bundle this differently
    window.loadFile(htmlPath).then(() => {
      // Inject conversation ID and initial messages into the window
      window.webContents.executeJavaScript(`
        window.conversationId = '${conversationId}';
        window.initialMessages = ${JSON.stringify(conversation.history)};
      `);
      
      window.once('ready-to-show', () => {
        window.show();
      });
    }).catch((error) => {
      console.error('Failed to load chat window:', error);
      // Fallback: load with data URL (like the original implementation)
      this.loadChatWindowFallback(window, conversation);
    });
  }

  private loadChatWindowFallback(window: BrowserWindow, conversation: Conversation): void {
    const conversationId = conversation.id;
    const initialMessages = conversation.history;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>AI Chat - Continue Conversation</title>
        <style>
          ${this.getChatStyles()}
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🤖 AI Chat - Continue the Conversation</h1>
        </div>
        <div class="chat-container">
          <div class="messages" id="messages">
            ${this.renderMessages(initialMessages)}
          </div>
          <div class="input-area">
            <input 
              type="text" 
              id="chatInput" 
              placeholder="Continue the conversation..." 
              maxlength="500"
            />
            <button id="sendButton">Send</button>
          </div>
          <div style="text-align: center; margin-top: 10px; color: #666; font-size: 12px;">
            💡 Type your follow-up question above and press Enter or click Send
          </div>
          <div class="status" id="status"></div>
        </div>
        
        <script>
          ${this.getChatScript(conversationId)}
        </script>
      </body>
      </html>
    `;

    window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    window.once('ready-to-show', () => {
      window.show();
    });
  }

  private renderMessages(messages: Conversation['history']): string {
    return messages.map(msg => `
      <div class="message ${msg.role}">
        <div class="message-header">${msg.role === 'user' ? 'You:' : 'AI Assistant:'}</div>
        <div style="white-space: pre-wrap;">${msg.content}</div>
        <div class="timestamp">${new Date(msg.timestamp || Date.now()).toLocaleString()}</div>
      </div>
    `).join('');
  }

  private getChatStyles(): string {
    // Return the CSS as a string - in a real app, you'd read from a file
    return `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        margin: 0;
        padding: 0;
        background: #f5f5f5;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .header {
        background: #2196f3;
        color: white;
        padding: 15px 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .header h1 {
        margin: 0;
        font-size: 1.2em;
      }
      .chat-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        max-width: 1000px;
        margin: 0 auto;
        width: 100%;
        padding: 20px;
        box-sizing: border-box;
      }
      .messages {
        flex: 1;
        overflow-y: auto;
        margin-bottom: 20px;
        padding: 20px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      .message {
        margin-bottom: 20px;
        padding: 15px;
        border-radius: 10px;
        line-height: 1.6;
      }
      .message.user {
        background: #e3f2fd;
        border-left: 4px solid #2196f3;
        margin-left: 50px;
      }
      .message.assistant {
        background: #f8f9fa;
        border-left: 4px solid #4caf50;
        margin-right: 50px;
      }
      .message-header {
        font-weight: bold;
        margin-bottom: 8px;
        color: #333;
      }
      .input-area {
        display: flex;
        gap: 10px;
        align-items: center;
        padding: 10px;
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        margin-top: 10px;
      }
      .input-area input {
        flex: 1;
        padding: 12px 15px;
        border: 2px solid #2196f3;
        border-radius: 25px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.3s;
        background: white;
      }
      .input-area input:focus {
        border-color: #2196f3;
      }
      .input-area button {
        padding: 12px 25px;
        background: #2196f3;
        color: white;
        border: none;
        border-radius: 25px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s;
      }
      .input-area button:hover:not(:disabled) {
        background: #1976d2;
      }
      .input-area button:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
      .status {
        margin-top: 10px;
        padding: 10px;
        border-radius: 5px;
        font-size: 14px;
      }
      .status.loading {
        background: #fff3cd;
        color: #856404;
        border: 1px solid #ffeaa7;
      }
      .status.error {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
      }
      .status.success {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
      }
      .timestamp {
        color: #666;
        font-size: 0.8em;
        margin-top: 5px;
      }
    `;
  }

  private getChatScript(conversationId: string): string {
    // Return the JavaScript as a string - in a real app, you'd read from a file
    return `
      const conversationId = '${conversationId}';
      let isProcessing = false;
      
      const chatInput = document.getElementById('chatInput');
      const sendButton = document.getElementById('sendButton');
      const status = document.getElementById('status');
      const messages = document.getElementById('messages');
      
      const setStatus = (message, type) => {
        status.textContent = message;
        status.className = \`status \${type}\`;
      };
      
      const setProcessing = (processing) => {
        isProcessing = processing;
        sendButton.disabled = processing;
        chatInput.disabled = processing;
        
        if (processing) {
          setStatus('🤖 AI is thinking...', 'loading');
        } else {
          setStatus('', '');
        }
      };
      
      const addMessage = (role, content, timestamp) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = \`message \${role}\`;
        
        const header = role === 'user' ? 'You:' : 'AI Assistant:';
        messageDiv.innerHTML = \`
          <div class="message-header">\${header}</div>
          <div style="white-space: pre-wrap;">\${content}</div>
          <div class="timestamp">\${new Date(timestamp).toLocaleString()}</div>
        \`;
        
        messages.appendChild(messageDiv);
        messages.scrollTop = messages.scrollHeight;
      };
      
      const sendMessage = async () => {
        const message = chatInput.value.trim();
        
        if (!message || isProcessing) {
          return;
        }

        setProcessing(true);
        chatInput.value = '';
        
        addMessage('user', message, Date.now());

        if (window.electronAPI && window.electronAPI.sendChatMessage) {
          try {
            const response = await window.electronAPI.sendChatMessage(conversationId, message);
            
            if (response.success) {
              addMessage('assistant', response.data, Date.now());
              setStatus('✅ Response received!', 'success');
              setTimeout(() => setStatus('', ''), 2000);
            } else {
              setStatus(\`❌ Error: \${response.error}\`, 'error');
            }
          } catch (error) {
            console.error('Error sending message:', error);
            setStatus('❌ Failed to send message', 'error');
          } finally {
            setProcessing(false);
          }
        } else {
          setStatus('❌ Chat functionality not available', 'error');
          setProcessing(false);
        }
      };
      
      sendButton.addEventListener('click', sendMessage);
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !isProcessing) {
          sendMessage();
        }
      });
      
      chatInput.focus();
      console.log('🤖 Chat window loaded successfully!');
    `;
  }
}
