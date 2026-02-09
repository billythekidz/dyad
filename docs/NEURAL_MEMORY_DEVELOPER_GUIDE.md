# Neural Memory: Developer Guide

## Architecture Overview

Neural Memory is a three-tier intelligent conversation management system built across 5 phases:

### Phase 1: Foundation
- Database schema (`src/db/schema.ts`)
- nmem service layer (`src/lib/nmem_service.ts`)
- Background sync (`src/services/nmem_sync.ts`)
- Token counting with caching

### Phase 2: Active Window
- Memory tier assignment (`src/lib/memory_tiers.ts`)
- Active window retrieval (`src/services/active_window.ts`)
- Dynamic window sizing (30-50 messages)
- Token usage tracking

### Phase 3: Semantic Retrieval
- Context need detection (`src/lib/context_detector.ts`)
- Semantic recall service (`src/lib/semantic_recall.ts`)
- Context merging (`src/lib/context_assembly.ts`)
- UI indicators for recalled context

### Phase 4: Summarization
- Summarization service (`src/services/summarization.ts`)
- Automatic triggers (every 50 messages)
- Summary storage (DB + nmem)
- Summary timeline UI

### Phase 5: Optimization & Rollout
- Performance caching (`src/lib/context_cache.ts`)
- Batch operations (`src/services/nmem_batch_queue.ts`)
- Telemetry (`src/lib/neural_memory_telemetry.ts`)
- Feature flags (`src/lib/feature_flags.ts`)
- Gradual rollout (10% → 100%)

## Core Components

### 1. Memory Tiers

```typescript
import { assignMemoryTier } from "@/lib/memory_tiers";

const tier = assignMemoryTier(message, {
  recency: 0.8,
  userMessage: true,
  hasCode: true,
  hasError: false,
});

// tier = "hot" | "warm" | "cold"
```

**Rules**:
- **Hot**: Last 30-50 messages, user messages, recent errors
- **Warm**: Moderately recent, code snippets, important context
- **Cold**: Older messages, routine confirmations

### 2. Active Window Retrieval

```typescript
import { getActiveWindow } from "@/services/active_window";

const activeMessages = await getActiveWindow(chatId, {
  minSize: 30,
  maxSize: 50,
  maxTokens: 50000,
});

// Returns most recent hot-tier messages
```

**Features**:
- Dynamic sizing based on message length
- Token budget enforcement
- LRU caching (5min TTL)

### 3. Semantic Recall

```typescript
import { shouldRecallContext } from "@/lib/context_detector";
import { semanticRecall } from "@/lib/semantic_recall";

if (shouldRecallContext(userMessage)) {
  const recalled = await semanticRecall(chatId, userMessage, {
    limit: 10,
    similarityThreshold: 0.7,
  });
}
```

**Triggers**:
- User asks question about past topic
- References earlier code/discussion
- Requests specific information

**How it works**:
1. Detect context need from user message
2. Query nmem with semantic search
3. Retrieve top N relevant messages
4. Merge with active window
5. Deduplicate

### 4. Context Assembly

```typescript
import { assembleContext } from "@/lib/context_assembly";

const context = await assembleContext(chatId, userMessage);

// Returns:
// {
//   messages: [...],
//   metadata: {
//     activeWindowSize: 45,
//     recalledCount: 8,
//     summariesIncluded: 2,
//     totalTokens: 42000,
//   }
// }
```

**Process**:
1. Get active window (hot tier)
2. Check if context recall needed
3. Fetch relevant messages (warm tier)
4. Load applicable summaries (cold tier)
5. Merge and deduplicate
6. Return assembled context

### 5. Summarization

```typescript
import { summarizeConversation } from "@/services/summarization";

const summary = await summarizeConversation(chatId, {
  startMessageId: 1,
  endMessageId: 50,
});

// Automatically triggered every 50 messages
```

**Storage**:
- Database: `conversation_summaries` table
- nmem: Embedded for semantic search
- UI: Timeline view

### 6. Performance Optimization

#### Caching

```typescript
import { activeWindowCache, recallResultsCache } from "@/lib/context_cache";

// Cache active window
const cacheKey = getActiveWindowCacheKey(chatId);
activeWindowCache.set(cacheKey, messages);

// Check cache first
const cached = activeWindowCache.get(cacheKey);
if (cached) return cached;
```

**Cache Strategy**:
- Active window: 5min TTL, 100 entries max
- Recall results: 5min TTL, 200 entries max
- LRU eviction

#### Batch Queue

```typescript
import { nmemBatchQueue } from "@/services/nmem_batch_queue";

// Queue operations instead of immediate execution
await nmemBatchQueue.enqueue({
  type: "add",
  id: messageId,
  data: {
    content: message.content,
    metadata: { chatId, tier: "warm" },
  },
});

// Automatically batches 10 ops or flushes every 5s
```

**Benefits**:
- Reduces CLI calls by 90%
- Better throughput
- Automatic batching

### 7. Telemetry

```typescript
import { telemetry } from "@/lib/neural_memory_telemetry";

telemetry.trackContextAssembled({
  chatId,
  activeWindowSize: 45,
  recalledMessagesCount: 8,
  summariesIncluded: 2,
  totalTokens: 42000,
  latencyMs: 87,
  memoryMode: "neural",
});

// Get analytics
const analytics = telemetry.getAnalytics(24 * 60 * 60 * 1000); // Last 24h
console.log(analytics.tokenUsage.reduction); // 67%
```

**Tracked Events**:
- Context assembled
- Conversation summarized
- Chat migrated
- Cache hits/misses
- Nmem batch operations
- Performance metrics

### 8. Feature Flags

```typescript
import { isNeuralMemoryEnabled, getRolloutStatus } from "@/lib/feature_flags";

const enabled = isNeuralMemoryEnabled(userId);

if (enabled) {
  // Use neural memory
  const context = await assembleContext(chatId, message);
} else {
  // Fall back to legacy
  const context = await getLegacyContext(chatId);
}

// Check rollout status
const status = getRolloutStatus();
console.log(status.stage); // "beta" | "early-adopters" | "majority" | "full"
```

**Rollout Control**:
```bash
# Environment variables
NEURAL_MEMORY_ENABLED=true
NEURAL_MEMORY_ROLLOUT=50  # 0-100 percentage
NEURAL_MEMORY_BETA_USERS=user1,user2,user3
```

## Database Schema

```sql
-- Memory tiers for messages
ALTER TABLE messages ADD COLUMN memory_tier TEXT DEFAULT 'warm';
ALTER TABLE messages ADD COLUMN nmem_synced INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN last_accessed INTEGER;

-- Conversation summaries
CREATE TABLE conversation_summaries (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  start_message_id TEXT NOT NULL,
  end_message_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  message_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  nmem_id TEXT,
  FOREIGN KEY (chat_id) REFERENCES chats(id)
);

-- Indexes
CREATE INDEX idx_messages_memory_tier ON messages(memory_tier);
CREATE INDEX idx_messages_last_accessed ON messages(last_accessed);
CREATE INDEX idx_summaries_chat_id ON conversation_summaries(chat_id);
```

## API Reference

### Memory Tiers

#### `assignMemoryTier(message, factors): MemoryTier`

Assigns hot/warm/cold tier to a message.

**Parameters**:
- `message`: Message object
- `factors`: Recency, importance, etc.

**Returns**: `"hot" | "warm" | "cold"`

### Active Window

#### `getActiveWindow(chatId, options): Promise<Message[]>`

Retrieves active window messages.

**Parameters**:
- `chatId`: Chat identifier
- `options`: `{ minSize, maxSize, maxTokens }`

**Returns**: Array of recent messages

### Semantic Recall

#### `semanticRecall(chatId, query, options): Promise<Message[]>`

Retrieves semantically relevant messages.

**Parameters**:
- `chatId`: Chat identifier
- `query`: Search query (user message)
- `options`: `{ limit, similarityThreshold }`

**Returns**: Array of relevant messages

### Context Assembly

#### `assembleContext(chatId, userMessage): Promise<Context>`

Assembles full context for AI request.

**Parameters**:
- `chatId`: Chat identifier
- `userMessage`: Current user message

**Returns**: Context object with messages and metadata

### Summarization

#### `summarizeConversation(chatId, range): Promise<Summary>`

Creates conversation summary.

**Parameters**:
- `chatId`: Chat identifier
- `range`: `{ startMessageId, endMessageId }`

**Returns**: Summary object

## Performance Tuning

### Target Metrics

- Active window retrieval: <50ms (p95)
- Semantic recall: <200ms (p95)
- Context assembly: <100ms (p95)
- End-to-end: <2s (p95)

### Optimization Checklist

- [ ] Enable caching (context_cache.ts)
- [ ] Use batch queue for nmem ops
- [ ] Add database indexes (see schema above)
- [ ] Preload chat config
- [ ] Monitor telemetry for bottlenecks

### Cache Configuration

```typescript
// Adjust cache size based on usage
const activeWindowCache = new LRUCache<any>(
  100, // max entries
  5 * 60 * 1000, // 5min TTL
);
```

### Batch Queue Configuration

```typescript
const nmemBatchQueue = new NmemBatchQueue({
  batchSize: 10, // operations per batch
  flushIntervalMs: 5000, // 5 seconds
});
```

## Debugging

### Enable Debug Logging

```typescript
import log from "electron-log";

log.transports.file.level = "debug";
log.transports.console.level = "debug";
```

### Check Telemetry

```typescript
import { telemetry } from "@/lib/neural_memory_telemetry";

const analytics = telemetry.getAnalytics();
console.log("Token reduction:", analytics.tokenUsage.reduction);
console.log("Cache hit rate:", analytics.cache.hitRate);
console.log("Error rate:", analytics.performance.errorRate);
```

### View Cache Stats

```typescript
import { getCombinedCacheStats } from "@/lib/context_cache";

const stats = getCombinedCacheStats();
console.log("Active window cache:", stats.activeWindow);
console.log("Recall cache:", stats.recallResults);
```

### Monitor Batch Queue

```typescript
import { nmemBatchQueue } from "@/services/nmem_batch_queue";

const stats = nmemBatchQueue.getStats();
console.log("CLI calls saved:", stats.cliCallsSaved);
console.log("Reduction:", stats.reductionPercentage);
```

## Testing

### Unit Tests

```bash
npm test
```

### Performance Benchmarks

```bash
npm test src/__tests__/performance/benchmarks.test.ts
```

### Integration Tests

```bash
npm test src/__tests__/integration/
```

## Rollout Process

### 1. Beta Testing (Day 1)

```bash
NEURAL_MEMORY_ENABLED=true
NEURAL_MEMORY_ROLLOUT=0
NEURAL_MEMORY_BETA_USERS=user1,user2,user3
```

### 2. Early Adopters (Day 2)

```bash
NEURAL_MEMORY_ROLLOUT=25
```

### 3. Half Rollout (Day 3)

```bash
NEURAL_MEMORY_ROLLOUT=50
```

### 4. Majority (Day 4)

```bash
NEURAL_MEMORY_ROLLOUT=75
```

### 5. Full Release (Day 5)

```bash
NEURAL_MEMORY_ROLLOUT=100
```

### Rollback

```bash
NEURAL_MEMORY_ENABLED=false
# OR
NEURAL_MEMORY_ROLLOUT=0
```

## Common Issues

### Issue: nmem not found

**Solution**: Ensure nmem is installed and in PATH
```bash
which nmem
npm install -g nmem
```

### Issue: High memory usage

**Solution**: Reduce cache sizes in `context_cache.ts`

### Issue: Slow semantic recall

**Solution**: Check nmem index size and rebuild if needed

### Issue: Summaries not generating

**Solution**: Verify summarization service is running and check logs

## Contributing

See Phase 1-5 implementation plans:
- `neural-memory-architecture.md`
- `neural-memory-implementation-plan.md`
- `neural-memory-quick-reference.md`

## Support

- **GitHub**: https://github.com/dyad-sh/dyad
- **Discord**: https://discord.gg/dyad
- **Docs**: https://dyad.sh/docs

---

*Neural Memory Developer Guide - Dyad 0.36.0+*
