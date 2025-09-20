# Productivity Layer

An Electron-based productivity application with AI chat capabilities.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OpenAI API Key

To use the AI chat features, you need to set up your OpenAI API key:

**Option 1: Use the setup script (recommended)**
```bash
npm run setup
```

**Option 2: Manual setup**
1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a `.env` file in the project root:
   ```bash
   echo "OPENAI_API_KEY=your_actual_api_key_here" > .env
   ```
3. Replace `your_actual_api_key_here` with your actual OpenAI API key

### 3. Run the Application

```bash
npm start
```

## Features

- AI-powered chat windows
- Clipboard management
- Always-on-top productivity overlay
- Conversation history management

## Troubleshooting

If you see an error about missing OpenAI credentials:
1. Make sure you've created the `.env` file
2. Verify your API key is correct
3. Ensure the `.env` file is in the project root directory
4. Restart the application after adding the API key
