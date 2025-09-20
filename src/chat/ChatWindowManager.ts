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
      width: 400,
      height: 500,
        frame: false,
      transparent: true,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
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
    
    console.log('Loading chat window fallback with conversation ID:', conversationId);
    console.log('Initial messages:', initialMessages);
    
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
          <div class="header-content">
            <h1 class="header-title">AI Chat</h1>
            <span class="header-keywords" id="header-keywords"></span>
          </div>
          <button class="close-btn" id="close-btn" title="Close">×</button>
        </div>
        <div class="chat-container">
          <div class="messages" id="messages">
            ${this.renderMessages(initialMessages)}
          </div>
          <div class="input-area">
            <input 
              type="text" 
              id="chatInput" 
              maxlength="500"
            />
            <button id="sendButton">Send</button>
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
        background: transparent;
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        -webkit-app-region: drag;
        touch-action: manipulation;
      }
      .header {
        background: rgba(255, 255, 255, 0.8);
        color: #333;
        padding: 12px 16px;
        border-radius: 12px 12px 0 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        backdrop-filter: blur(15px);
        -webkit-app-region: drag;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .header-content {
        display: flex;
        flex-direction: column;
        flex: 1;
        -webkit-app-region: drag;
      }
      .header-title {
        margin: 0 0 2px 0;
        font-size: 1.1em;
        font-weight: 600;
        -webkit-app-region: drag;
      }
      .header-keywords {
        font-size: 0.8em;
        color: #555;
        font-weight: 500;
        opacity: 1;
        -webkit-app-region: drag;
        margin-top: 1px;
        display: block;
      }
      .close-btn {
        background: none;
        border: none;
        font-size: 20px;
        color: #666;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s;
        -webkit-app-region: no-drag;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .close-btn:hover {
        background: rgba(255, 0, 0, 0.1);
        color: #d32f2f;
      }
      .chat-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        width: 100%;
        height: calc(100vh - 60px);
        padding: 0;
        margin: 0;
        box-sizing: border-box;
        background: rgba(255, 255, 255, 0.75);
        border-radius: 0 0 12px 12px;
        backdrop-filter: blur(15px);
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .messages {
        flex: 1;
        overflow-y: scroll;
        overflow-x: hidden;
        padding: 12px 16px;
        background: transparent;
        margin: 0;
        max-height: calc(100vh - 120px);
        min-height: 200px;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        touch-action: pan-y;
        -webkit-app-region: no-drag;
      }
      
      /* Custom scrollbar styling */
      .messages::-webkit-scrollbar {
        width: 6px;
      }
      
      .messages::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.1);
        border-radius: 3px;
      }
      
      .messages::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 3px;
      }
      
      .messages::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.5);
      }
      .message {
        margin-bottom: 8px;
        padding: 8px 12px;
        border-radius: 8px;
        line-height: 1.4;
      }
      .message.user {
        background: rgba(33, 150, 243, 0.05);
        border-left: 3px solid rgba(33, 150, 243, 0.6);
        margin-left: 20px;
        backdrop-filter: blur(8px);
      }
      .message.assistant {
        background: rgba(76, 175, 80, 0.05);
        border-left: 3px solid rgba(76, 175, 80, 0.6);
        margin-right: 20px;
        backdrop-filter: blur(8px);
      }
      .message-header {
        font-weight: 600;
        margin-bottom: 4px;
        color: rgba(51, 51, 51, 0.9);
        font-size: 0.9em;
      }
      .input-area {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 8px 12px;
        background: transparent;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        margin: 0;
        -webkit-app-region: no-drag;
      }
      .input-area input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 6px;
        font-size: 13px;
        outline: none;
        transition: border-color 0.3s;
        background: rgba(255, 255, 255, 0.7);
        -webkit-app-region: no-drag;
        backdrop-filter: blur(10px);
      }
      .input-area input:focus {
        border-color: #2196f3;
      }
      .input-area button {
        padding: 8px 16px;
        background: #2196f3;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        transition: background-color 0.3s;
        -webkit-app-region: no-drag;
      }
      .input-area button:hover:not(:disabled) {
        background: #1976d2;
      }
      .input-area button:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
      .status {
        margin: 0;
        padding: 4px 12px;
        border-radius: 0;
        font-size: 12px;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(10px);
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
        color: rgba(102, 102, 102, 0.7);
        font-size: 0.75em;
        margin-top: 4px;
        opacity: 0.9;
      }
    `;
  }

  private getChatScript(conversationId: string): string {
    // Return the JavaScript as a string - in a real app, you'd read from a file
    return `
      const conversationId = '${conversationId}';
      let isProcessing = false;
      
      console.log('Chat window initialized with conversation ID:', conversationId);
      console.log('Initial messages:', window.initialMessages);
      
      const chatInput = document.getElementById('chatInput');
      const sendButton = document.getElementById('sendButton');
      const status = document.getElementById('status');
      const messages = document.getElementById('messages');
      const closeBtn = document.getElementById('close-btn');
      const headerTitle = document.getElementById('header-title');
      const headerKeywords = document.getElementById('header-keywords');
      
      console.log('Header keywords element:', headerKeywords);
      
      // Extract keywords from initial prompt
      if (window.initialMessages && window.initialMessages.length > 0) {
        const firstMessage = window.initialMessages[0];
        if (firstMessage && firstMessage.content) {
          console.log('Extracting keywords from:', firstMessage.content);
          const keywords = extractKeywords(firstMessage.content);
          console.log('Extracted keywords:', keywords);
          if (keywords.length > 0) {
            headerKeywords.textContent = keywords.join(' • ');
            console.log('Set keywords text:', headerKeywords.textContent);
          } else {
            headerKeywords.textContent = 'general chat';
            console.log('No keywords found, using fallback');
          }
        } else {
          headerKeywords.textContent = 'new conversation';
          console.log('No initial message, using fallback');
        }
      } 
      // else {
      //   headerKeywords.textContent = 'loading...';
      //   console.log('No initial messages, using loading fallback');
      // }
      
      // Test if the element is working - this should always show
      // if (headerKeywords) {
      //   console.log('Keywords element found and working');
      //   // Set a test value if no keywords were set
      //   if (!headerKeywords.textContent || headerKeywords.textContent === '') {
      //     headerKeywords.textContent = 'test keywords';
      //     console.log('Set test keywords');
      //   }
      // } else {
      //   console.error('Header keywords element not found!');
      // }
      
      // Function to extract key words from prompt
      function extractKeywords(text) {
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their']);
        
        // Clean and split text into words
        const words = text.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 2 && !stopWords.has(word));
        
        // Count word frequency
        const wordCount = {};
        words.forEach(word => {
          wordCount[word] = (wordCount[word] || 0) + 1;
        });
        
        // Get top words, prioritizing longer words and avoiding common patterns
        const topWords = Object.entries(wordCount)
          .sort((a, b) => {
            // Prioritize by frequency, then by length
            if (b[1] !== a[1]) return b[1] - a[1];
            return b[0].length - a[0].length;
          })
          .slice(0, 4)
          .map(([word]) => word)
          .filter(word => word.length > 3); // Only include words longer than 3 characters
        
        // If we don't have enough meaningful words, include some shorter ones
        if (topWords.length < 2) {
          const additionalWords = Object.entries(wordCount)
            .filter(([word]) => word.length >= 3)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([word]) => word);
          
          topWords.push(...additionalWords.filter(word => !topWords.includes(word)));
        }
        
        return topWords.slice(0, 3); // Return max 3 keywords
      }
      
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
        
        // Smooth scroll to bottom
        setTimeout(() => {
          messages.scrollTo({
            top: messages.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      };
      
      const sendMessage = async () => {
        const message = chatInput.value.trim();
        
        if (!message || isProcessing) {
          return;
        }

        console.log('Sending message:', message, 'to conversation:', conversationId);
        setProcessing(true);
        chatInput.value = '';
        
        addMessage('user', message, Date.now());

        if (window.electronAPI && window.electronAPI.chat && window.electronAPI.chat.sendChatMessage) {
          try {
            console.log('Calling sendChatMessage with:', conversationId, message);
            const response = await window.electronAPI.chat.sendChatMessage(conversationId, message);
            console.log('Received response:', response);
            
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
          console.error('Chat API not available:', window.electronAPI);
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
      
      closeBtn.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.closeWindow) {
          window.electronAPI.closeWindow();
        } else {
          window.close();
        }
      });
      
      chatInput.focus();
      
      // Ensure proper wheel event handling for touchpad scrolling
      messages.addEventListener('wheel', (e) => {
        // Allow default wheel behavior for smooth scrolling
        e.stopPropagation();
      }, { passive: true });
      
      // Scroll to bottom on initial load
      setTimeout(() => {
        if (messages.scrollHeight > messages.clientHeight) {
          messages.scrollTo({
            top: messages.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 200);
      
      console.log('🤖 Chat window loaded successfully!');
    `;
  }
}
