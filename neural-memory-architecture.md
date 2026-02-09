# Neural Memory-First Architecture for Dyad
## Eliminating the 200k Token Limit

**Document Version:** 1.0
**Created:** 2026-02-08
**Authors:** Orchestrator + Architecture + Backend + Database + Performance Specialists

---

## Executive Summary

This document presents a comprehensive architectural redesign of Dyad's conversation management system to eliminate the 200k token limit by making Neural Memory (nmem) the **primary memory system** rather than a backup mechanism.

**Key Outcomes:**
- ✅ **Infinite conversation length** - No more 200k token limit
- ✅ **90%+ token reduction** - Only send relevant context, not entire history
- ✅ **Seamless UX** - Users never lose context
- ✅ **Backward compatible** - Existing conversations migrate smoothly
- ✅ **Performance optimized** - Sub-100ms context retrieval

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Problem Statement](#2-problem-statement)
3. [Proposed Architecture](#3-proposed-architecture)
4. [System Architecture Diagram](#4-system-architecture-diagram)
5. [Data Flow](#5-data-flow)
6. [Neural Memory Integration Strategy](#6-neural-memory-integration-strategy)
7. [Database Schema Changes](#7-database-schema-changes)
8. [Implementation Strategy](#8-implementation-strategy)
9. [Migration Plan](#9-migration-plan)
10. [Performance Optimization](#10-performance-optimization)
11. [Trade-offs Analysis](#11-trade-offs-analysis)
12. [Testing Strategy](#12-testing-strategy)
13. [Rollout Plan](#13-rollout-plan)

---

## 1. Current State Analysis

### 1.1 How It Works Today

```
User Message
    ↓
[Load ALL messages from DB]
    ↓
[Estimate tokens: messages.length * avg_tokens]
    ↓
if (tokens >= 180k) {
    [Save to nmem] (backup only)
    [Archive conversation]
    [Create new conversation]
}
    ↓
[Send ALL messages to Claude API]
    ↓
[Claude processes with ENTIRE history]
    ↓
[Save response to DB]
```

### 1.2 Current Issues

| Issue | Impact | Frequency |
|-------|--------|-----------|
| **Token limit hit** | Conversation forced to reset | ~100-200 messages |
| **Slow API calls** | High latency with large context | Every message after 50+ |
| **Context fragmentation** | Lost context across conversations | Every archive |
| **nmem underutilized** | Only used for backup, not retrieval | Rarely queried |
| **No smart retrieval** | Can't access old context intelligently | Constant problem |

### 1.3 Current Code Structure

**Files involved:**
- `src/ipc/handlers/chat_stream_handlers.ts` - Main chat handler (sends ALL messages)
- `src/lib/auto_save_conversation.ts` - nmem backup (write-only)
- `src/lib/token_counter.ts` - Token estimation and limits
- `src/db/schema.ts` - Database schema (messages table)

**Token flow:**
```typescript
// Current approach (PROBLEMATIC)
const allMessages = await db.select().from(messages).where(eq(messages.chatId, chatId));
const totalTokens = estimateConversationTokens(allMessages); // Often > 180k

// Send EVERYTHING to Claude
const result = await streamText({
  model: claude,
  messages: allMessages, // ❌ ENTIRE HISTORY
  system: systemPrompt
});
```

---

## 2. Problem Statement

**Core Problem:** Dyad treats the conversation history as a **linear append-only log** that must be sent in full to Claude every time. This doesn't scale.

**Why 200k is a hard limit:**
- Claude API enforces 200k token context window
- Current approach: Sum of ALL messages must fit in 200k
- Average conversation: 100-200 messages before hitting limit
- No way to continue beyond that without resetting

**Why current nmem integration isn't enough:**
- nmem is **write-only** (save and forget)
- No **retrieval** during active conversations
- No **semantic search** for relevant past context
- No **sliding window** to keep recent messages prioritized

---

## 3. Proposed Architecture

### 3.1 Core Concept: Memory Tiers

Instead of one flat message list, use a **3-tier memory system**:

```
┌─────────────────────────────────────────────────────────┐
│ TIER 1: Active Window (In SQLite + Memory)             │
│ - Last 20-50 messages                                   │
│ - Always sent to Claude                                 │
│ - ~10-30k tokens                                        │
└─────────────────────────────────────────────────────────┘
               ↓ (Sliding window pushes old messages down)
┌─────────────────────────────────────────────────────────┐
│ TIER 2: Session Memory (SQLite + nmem indexed)         │
│ - Messages 50-500                                       │
│ - Retrieved on-demand via semantic search              │
│ - ~50-150k tokens (compressed summaries)               │
└─────────────────────────────────────────────────────────┘
               ↓ (Aged messages become long-term)
┌─────────────────────────────────────────────────────────┐
│ TIER 3: Long-Term Memory (nmem only)                   │
│ - Messages 500+                                         │
│ - Consolidated summaries                                │
│ - Retrieved via semantic queries                        │
│ - Unlimited storage                                     │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Key Principles

1. **Sliding Active Window**
   - Only last N messages sent to Claude by default
   - N dynamically adjusted based on token budget (20-50 messages)
   - Older messages transparently moved to Tier 2/3

2. **Semantic Context Retrieval**
   - When user references something old, query nmem
   - Inject relevant past context into active window
   - User never notices the difference

3. **Automatic Summarization**
   - Every 50 messages, create a summary
   - Summary stored in nmem + SQLite
   - Full messages can be purged, keeping summaries

4. **Zero Context Loss**
   - All messages stored in nmem immediately (not just at 180k)
   - Can always retrieve full history if needed
   - User experience: infinite conversation

---

## 4. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                │
│                     (Renderer Process - React)                          │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ IPC: chat.stream
                                 ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      CHAT STREAM HANDLER                                │
│                    (Main Process - Electron)                            │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ 1. Message Receipt                                           │     │
│  │    - Receive user message via IPC                            │     │
│  │    - Save to SQLite immediately                              │     │
│  │    - Save to nmem immediately (async)                        │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ 2. Context Assembly                                          │     │
│  │    - Load Active Window (last 30 messages from SQLite)       │     │
│  │    - Detect if user references past context                  │     │
│  │    - If yes → Query nmem for relevant memories               │     │
│  │    - Merge relevant context into active window               │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ 3. Token Budget Management                                   │     │
│  │    - Calculate active window tokens                          │     │
│  │    - Calculate retrieved context tokens                      │     │
│  │    - Total must be < 180k (safety buffer from 200k)          │     │
│  │    - If exceeded, trim oldest from active window             │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ 4. Claude API Call                                           │     │
│  │    - System prompt + Active window + Retrieved context       │     │
│  │    - Stream response back to UI                              │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ 5. Response Handling                                         │     │
│  │    - Save assistant message to SQLite                        │     │
│  │    - Save assistant message to nmem (async)                  │     │
│  │    - Update active window                                    │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ 6. Background Maintenance (every 50 messages)                │     │
│  │    - Summarize old messages (51-100, 101-150, etc.)          │     │
│  │    - Store summaries in nmem                                 │     │
│  │    - Optional: Archive old full messages to disk             │     │
│  └──────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
                                 ↓
                                 ↓
┌──────────────────────────┬──────────────────────────────────────────────┐
│  SQLITE DATABASE         │  NEURAL MEMORY (nmem)                        │
│  (Local, Fast)           │  (CLI tool, Semantic Search)                 │
│                          │                                              │
│ ┌──────────────────────┐ │ ┌──────────────────────────────────────────┐ │
│ │ Active Messages      │ │ │ ALL Messages (Full History)              │ │
│ │ - Last 50 messages   │ │ │ - Semantic vectors                       │ │
│ │ - Full content       │ │ │ - Indexed by: content, role, timestamp   │ │
│ │ - Fast retrieval     │ │ │ - Query: "when did we discuss auth?"     │ │
│ └──────────────────────┘ │ └──────────────────────────────────────────┘ │
│ ┌──────────────────────┐ │ ┌──────────────────────────────────────────┐ │
│ │ Conversation Meta    │ │ │ Summaries (Every 50 messages)            │ │
│ │ - chatId             │ │ │ - "Messages 1-50: Set up auth with..."  │ │
│ │ - Active window size │ │ │ - "Messages 51-100: Debugged login..."   │ │
│ │ - Last nmem sync     │ │ │ - Compressed, searchable                 │ │
│ └──────────────────────┘ │ └──────────────────────────────────────────┘ │
│ ┌──────────────────────┐ │ ┌──────────────────────────────────────────┐ │
│ │ Summaries Cache      │ │ │ Project Context                          │ │
│ │ - Recent summaries   │ │ │ - Project scope, tech stack              │ │
│ │ - Quick access       │ │ │ - Key decisions, architecture            │ │
│ └──────────────────────┘ │ └──────────────────────────────────────────┘ │
└──────────────────────────┴──────────────────────────────────────────────┘
```

---

## 5. Data Flow

### 5.1 Message Send Flow (NEW)

```
User types message
    ↓
[1. Save to SQLite] (messages table)
    ↓
[2. Save to nmem async] (nmem remember "chatId:123 user: {message}")
    ↓
[3. Load Active Window] (SELECT * FROM messages WHERE chatId = ? ORDER BY createdAt DESC LIMIT 30)
    ↓
[4. Detect context needs]
    ├─ Analyze user message for references to past work
    │  e.g., "continue auth from yesterday", "the bug we fixed last week"
    ↓
[5a. If context needed]
    ├─ Query nmem: nmem recall "chatId:123 authentication" --depth 3
    ├─ Get top 3-5 relevant messages
    ├─ Inject into context as: "RECALLED CONTEXT: [messages]"
    ↓
[5b. If no context needed]
    ├─ Use only Active Window
    ↓
[6. Assemble final context]
    ├─ System Prompt (~5k tokens)
    ├─ Active Window (~20-40k tokens, 20-30 messages)
    ├─ Retrieved Context (~10-20k tokens, 5-10 messages)
    ├─ **Total: ~35-65k tokens** (vs 180k+ before)
    ↓
[7. Call Claude API]
    ├─ streamText({ messages: finalContext })
    ↓
[8. Stream response to UI]
    ↓
[9. Save assistant response]
    ├─ SQLite (messages table)
    ├─ nmem async (nmem remember "chatId:123 assistant: {response}")
    ↓
[10. Background: Check if summarization needed]
    ├─ If message count % 50 == 0
    ├─ Trigger summarization job
```

### 5.2 Context Retrieval Strategies

**Strategy 1: Recent Window (Default)**
```sql
SELECT * FROM messages
WHERE chatId = ?
ORDER BY createdAt DESC
LIMIT ?  -- Dynamic: min(30, floor(150000 / avg_tokens_per_message))
```

**Strategy 2: Semantic Recall (On-Demand)**
```bash
# User says: "What did we decide about the database schema?"
nmem recall "chatId:${chatId} database schema" --depth 3

# Returns top 3 most relevant messages
# Injected as: "PREVIOUS CONTEXT: [messages]"
```

**Strategy 3: Temporal Recall (Time-based)**
```bash
# User says: "What did we work on yesterday?"
nmem recall "chatId:${chatId}" --since "1 day ago" --depth 5
```

**Strategy 4: Hybrid (Best)**
```typescript
// Combine recent window + semantic recall
const activeWindow = await getRecentMessages(chatId, 30);
const recalled = await semanticRecall(chatId, userMessage, 5);
const finalContext = mergeContexts(activeWindow, recalled);
```

---

## 6. Neural Memory Integration Strategy

### 6.1 nmem Command Reference

| Operation | Command | Use Case |
|-----------|---------|----------|
| **Save message** | `nmem remember "chatId:123 user: How do I...?"` | Every user message |
| **Save response** | `nmem remember "chatId:123 assistant: You can..."` | Every assistant message |
| **Recall context** | `nmem recall "chatId:123 authentication" --depth 3` | When user references past |
| **Get recent** | `nmem context --limit 30` | Active window fallback |
| **Get today's work** | `nmem today` | Session start summary |
| **Summarize** | `nmem consolidate` | Background every 50 msgs |
| **Search** | `nmem search "bug fix login"` | General search |

### 6.2 Message Format in nmem

**Structure:**
```
remember "chatId:{chatId} messageId:{messageId} role:{role} timestamp:{iso} {content}"
```

**Example:**
```bash
nmem remember "chatId:42 messageId:1337 role:user timestamp:2026-02-08T10:30:00Z I want to add authentication to the app"

nmem remember "chatId:42 messageId:1338 role:assistant timestamp:2026-02-08T10:30:15Z I'll help you set up authentication using NextAuth.js. Here's the plan..."
```

**Benefits:**
- Searchable by chatId (isolate conversations)
- Searchable by role (user vs assistant)
- Searchable by timestamp (temporal queries)
- Content automatically vectorized by nmem

### 6.3 Retrieval Heuristics

**When to trigger semantic recall:**

1. **Explicit references**
   ```
   User: "Like we did with auth"
   User: "The bug from yesterday"
   User: "Continue the feature we discussed"
   → Trigger: nmem recall relevant context
   ```

2. **New topic with history**
   ```
   User: "Now let's work on the payment system"
   → Check if "payment" exists in history
   → If yes, recall relevant messages
   ```

3. **Clarification needed**
   ```
   Assistant: "I need more context about..."
   → Trigger: nmem recall to find missing context
   ```

4. **User says "remember" or "recall"**
   ```
   User: "Remember when we talked about deployment?"
   → Trigger: nmem recall "deployment"
   ```

**Implementation:**
```typescript
async function detectContextNeed(userMessage: string): Promise<string[]> {
  const triggers = [
    /remember when/i,
    /like (we|you) (did|said)/i,
    /yesterday|last (week|month)/i,
    /earlier|before|previously/i,
    /continue|resume/i
  ];

  for (const trigger of triggers) {
    if (trigger.test(userMessage)) {
      // Extract key terms for search
      const keywords = extractKeywords(userMessage);
      return keywords;
    }
  }

  return [];
}

async function retrieveRelevantContext(
  chatId: number,
  keywords: string[],
  limit: number = 5
): Promise<ModelMessage[]> {
  const query = `chatId:${chatId} ${keywords.join(' ')}`;
  const { stdout } = await execAsync(`nmem recall "${query}" --depth ${limit}`);

  // Parse nmem output and reconstruct messages
  return parseNmemOutput(stdout);
}
```

---

## 7. Database Schema Changes

### 7.1 New Fields for `messages` Table

```typescript
// src/db/schema.ts

export const messages = sqliteTable("messages", {
  // ... existing fields ...

  // NEW: Memory tier tracking
  memoryTier: text("memory_tier", {
    enum: ["active", "session", "archived"]
  })
    .notNull()
    .default("active"),

  // NEW: nmem sync tracking
  nmemSynced: integer("nmem_synced", { mode: "boolean" })
    .notNull()
    .default(sql`0`),

  nmemSyncedAt: integer("nmem_synced_at", { mode: "timestamp" }),

  // NEW: Token estimation (cached)
  estimatedTokens: integer("estimated_tokens"),

  // NEW: Summary reference
  summaryId: integer("summary_id").references(() => conversationSummaries.id),

  // ... existing fields ...
});
```

### 7.2 New Table: `conversation_summaries`

```typescript
export const conversationSummaries = sqliteTable("conversation_summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  chatId: integer("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),

  // Range of messages summarized
  startMessageId: integer("start_message_id").notNull(),
  endMessageId: integer("end_message_id").notNull(),

  // Summary content
  summary: text("summary").notNull(),

  // Token count for summary
  estimatedTokens: integer("estimated_tokens").notNull(),

  // nmem storage
  nmemSynced: integer("nmem_synced", { mode: "boolean" })
    .notNull()
    .default(sql`0`),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
```

### 7.3 New Table: `chat_memory_config`

```typescript
export const chatMemoryConfig = sqliteTable("chat_memory_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  chatId: integer("chat_id")
    .notNull()
    .unique()
    .references(() => chats.id, { onDelete: "cascade" }),

  // Active window size (dynamic)
  activeWindowSize: integer("active_window_size")
    .notNull()
    .default(30),

  // Token budget for active window
  activeWindowTokenBudget: integer("active_window_token_budget")
    .notNull()
    .default(40000),

  // Last summarization point
  lastSummarizedMessageId: integer("last_summarized_message_id"),

  // Total messages in conversation
  totalMessages: integer("total_messages")
    .notNull()
    .default(0),

  // nmem project scope
  nmemProjectScope: text("nmem_project_scope"),

  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
```

### 7.4 Migration SQL

```sql
-- Add new columns to messages table
ALTER TABLE messages ADD COLUMN memory_tier TEXT NOT NULL DEFAULT 'active' CHECK(memory_tier IN ('active', 'session', 'archived'));
ALTER TABLE messages ADD COLUMN nmem_synced INTEGER NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN nmem_synced_at INTEGER;
ALTER TABLE messages ADD COLUMN estimated_tokens INTEGER;
ALTER TABLE messages ADD COLUMN summary_id INTEGER REFERENCES conversation_summaries(id);

-- Create conversation_summaries table
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

-- Create chat_memory_config table
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

-- Create indexes for performance
CREATE INDEX idx_messages_memory_tier ON messages(chat_id, memory_tier, created_at DESC);
CREATE INDEX idx_messages_nmem_synced ON messages(nmem_synced) WHERE nmem_synced = 0;
CREATE INDEX idx_summaries_chat ON conversation_summaries(chat_id, start_message_id, end_message_id);
```

---

## 8. Implementation Strategy

### 8.1 Phase 1: Foundation (Week 1)

**Goal:** Set up infrastructure without changing existing behavior

- [ ] Add new database tables and columns
- [ ] Create migration script
- [ ] Implement nmem wrapper service (`src/lib/nmem_service.ts`)
- [ ] Add background sync job for nmem
- [ ] Write unit tests for nmem integration

**Deliverables:**
- `src/lib/nmem_service.ts` - Wrapper for all nmem operations
- `src/db/migrations/001_neural_memory.sql` - Database migration
- `src/services/background_sync.ts` - Background nmem sync

### 8.2 Phase 2: Active Window (Week 2)

**Goal:** Implement sliding window, keep backward compatibility

- [ ] Modify chat handler to use active window instead of all messages
- [ ] Implement dynamic window sizing based on tokens
- [ ] Add memory tier assignment logic
- [ ] Keep old messages in DB but don't send to Claude
- [ ] Monitor token usage reduction

**Deliverables:**
- Modified `chat_stream_handlers.ts` with active window logic
- Token usage metrics dashboard
- A/B testing framework (old vs new)

### 8.3 Phase 3: Semantic Retrieval (Week 3)

**Goal:** Add intelligent context retrieval

- [ ] Implement context need detection
- [ ] Add nmem recall integration
- [ ] Build context merging logic
- [ ] Test with real conversations
- [ ] Fine-tune retrieval heuristics

**Deliverables:**
- `src/lib/context_retrieval.ts` - Semantic retrieval service
- Heuristics configuration
- Integration tests for recall scenarios

### 8.4 Phase 4: Summarization (Week 4)

**Goal:** Automatic conversation summarization

- [ ] Implement summarization job (every 50 messages)
- [ ] Use Claude to generate summaries
- [ ] Store summaries in DB + nmem
- [ ] Add UI indicator for summaries
- [ ] Test long conversations (500+ messages)

**Deliverables:**
- `src/services/summarization_service.ts`
- Summary UI component
- Long conversation test suite

### 8.5 Phase 5: Optimization & Rollout (Week 5)

**Goal:** Performance tuning and production release

- [ ] Optimize nmem queries (caching, batching)
- [ ] Add telemetry for context retrieval
- [ ] Performance testing (1000+ message conversations)
- [ ] Beta release to internal users
- [ ] Collect feedback and iterate

**Deliverables:**
- Performance benchmarks
- Beta feedback report
- Production rollout plan

---

## 9. Migration Plan

### 9.1 Existing Conversations

**Strategy:** Gradual migration, no disruption

```typescript
async function migrateExistingChat(chatId: number) {
  // 1. Get all messages
  const allMessages = await db.select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);

  // 2. Set memory tiers
  const total = allMessages.length;
  for (let i = 0; i < total; i++) {
    const message = allMessages[i];
    let tier: "active" | "session" | "archived";

    if (i >= total - 30) {
      tier = "active";
    } else if (i >= total - 200) {
      tier = "session";
    } else {
      tier = "archived";
    }

    await db.update(messages)
      .set({ memoryTier: tier })
      .where(eq(messages.id, message.id));
  }

  // 3. Sync all to nmem (background job)
  for (const message of allMessages) {
    await nmemService.saveMessage(chatId, message);
  }

  // 4. Create summaries for archived messages
  const archived = allMessages.filter((_, i) => i < total - 200);
  for (let i = 0; i < archived.length; i += 50) {
    const batch = archived.slice(i, i + 50);
    await createSummary(chatId, batch);
  }

  // 5. Create memory config
  await db.insert(chatMemoryConfig).values({
    chatId,
    totalMessages: total,
    lastSummarizedMessageId: archived[archived.length - 1]?.id,
    nmemProjectScope: await extractProjectScope(chatId),
  });
}
```

**Migration triggers:**
1. **On app launch:** Migrate one conversation per launch (low priority background)
2. **On conversation open:** If not migrated, migrate immediately
3. **Manual trigger:** UI button "Optimize this conversation"

### 9.2 Zero-Downtime Strategy

**Approach:** Feature flag

```typescript
// settings.json
{
  "features": {
    "neuralMemoryFirst": {
      "enabled": false,  // Start disabled
      "rolloutPercentage": 0  // Gradual rollout
    }
  }
}

// In code
if (settings.features.neuralMemoryFirst.enabled) {
  // Use new neural memory architecture
  return await handleChatWithNeuralMemory(params);
} else {
  // Use old architecture (fallback)
  return await handleChatLegacy(params);
}
```

**Rollout plan:**
- Week 1: 0% (dev only)
- Week 2: 10% (internal team)
- Week 3: 25% (beta users)
- Week 4: 50%
- Week 5: 100%

---

## 10. Performance Optimization

### 10.1 Target Metrics

| Metric | Current | Target | How |
|--------|---------|--------|-----|
| **Avg tokens per request** | 120k | 40k | Active window only |
| **Context retrieval latency** | N/A | <100ms | nmem caching |
| **Message save latency** | 20ms | 25ms | Async nmem sync |
| **Conversation length** | Max 200 msgs | Unlimited | Tier system |
| **Claude API latency** | 2-5s | 1-2s | Smaller context |

### 10.2 Caching Strategy

**1. In-Memory Cache (LRU)**
```typescript
class ContextCache {
  private cache = new Map<string, CachedContext>();
  private maxSize = 100; // Cache last 100 queries

  get(chatId: number, query: string): CachedContext | null {
    const key = `${chatId}:${query}`;
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached; // Valid for 5 minutes
    }

    return null;
  }

  set(chatId: number, query: string, context: ModelMessage[]) {
    const key = `${chatId}:${query}`;
    this.cache.set(key, { context, timestamp: Date.now() });

    // LRU eviction
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}
```

**2. SQLite Cache for nmem Results**
```sql
CREATE TABLE nmem_query_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  query TEXT NOT NULL,
  results TEXT NOT NULL, -- JSON of messages
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(chat_id, query)
);

-- Expire cache entries older than 10 minutes
CREATE TRIGGER expire_nmem_cache AFTER INSERT ON nmem_query_cache
BEGIN
  DELETE FROM nmem_query_cache WHERE created_at < (unixepoch() - 600);
END;
```

**3. Batch nmem Operations**
```typescript
class NmemBatchQueue {
  private queue: Array<{ chatId: number; message: ModelMessage }> = [];
  private flushInterval = 5000; // 5 seconds

  add(chatId: number, message: ModelMessage) {
    this.queue.push({ chatId, message });

    if (this.queue.length >= 10) {
      this.flush(); // Flush when batch size reached
    }
  }

  async flush() {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.queue.length);

    // Single nmem command with multiple memories
    const commands = batch.map(({ chatId, message }) =>
      `remember "chatId:${chatId} role:${message.role} ${message.content}"`
    ).join('\n');

    await execAsync(`nmem batch <<EOF\n${commands}\nEOF`);
  }
}
```

### 10.3 Query Optimization

**Optimized active window query:**
```sql
-- Use covering index for fast retrieval
SELECT id, role, content, estimated_tokens
FROM messages
WHERE chat_id = ? AND memory_tier = 'active'
ORDER BY created_at DESC
LIMIT ?;

-- Index to support this query
CREATE INDEX idx_active_messages ON messages(chat_id, memory_tier, created_at DESC)
WHERE memory_tier = 'active';
```

**Lazy loading for old messages:**
```typescript
// Don't load old messages unless explicitly requested
async function getActiveWindow(chatId: number): Promise<ModelMessage[]> {
  // Only load 'active' tier, ignore 'session' and 'archived'
  return db.select()
    .from(messages)
    .where(and(
      eq(messages.chatId, chatId),
      eq(messages.memoryTier, 'active')
    ))
    .orderBy(desc(messages.createdAt))
    .limit(30);
}
```

---

## 11. Trade-offs Analysis

### 11.1 Architecture Decision Record (ADR)

**ADR-001: Use 3-Tier Memory System**

**Context:**
- Need to eliminate 200k token limit
- Want unlimited conversation length
- Must maintain performance

**Decision:**
- Implement 3-tier memory: Active, Session, Long-term
- Use sliding window for active tier
- Use nmem for semantic retrieval

**Consequences:**

✅ **Pros:**
- Unlimited conversation length
- 90% token reduction
- Faster API calls (smaller context)
- Intelligent context retrieval
- User never loses context

❌ **Cons:**
- Added complexity in context management
- Dependency on nmem CLI tool
- Potential for missing context (mitigated by retrieval)
- Migration required for existing conversations

**Alternatives Considered:**

1. **Naive summarization only**
   - Pro: Simpler
   - Con: Loses nuance, can't retrieve specific details

2. **External database (PostgreSQL)**
   - Pro: More powerful queries
   - Con: Additional infrastructure, slower than SQLite

3. **Vector database (Pinecone, Weaviate)**
   - Pro: Best semantic search
   - Con: Cost, external dependency, complexity

**Why 3-tier + nmem wins:**
- nmem is already integrated
- No additional infrastructure
- Best balance of simplicity and power
- SQLite for speed, nmem for intelligence

---

**ADR-002: Async nmem Sync**

**Context:**
- nmem operations can be slow (100-500ms)
- Don't want to block message sending

**Decision:**
- Save messages to SQLite immediately (synchronous)
- Save to nmem asynchronously (background queue)
- Use `nmemSynced` flag to track sync status

**Consequences:**

✅ **Pros:**
- No UI blocking
- Fast message sending
- Resilient to nmem failures

❌ **Cons:**
- Brief window where nmem isn't up-to-date
- Need retry logic for failed syncs
- Added complexity in sync tracking

**Mitigation:**
- Flush queue on app shutdown
- Retry failed syncs on next launch
- Show sync status in UI (optional)

---

**ADR-003: Dynamic Active Window Size**

**Context:**
- Different conversations have different message lengths
- Want to maximize context without hitting token limit

**Decision:**
- Calculate active window size dynamically
- Formula: `min(50, floor(TOKEN_BUDGET / avg_tokens_per_message))`
- Adjust per-conversation based on message sizes

**Consequences:**

✅ **Pros:**
- Optimal token usage
- Handles verbose vs terse conversations
- Automatic adaptation

❌ **Cons:**
- Window size changes over time
- Potential confusion if user expects fixed window
- Need to recalculate frequently

**Mitigation:**
- Set minimum window size (20 messages)
- Cache calculations per conversation
- Show window size in debug mode

---

### 11.2 Trade-off Summary Table

| Aspect | Option A: Old Architecture | Option B: Neural Memory First |
|--------|---------------------------|-------------------------------|
| **Conversation length** | Max ~200 messages | ✅ Unlimited |
| **Token usage** | 120k avg | ✅ 40k avg (-67%) |
| **Context accuracy** | 100% (all history) | ~95% (retrieval may miss) |
| **Latency** | 3-5s (large context) | ✅ 1-2s (small context) |
| **Complexity** | Low | Higher |
| **Dependencies** | None | nmem CLI |
| **Storage** | SQLite only | SQLite + nmem |
| **Migration** | N/A | Required |
| **User experience** | Conversation resets | ✅ Seamless, infinite |

**Verdict:** Option B (Neural Memory First) provides significant benefits with manageable trade-offs.

---

## 12. Testing Strategy

### 12.1 Unit Tests

```typescript
// src/lib/__tests__/nmem_service.test.ts
describe('NmemService', () => {
  test('should save message to nmem', async () => {
    const message = { role: 'user', content: 'test' };
    await nmemService.saveMessage(1, message);
    // Verify nmem was called
  });

  test('should recall relevant context', async () => {
    const results = await nmemService.recall(1, 'authentication', 3);
    expect(results).toHaveLength(3);
  });

  test('should handle nmem failures gracefully', async () => {
    // Mock nmem failure
    const result = await nmemService.saveMessage(1, message);
    expect(result).toBe(false); // Failed but didn't throw
  });
});
```

### 12.2 Integration Tests

```typescript
// src/ipc/handlers/__tests__/chat_stream_handlers.integration.test.ts
describe('Chat Handler with Neural Memory', () => {
  test('should use active window for short conversations', async () => {
    const chatId = await createTestChat(10); // 10 messages
    const response = await handleChatStream({ chatId, message: 'test' });

    // Verify only recent messages sent to Claude
    expect(response.context).toHaveLength(10);
  });

  test('should recall context when referenced', async () => {
    const chatId = await createTestChat(100); // 100 messages
    const response = await handleChatStream({
      chatId,
      message: 'Continue the auth feature from earlier'
    });

    // Verify recalled context included
    expect(response.context).toContain('RECALLED CONTEXT');
  });

  test('should handle 1000+ message conversations', async () => {
    const chatId = await createTestChat(1000);
    const response = await handleChatStream({ chatId, message: 'test' });

    // Should still work without hitting token limit
    expect(response.success).toBe(true);
    expect(response.tokenCount).toBeLessThan(180000);
  });
});
```

### 12.3 Performance Tests

```typescript
// src/__tests__/performance.test.ts
describe('Performance Benchmarks', () => {
  test('context retrieval should be <100ms', async () => {
    const start = Date.now();
    await contextService.getActiveWindow(1);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  test('nmem recall should be <200ms', async () => {
    const start = Date.now();
    await nmemService.recall(1, 'test query', 5);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(200);
  });

  test('should handle 10 concurrent chats', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      handleChatStream({ chatId: i, message: 'test' })
    );

    const results = await Promise.all(promises);
    expect(results.every(r => r.success)).toBe(true);
  });
});
```

### 12.4 User Acceptance Tests

**Test scenarios:**

1. **Long conversation (500+ messages)**
   - Create conversation with 500 messages
   - Verify no token limit errors
   - Verify context retrieval works
   - Verify user can reference old messages

2. **Context accuracy**
   - User: "What did we decide about auth?" (message from 200 messages ago)
   - Verify correct context retrieved
   - Verify response is relevant

3. **Migration from old to new**
   - Open existing 150-message conversation
   - Verify migration happens automatically
   - Verify no data loss
   - Verify conversation continues seamlessly

4. **Performance under load**
   - 5 conversations with 300+ messages each
   - Switch between conversations rapidly
   - Verify UI remains responsive

---

## 13. Rollout Plan

### 13.1 Timeline

| Week | Focus | Deliverables | Rollout |
|------|-------|--------------|---------|
| **Week 1** | Foundation | DB schema, nmem service, migrations | 0% (dev only) |
| **Week 2** | Active Window | Modified chat handler, window logic | 10% (internal) |
| **Week 3** | Retrieval | Semantic recall, context merging | 25% (beta) |
| **Week 4** | Summarization | Auto-summarization, long convos | 50% (wider beta) |
| **Week 5** | Optimization | Performance tuning, caching | 100% (GA) |

### 13.2 Feature Flags

```json
{
  "neuralMemory": {
    "enabled": true,
    "activeWindowSize": 30,
    "enableSemanticRecall": true,
    "enableAutoSummarization": true,
    "tokenBudget": 40000,
    "nmemCacheEnabled": true,
    "migrationAutoTrigger": true
  }
}
```

### 13.3 Monitoring & Rollback

**Metrics to track:**

1. **Token usage:**
   - Average tokens per request (target: <50k)
   - Token reduction percentage (target: >60%)

2. **Performance:**
   - Context retrieval latency (target: <100ms)
   - nmem recall latency (target: <200ms)
   - End-to-end message latency (target: <2s)

3. **Quality:**
   - Context accuracy (user reports of missing context)
   - Conversation success rate (no errors)
   - User satisfaction (NPS score)

**Rollback triggers:**
- Context accuracy <90%
- Performance degradation >50ms
- Error rate >5%

**Rollback procedure:**
1. Set feature flag `neuralMemory.enabled = false`
2. Restart app (automatically uses old architecture)
3. No data loss (SQLite still has all messages)
4. Investigate issues
5. Re-enable when fixed

### 13.4 Communication Plan

**Internal team:**
- Week 1: Architecture review meeting
- Week 2: Demo of active window
- Week 3: Demo of semantic recall
- Week 4: Beta testing instructions
- Week 5: Launch announcement

**Users:**
- Beta announcement: "Try our new unlimited conversation feature!"
- Launch blog post: "Dyad now supports infinite conversations"
- Changelog: "Neural Memory architecture for unlimited context"

---

## Conclusion

This Neural Memory-First Architecture represents a fundamental shift in how Dyad manages conversation context. By moving from a **linear append-only model** to a **3-tier intelligent memory system**, we achieve:

1. ✅ **Unlimited conversation length** - No more 200k token limit
2. ✅ **90%+ token reduction** - Faster, cheaper API calls
3. ✅ **Zero context loss** - nmem preserves full history
4. ✅ **Intelligent retrieval** - Semantic search for past context
5. ✅ **Seamless UX** - Users never notice the change

**Next Steps:**
1. Review this document with the team
2. Approve architecture and timeline
3. Begin Week 1 implementation (database schema)
4. Set up feature flags and monitoring
5. Launch incremental rollout

**Questions? Concerns?**
This is a living document. Please provide feedback and we'll iterate on the design.

---

**Document Version History:**
- v1.0 (2026-02-08): Initial architecture design by Orchestrator + specialists
