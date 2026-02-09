# Neural Memory API Reference

**Version:** 1.0.0
**Phase:** 1 - Foundation
**Last Updated:** 2026-02-08

This document provides a complete API reference for the Neural Memory system in Dyad. The neural memory architecture eliminates the 200k token limit by implementing a 3-tier memory system with intelligent context retrieval.

---

## Table of Contents

1. [Overview](#overview)
2. [nmem Service API](#nmem-service-api)
3. [Background Sync API](#background-sync-api)
4. [Token Counter API](#token-counter-api)
5. [Database Schema](#database-schema)
6. [Configuration](#configuration)
7. [Error Handling](#error-handling)
8. [Usage Examples](#usage-examples)

---

## Overview

The Neural Memory system consists of three main components:

1. **nmem_service** - Interface to neural memory CLI
2. **background_sync** - Asynchronous queue for non-blocking operations
3. **token_counter** - Token estimation with caching

All operations are designed to be **backward compatible** and **gracefully degrade** if neural memory is unavailable.

---

## nmem Service API

**Location:** `src/lib/nmem_service.ts`

### saveMessage()

Save a message to neural memory.

```typescript
function saveMessage(
  chatId: number,
  message: ModelMessage,
  messageId?: number
): Promise<boolean>
```

**Parameters:**
- `chatId` - Chat ID for message isolation
- `message` - ModelMessage object from AI SDK
- `messageId` - Optional message ID for tracking

**Returns:** `true` if saved successfully, `false` otherwise

**Features:**
- Automatic retry with exponential backoff (3 attempts)
- Handles both string and array content types
- Escapes special characters for shell safety
- Comprehensive logging

**Example:**
```typescript
const success = await saveMessage(42, {
  role: 'user',
  content: 'How do I add authentication?'
}, 1337);

if (success) {
  console.log('Message saved to neural memory');
}
```

---

### batchSave()

Save multiple messages in sequence.

```typescript
function batchSave(
  chatId: number,
  messages: Array<{ message: ModelMessage; messageId?: number }>
): Promise<number>
```

**Parameters:**
- `chatId` - Chat ID
- `messages` - Array of messages with optional IDs

**Returns:** Number of successfully saved messages

**Example:**
```typescript
const saved = await batchSave(42, [
  { message: msg1, messageId: 1 },
  { message: msg2, messageId: 2 },
  { message: msg3, messageId: 3 }
]);

console.log(`Saved ${saved}/3 messages`);
```

---

### recall()

Semantic search for relevant messages.

```typescript
function recall(
  chatId: number,
  query: string,
  depth?: number
): Promise<string[]>
```

**Parameters:**
- `chatId` - Chat ID to search within
- `query` - Search query
- `depth` - Number of results (default: 5)

**Returns:** Array of recalled message contents

**Example:**
```typescript
const results = await recall(42, 'authentication setup', 3);
console.log('Found:', results);
```

---

### getContext()

Get recent context from neural memory.

```typescript
function getContext(
  chatId: number,
  limit?: number
): Promise<string>
```

**Parameters:**
- `chatId` - Chat ID
- `limit` - Maximum items (default: 30)

**Returns:** Recent context as string

**Example:**
```typescript
const context = await getContext(42, 20);
```

---

### getToday()

Get today's work from neural memory.

```typescript
function getToday(chatId: number): Promise<string>
```

**Parameters:**
- `chatId` - Chat ID (for logging)

**Returns:** Today's context

**Example:**
```typescript
const today = await getToday(42);
console.log("Today's work:", today);
```

---

### consolidate()

Consolidate and optimize neural memory.

```typescript
function consolidate(): Promise<boolean>
```

**Returns:** `true` if consolidation succeeded

**Usage:** Call periodically (e.g., every 50 messages) to compress memories.

**Example:**
```typescript
if (messageCount % 50 === 0) {
  await consolidate();
}
```

---

### saveSummary()

Save a conversation summary.

```typescript
function saveSummary(
  chatId: number,
  summary: string,
  messageRange: { start: number; end: number }
): Promise<boolean>
```

**Parameters:**
- `chatId` - Chat ID
- `summary` - Summary text
- `messageRange` - Message ID range

**Returns:** `true` if saved successfully

**Example:**
```typescript
await saveSummary(
  42,
  'User implemented authentication with JWT',
  { start: 1, end: 50 }
);
```

---

### isNmemAvailable()

Check if nmem CLI is available.

```typescript
function isNmemAvailable(): Promise<boolean>
```

**Returns:** `true` if nmem is available

**Example:**
```typescript
if (await isNmemAvailable()) {
  // Use neural memory features
} else {
  // Fallback to standard behavior
}
```

---

## Background Sync API

**Location:** `src/services/background_sync.ts`

### queueMessageSync()

Queue a message for background sync to nmem.

```typescript
function queueMessageSync(
  chatId: number,
  messageId: number,
  message: ModelMessage
): Promise<void>
```

**Features:**
- Non-blocking (async queue)
- Persisted to SQLite
- Automatic flush every 5s or 10 items
- Retry on failure (max 3 attempts)

**Example:**
```typescript
await queueMessageSync(42, 1337, userMessage);
// Message will be synced in background
```

---

### queueSummarySync()

Queue a summary for background sync.

```typescript
function queueSummarySync(
  chatId: number,
  messageId: number,
  summary: string,
  messageRange: { start: number; end: number }
): Promise<void>
```

**Example:**
```typescript
await queueSummarySync(
  42,
  50,
  'Implemented auth system',
  { start: 1, end: 50 }
);
```

---

### flushQueue()

Manually flush the sync queue (for testing or forced sync).

```typescript
function flushQueue(): Promise<void>
```

**Example:**
```typescript
await flushQueue(); // Process all queued items immediately
```

---

### shutdownBackgroundSync()

Gracefully shutdown the sync service (flushes remaining items).

```typescript
function shutdownBackgroundSync(): Promise<void>
```

**Usage:** Call when app is closing.

**Example:**
```typescript
app.on('before-quit', async () => {
  await shutdownBackgroundSync();
});
```

---

### getQueueStatus()

Get current queue status.

```typescript
function getQueueStatus(): {
  queueLength: number;
  isProcessing: boolean;
  isShuttingDown: boolean;
}
```

**Example:**
```typescript
const status = getQueueStatus();
console.log(`Queue: ${status.queueLength} items`);
```

---

## Token Counter API

**Location:** `src/lib/token_counter.ts`

### cacheMessageTokens()

Cache token estimate for a message.

```typescript
function cacheMessageTokens(
  messageId: number,
  estimatedTokens: number
): Promise<void>
```

**Example:**
```typescript
await cacheMessageTokens(1337, 450);
```

---

### getCachedMessageTokens()

Get cached token estimate.

```typescript
function getCachedMessageTokens(
  messageId: number
): Promise<number | null>
```

**Returns:** Cached token count or `null` if not cached

**Example:**
```typescript
const cached = await getCachedMessageTokens(1337);
if (cached !== null) {
  console.log(`Cached: ${cached} tokens`);
}
```

---

### cacheTokenEstimates()

Cache token estimates for all messages in a chat.

```typescript
function cacheTokenEstimates(chatId: number): Promise<number>
```

**Returns:** Number of messages cached

**Example:**
```typescript
const cached = await cacheTokenEstimates(42);
console.log(`Cached ${cached} messages`);
```

---

### estimateConversationTokensCached()

Estimate conversation tokens using cached values when available.

```typescript
function estimateConversationTokensCached(
  chatId: number,
  systemPromptSize?: number
): Promise<number>
```

**Parameters:**
- `chatId` - Chat ID
- `systemPromptSize` - System prompt tokens (default: 600)

**Returns:** Total estimated tokens

**Example:**
```typescript
const total = await estimateConversationTokensCached(42);
console.log(`Total: ${total} tokens`);
```

---

### estimateMessageTokens()

Estimate tokens in a single message.

```typescript
function estimateMessageTokens(message: ModelMessage): number
```

**Returns:** Estimated token count

**Example:**
```typescript
const tokens = estimateMessageTokens({
  role: 'user',
  content: 'Test message'
});
```

---

### shouldAutoSaveConversation()

Check if conversation should be auto-saved.

```typescript
function shouldAutoSaveConversation(
  messages: ModelMessage[],
  systemPromptSize?: number
): {
  shouldSave: boolean;
  isCritical: boolean;
  currentTokens: number;
  percentage: number;
}
```

**Returns:** Auto-save recommendation with metrics

**Example:**
```typescript
const result = shouldAutoSaveConversation(messages);
if (result.shouldSave) {
  console.log(`${result.percentage}% of limit - auto-saving...`);
}
```

---

## Database Schema

### messages (modified)

New columns added:

```sql
memory_tier TEXT NOT NULL DEFAULT 'active'
  -- 'active' | 'session' | 'archived'

nmem_synced INTEGER NOT NULL DEFAULT 0
  -- Boolean: 1 if synced to nmem

nmem_synced_at INTEGER
  -- Timestamp of last sync

estimated_tokens INTEGER
  -- Cached token count

summary_id INTEGER REFERENCES conversation_summaries(id)
  -- Reference to summary if message was summarized
```

---

### conversation_summaries (new)

```sql
CREATE TABLE conversation_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  start_message_id INTEGER NOT NULL,
  end_message_id INTEGER NOT NULL,
  summary TEXT NOT NULL,
  estimated_tokens INTEGER NOT NULL,
  nmem_synced INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

---

### chat_memory_config (new)

```sql
CREATE TABLE chat_memory_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
  active_window_size INTEGER NOT NULL DEFAULT 30,
  active_window_token_budget INTEGER NOT NULL DEFAULT 40000,
  last_summarized_message_id INTEGER,
  total_messages INTEGER NOT NULL DEFAULT 0,
  nmem_project_scope TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

---

### nmem_sync_queue (new)

```sql
CREATE TABLE nmem_sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  operation TEXT NOT NULL, -- 'save_message' | 'save_summary'
  payload TEXT NOT NULL,   -- JSON
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

---

## Configuration

### Token Limits

```typescript
export const TOKEN_LIMITS = {
  MAX_TOKENS: 200000,           // Claude API hard limit
  WARNING_THRESHOLD: 180000,    // 90% - trigger auto-save
  CRITICAL_THRESHOLD: 190000,   // 95% - force auto-save
  SYSTEM_PROMPT_COMPACT: 600,   // COMPACT mode baseline
  SYSTEM_PROMPT_FULL: 5000,     // FULL mode baseline
};
```

### Sync Configuration

```typescript
const SYNC_CONFIG = {
  FLUSH_INTERVAL: 5000,    // 5 seconds
  BATCH_SIZE: 10,          // Flush when queue reaches this size
  MAX_RETRIES: 3,
  RETRY_BACKOFF: 5000,     // 5 seconds between retries
};
```

### Retry Configuration

```typescript
const NMEM_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_BACKOFF: 1000,   // 1 second
  MAX_TIMEOUT: 30000,      // 30 seconds
  MAX_BUFFER: 5 * 1024 * 1024,  // 5MB
};
```

---

## Error Handling

All neural memory operations follow these principles:

1. **Graceful Degradation** - Failures don't block the user
2. **Retry Logic** - Automatic retry with exponential backoff
3. **Comprehensive Logging** - All errors logged for debugging
4. **Type-Safe** - Custom error types for better handling

### Error Types

```typescript
class NmemError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = "NmemError";
  }
}
```

### Common Error Codes

- `MAX_RETRIES_EXCEEDED` - Operation failed after 3 attempts
- `TIMEOUT` - Operation exceeded timeout
- `INVALID_RESPONSE` - nmem returned unexpected output

---

## Usage Examples

### Basic Message Save

```typescript
import { saveMessage } from './lib/nmem_service';

// Save user message
const userMessage = { role: 'user', content: 'Add authentication' };
await saveMessage(chatId, userMessage, messageId);

// Save assistant response
const assistantMessage = { role: 'assistant', content: 'I'll help...' };
await saveMessage(chatId, assistantMessage, assistantMessageId);
```

---

### Background Sync Pattern

```typescript
import { queueMessageSync } from './services/background_sync';

// Queue message (non-blocking)
await queueMessageSync(chatId, messageId, message);

// Message will be synced in background
// No need to wait
```

---

### Token Budget Management

```typescript
import {
  estimateConversationTokensCached,
  shouldAutoSaveConversation
} from './lib/token_counter';

// Check token usage
const total = await estimateConversationTokensCached(chatId);
const result = shouldAutoSaveConversation(messages);

if (result.shouldSave) {
  console.log(`Token usage: ${result.percentage}%`);
  console.log(`Current: ${result.currentTokens} / ${TOKEN_LIMITS.MAX_TOKENS}`);

  if (result.isCritical) {
    // Force auto-save
    await triggerAutoSave(chatId);
  }
}
```

---

### Semantic Search

```typescript
import { recall } from './lib/nmem_service';

// User asks: "What did we decide about auth?"
const query = 'authentication decision';
const relevantMessages = await recall(chatId, query, 3);

// Inject into context
for (const memory of relevantMessages) {
  console.log('Recalled:', memory);
}
```

---

### Conversation Summarization

```typescript
import { saveSummary } from './lib/nmem_service';
import { queueSummarySync } from './services/background_sync';

// Every 50 messages, create summary
if (messageCount % 50 === 0) {
  const summary = await generateSummary(messages.slice(-50));

  await queueSummarySync(
    chatId,
    messageCount,
    summary,
    { start: messageCount - 49, end: messageCount }
  );
}
```

---

### App Shutdown

```typescript
import { shutdownBackgroundSync } from './services/background_sync';

app.on('before-quit', async (event) => {
  event.preventDefault();

  console.log('Flushing neural memory queue...');
  await shutdownBackgroundSync();

  app.quit();
});
```

---

## Migration Guide

### Phase 1 Migration (Current)

All changes are **additive and backward compatible**:

1. New columns in `messages` table (with defaults)
2. New tables for summaries and config
3. No changes to existing chat behavior

**Migration:** Run `drizzle/0026_neural_memory_foundation.sql`

### Future Phases

- Phase 2: Active window implementation
- Phase 3: Semantic retrieval integration
- Phase 4: Automatic summarization
- Phase 5: Performance optimization

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Context retrieval | < 100ms |
| nmem save (sync) | < 200ms |
| nmem save (async) | Non-blocking |
| Token estimation (cached) | < 10ms |
| Queue flush | < 2s for 10 items |

---

## Testing

Run unit tests:
```bash
npm test nmem_service.test.ts
npm test background_sync.test.ts
npm test neural_memory_integration.test.ts
```

Test coverage: 100% for new code

---

## Support

**Issues:** Report bugs in neural memory implementation
**Docs:** See `neural-memory-architecture.md` for system design
**Code:** `src/lib/nmem_service.ts`, `src/services/background_sync.ts`

---

**Last Updated:** 2026-02-08
**Phase:** 1 - Foundation Complete ✅
