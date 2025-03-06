# OpenRouter Proxy Server

A proxy server for OpenRouter that handles API key rotation and rate limiting. Designed to work seamlessly with tools like Aider while using free models.

## Features

- Support for both streaming and non-streaming responses
- Smart API key management with sticking to successful keys for better caching
- Automatic key rotation only on rate limits
- JSON-based key storage (no database required)
- Comprehensive logging system with rotation
- Easy integration with existing OpenAI SDK clients

## Prerequisites

- Node.js (v16 or higher)
- One or more OpenRouter API keys

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```env
PORT=3000  # Optional, defaults to 3000
```

3. Add your API key using the interactive script:
```bash
node add-key.js
```

4. Start the proxy server:
```bash
node server.js
```

## Managing API Keys

### Using the Interactive Script

Run the interactive script to add a new API key:
```bash
node add-key.js
```
This will prompt you to enter your API key and safely store it in `data/keys.json`.

### Using the API Endpoint

Alternatively, use the admin endpoint to add new API keys:
```bash
curl -X POST http://localhost:3000/admin/keys \
  -H "Content-Type: application/json" \
  -d '{"key": "your-openrouter-api-key"}'
```

## Using with Clients

The proxy supports both streaming and non-streaming responses. Configure your OpenAI SDK clients to use the proxy:

### Non-Streaming Example
```javascript
const openai = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'dummy-key',  // The actual key is managed by proxy
});

// Non-streaming request
const completion = await openai.chat.completions.create({
  model: 'deepseek/deepseek-chat:free',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: false,  // Disable streaming
});
```

### Streaming Example
```javascript
// Streaming request
const stream = await openai.chat.completions.create({
  model: 'deepseek/deepseek-chat:free',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,  // Enable streaming
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

See `client-example.js` for complete examples of both streaming and non-streaming usage.

### When to Use Streaming vs Non-Streaming

- **Use Streaming When:**
  - You want to display responses in real-time
  - The application can handle partial responses
  - Network reliability is good

- **Use Non-Streaming When:**
  - You need better caching
  - Network conditions are unreliable
  - You're building automation tools (like Aider)
  - You need to process the complete response as a whole

## How it Works

### Key Management Strategy
1. The proxy uses the same API key for consecutive requests to maximize caching benefits
2. Keys are only rotated when:
   - A rate limit is hit (429 response)
   - The key has too many consecutive failures
3. When a key hits rate limits, it's put in cooldown based on the rate limit reset time
4. Keys in cooldown are automatically reactivated after their cooldown period

### Streaming Support
1. The proxy maintains persistent connections for streaming responses
2. Each stream chunk is properly logged and monitored
3. Stream errors are gracefully handled with proper cleanup
4. Automatic retry with key rotation on rate limits

### Logging System
1. Requests log: All incoming requests and responses (including stream chunks)
2. Error log: Detailed error tracking with stack traces
3. Key management log: Tracks key rotations, rate limits, and status changes
4. All logs are automatically rotated daily with retention policies

## Error Handling

- Rate limits: Automatically handles by rotating to next available key
- Stream disconnections: Graceful error handling with client notification
- API key failures: Keys with repeated failures are deactivated
- All errors are logged with full context for debugging
- Automatic retry mechanism for recoverable errors

## Log Files

Logs are stored in the `logs` directory:
- `requests-%DATE%.log` - API request/response logs (including stream chunks)
- `errors-%DATE%.log` - Error logs with stack traces
- `keys-%DATE%.log` - Key management events

Log files are automatically rotated daily and kept for 14 days.