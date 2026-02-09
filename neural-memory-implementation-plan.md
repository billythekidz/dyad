# Neural Memory Implementation Plan

**Project:** Dyad - Neural Memory-First Architecture
**Timeline:** 5 weeks
**Status:** Planning
**Owner:** Engineering Team

---

## Quick Links

- [Architecture Document](./neural-memory-architecture.md)
- [Current Progress](#current-progress)
- [Weekly Breakdown](#weekly-breakdown)
- [Critical Path](#critical-path)

---

## Current Progress

| Phase | Status | Completion | ETA |
|-------|--------|------------|-----|
| **Phase 1: Foundation** | ⏳ Not Started | 0% | Week 1 |
| **Phase 2: Active Window** | ⏳ Not Started | 0% | Week 2 |
| **Phase 3: Semantic Retrieval** | ⏳ Not Started | 0% | Week 3 |
| **Phase 4: Summarization** | ⏳ Not Started | 0% | Week 4 |
| **Phase 5: Optimization** | ⏳ Not Started | 0% | Week 5 |

---

## Phase 1: Foundation (Week 1)

### Goal
Set up infrastructure without changing existing behavior. All changes are additive and backward-compatible.

### Tasks

#### 1.1 Database Schema
- [ ] Create migration file `src/db/migrations/001_neural_memory.sql`
- [ ] Add new columns to `messages` table
  - `memory_tier` (active/session/archived)
  - `nmem_synced` (boolean)
  - `nmem_synced_at` (timestamp)
  - `estimated_tokens` (integer)
  - `summary_id` (foreign key)
- [ ] Create `conversation_summaries` table
- [ ] Create `chat_memory_config` table
- [ ] Create indexes for performance
- [ ] Test migration on dev database
- [ ] **Verify:** Run migration, check schema with `sqlite3 dyad.db .schema`

#### 1.2 nmem Service Layer
- [ ] Create `src/lib/nmem_service.ts`
  - `saveMessage(chatId, message)` - Save to nmem
  - `recall(chatId, query, depth)` - Semantic search
  - `getContext(chatId, limit)` - Get recent context
  - `getToday(chatId)` - Get today's work
  - `consolidate()` - Run consolidation
  - `batchSave(messages)` - Batch operation
- [ ] Add error handling for nmem failures
- [ ] Add retry logic (3 attempts with exponential backoff)
- [ ] Add logging for all nmem operations
- [ ] **Verify:** Unit tests pass, mock nmem CLI

#### 1.3 Background Sync Service
- [ ] Create `src/services/background_sync.ts`
- [ ] Implement queue for nmem operations
  - In-memory queue with SQLite persistence
  - Flush every 5 seconds OR when 10 items queued
  - Retry failed operations
- [ ] Add `nmem_sync_queue` table for persistence
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
- [ ] Hook into app lifecycle (flush on shutdown)
- [ ] **Verify:** Messages queue and sync in background

#### 1.4 Token Estimation Caching
- [ ] Modify `src/lib/token_counter.ts`
- [ ] Cache token estimates in `messages.estimated_tokens`
- [ ] Add function `cacheTokenEstimates(chatId)`
- [ ] **Verify:** Estimates cached, retrieval is fast

#### 1.5 Testing
- [ ] Write unit tests for `nmem_service.ts`
  - Test save, recall, error handling
  - Mock nmem CLI responses
- [ ] Write unit tests for `background_sync.ts`
  - Test queue, flush, retry logic
- [ ] Integration test: Save message → Verify in nmem
- [ ] **Verify:** 100% test coverage for new code

#### 1.6 Documentation
- [ ] Add JSDoc comments to all new functions
- [ ] Create `docs/neural-memory-api.md` (API reference)
- [ ] Update `README.md` with neural memory info
- [ ] **Verify:** Documentation is clear and complete

### Acceptance Criteria
- ✅ Database migration runs successfully
- ✅ nmem service can save and recall messages
- ✅ Background sync queues messages without blocking
- ✅ All unit tests pass
- ✅ No changes to existing chat behavior (yet)

---

## Phase 2: Active Window (Week 2)

### Goal
Implement sliding window for active messages. Reduce tokens sent to Claude by 60-70%.

### Tasks

#### 2.1 Memory Tier Assignment
- [ ] Create `src/lib/memory_tier_manager.ts`
- [ ] Implement `updateMemoryTiers(chatId)` function
  - Last 30 messages → `active`
  - Messages 31-200 → `session`
  - Messages 201+ → `archived`
- [ ] Add trigger: Update tiers after each new message
- [ ] **Verify:** Tiers update correctly as conversation grows

#### 2.2 Active Window Retrieval
- [ ] Create `src/lib/context_assembly.ts`
- [ ] Implement `getActiveWindow(chatId)` function
  ```typescript
  async function getActiveWindow(chatId: number): Promise<ModelMessage[]> {
    return db.select()
      .from(messages)
      .where(and(
        eq(messages.chatId, chatId),
        eq(messages.memoryTier, 'active')
      ))
      .orderBy(asc(messages.createdAt));
  }
  ```
- [ ] **Verify:** Only active messages returned

#### 2.3 Dynamic Window Sizing
- [ ] Implement `calculateOptimalWindowSize(chatId)` function
  - Get average tokens per message
  - Calculate: `min(50, floor(40000 / avgTokens))`
  - Update `chat_memory_config.active_window_size`
- [ ] Run calculation after every 10 messages
- [ ] **Verify:** Window size adjusts based on message length

#### 2.4 Chat Handler Integration
- [ ] Modify `src/ipc/handlers/chat_stream_handlers.ts`
- [ ] Add feature flag check
  ```typescript
  const useNeuralMemory = settings.features?.neuralMemory?.enabled ?? false;

  if (useNeuralMemory) {
    conversationMessages = await contextAssembly.getActiveWindow(chatId);
  } else {
    // Old behavior: load all messages
    conversationMessages = await db.select()...
  }
  ```
- [ ] Keep old code path for fallback
- [ ] **Verify:** Feature flag controls behavior

#### 2.5 Token Usage Tracking
- [ ] Add telemetry for token usage
  ```typescript
  sendTelemetryEvent('context_assembled', {
    chatId,
    totalMessages: conversationMessages.length,
    estimatedTokens: totalTokens,
    memoryMode: useNeuralMemory ? 'neural' : 'legacy'
  });
  ```
- [ ] Create dashboard view for token metrics
- [ ] **Verify:** Can see token reduction in telemetry

#### 2.6 Migration for Existing Chats
- [ ] Create `src/lib/migrate_chat_to_neural.ts`
- [ ] Implement migration function (see architecture doc)
- [ ] Add migration trigger:
  - On app launch: Migrate 1 chat in background
  - On chat open: If not migrated, migrate immediately
- [ ] Add `migrated_to_neural` flag to `chats` table
- [ ] **Verify:** Existing chats migrate without data loss

#### 2.7 Testing
- [ ] Test with 50-message conversation (should use active window)
- [ ] Test with 200-message conversation (should tier messages)
- [ ] Test token reduction (target: 60-70% reduction)
- [ ] A/B test: Legacy vs Neural mode
- [ ] **Verify:** Token usage significantly reduced

### Acceptance Criteria
- ✅ Active window loads only recent messages
- ✅ Memory tiers assigned correctly
- ✅ Token usage reduced by 60%+
- ✅ Feature flag controls new behavior
- ✅ Old conversations migrate smoothly

---

## Phase 3: Semantic Retrieval (Week 3)

### Goal
Add intelligent context retrieval. When user references past work, automatically recall relevant context from nmem.

### Tasks

#### 3.1 Context Need Detection
- [ ] Create `src/lib/context_detector.ts`
- [ ] Implement `detectContextNeed(userMessage)` function
  - Regex patterns for triggers (see architecture doc)
  - Keyword extraction
  - Return: `{ needsContext: boolean, keywords: string[] }`
- [ ] **Verify:** Correctly detects when context is needed

#### 3.2 Semantic Recall
- [ ] Create `src/lib/semantic_recall.ts`
- [ ] Implement `recallContext(chatId, keywords, limit)` function
  - Build nmem query
  - Execute `nmem recall "chatId:{chatId} {keywords}" --depth {limit}`
  - Parse nmem output
  - Convert to `ModelMessage[]`
- [ ] Add caching layer (see architecture doc)
  - Cache results for 5 minutes
  - LRU eviction when cache full
- [ ] **Verify:** Recalls relevant messages from nmem

#### 3.3 Context Merging
- [ ] Implement `mergeContexts(activeWindow, recalled)` function
  - Deduplicate messages (by messageId)
  - Sort by timestamp
  - Inject recalled context with marker:
    ```
    RECALLED CONTEXT (from earlier in conversation):
    [recalled messages]

    RECENT CONTEXT:
    [active window]
    ```
  - Ensure total tokens < budget
- [ ] **Verify:** Merged context is coherent

#### 3.4 Integration with Chat Handler
- [ ] Modify `chat_stream_handlers.ts`
  ```typescript
  // Detect context need
  const { needsContext, keywords } = contextDetector.detect(userMessage);

  // Get active window
  let context = await contextAssembly.getActiveWindow(chatId);

  // If context needed, recall and merge
  if (needsContext && keywords.length > 0) {
    const recalled = await semanticRecall.recall(chatId, keywords, 5);
    context = mergeContexts(context, recalled);
  }

  // Send to Claude
  await streamText({ messages: context, ... });
  ```
- [ ] **Verify:** Recalled context injected correctly

#### 3.5 Heuristics Tuning
- [ ] Create `config/context_retrieval.json`
  ```json
  {
    "triggers": [
      { "pattern": "remember when", "confidence": 0.9 },
      { "pattern": "like we did", "confidence": 0.8 },
      { "pattern": "yesterday", "confidence": 0.7 }
    ],
    "maxRecalledMessages": 5,
    "recallDepth": 3,
    "cacheEnabled": true,
    "cacheTTL": 300
  }
  ```
- [ ] Make heuristics configurable
- [ ] A/B test different settings
- [ ] **Verify:** Optimal recall settings found

#### 3.6 Testing
- [ ] Test explicit references: "Like we did with auth"
- [ ] Test temporal references: "Yesterday we discussed..."
- [ ] Test topic switches: "Now let's work on payments" (should recall payment context)
- [ ] Test accuracy: Does recalled context match user intent?
- [ ] **Verify:** Context recall accuracy >90%

#### 3.7 UI Indicators
- [ ] Add UI indicator when context is recalled
  - Icon in chat message: 🧠 "Context recalled from earlier"
  - Show which messages were retrieved
- [ ] Add debug panel showing:
  - Active window size
  - Recalled messages count
  - Total tokens used
- [ ] **Verify:** User can see when context is recalled

### Acceptance Criteria
- ✅ Context need detection works reliably
- ✅ Semantic recall retrieves relevant messages
- ✅ Merged context is coherent and useful
- ✅ User can reference past work seamlessly
- ✅ Context recall accuracy >90%

---

## Phase 4: Summarization (Week 4)

### Goal
Automatic conversation summarization every 50 messages. Long-term memory for 500+ message conversations.

### Tasks

#### 4.1 Summarization Service
- [ ] Create `src/services/summarization_service.ts`
- [ ] Implement `summarizeMessageRange(chatId, startId, endId)` function
  - Load messages from DB
  - Call Claude API to generate summary
  - Prompt: "Summarize these messages. Focus on: decisions, features, bugs fixed, key context."
  - Return: `{ summary: string, estimatedTokens: number }`
- [ ] **Verify:** Summary is concise and useful

#### 4.2 Automatic Trigger
- [ ] Add trigger in `chat_stream_handlers.ts`
  ```typescript
  // After saving assistant message
  const config = await getMemoryConfig(chatId);
  const totalMessages = config.totalMessages + 1;

  if (totalMessages % 50 === 0) {
    // Trigger summarization (background job)
    const lastSummarized = config.lastSummarizedMessageId || 0;
    const messagesToSummarize = await getMessageRange(
      chatId,
      lastSummarized + 1,
      totalMessages
    );

    // Run in background
    backgroundJobs.enqueue('summarize', {
      chatId,
      messages: messagesToSummarize
    });
  }
  ```
- [ ] **Verify:** Summarization triggered every 50 messages

#### 4.3 Summary Storage
- [ ] Save summary to `conversation_summaries` table
  ```typescript
  await db.insert(conversationSummaries).values({
    chatId,
    startMessageId: messages[0].id,
    endMessageId: messages[messages.length - 1].id,
    summary: summaryText,
    estimatedTokens: estimateTokens(summaryText),
    nmemSynced: false
  });
  ```
- [ ] Save summary to nmem
  ```bash
  nmem remember "chatId:{chatId} SUMMARY messages {startId}-{endId}: {summary}"
  ```
- [ ] Update `messages.summary_id` for summarized messages
- [ ] **Verify:** Summaries stored in DB and nmem

#### 4.4 Summary Retrieval
- [ ] Modify `getActiveWindow()` to optionally include summaries
  ```typescript
  // If conversation has >100 messages, include summaries
  const summaries = await db.select()
    .from(conversationSummaries)
    .where(eq(conversationSummaries.chatId, chatId))
    .orderBy(desc(conversationSummaries.createdAt))
    .limit(3); // Last 3 summaries

  // Inject summaries before active window
  const context = [
    ...summaries.map(s => ({
      role: 'system',
      content: `SUMMARY (messages ${s.startMessageId}-${s.endMessageId}): ${s.summary}`
    })),
    ...activeWindow
  ];
  ```
- [ ] **Verify:** Summaries provide useful context

#### 4.5 Long Conversation Optimization
- [ ] For conversations >500 messages:
  - Keep only last 50 full messages in SQLite
  - Keep all summaries in SQLite
  - Keep all full messages in nmem (for recall)
- [ ] Add archival process:
  ```typescript
  async function archiveOldMessages(chatId: number) {
    const messages = await db.select()
      .from(messages)
      .where(and(
        eq(messages.chatId, chatId),
        eq(messages.memoryTier, 'archived'),
        isNotNull(messages.summaryId)
      ));

    // Export to disk
    const archivePath = `${appData}/archives/${chatId}.json`;
    await fs.writeFile(archivePath, JSON.stringify(messages));

    // Delete from SQLite (keep in nmem)
    await db.delete(messages)
      .where(eq(messages.id, messages.map(m => m.id)));
  }
  ```
- [ ] **Verify:** 1000+ message conversations remain performant

#### 4.6 UI for Summaries
- [ ] Add summary view in chat UI
  - Collapsible section: "Conversation Summary"
  - Show all summaries in timeline
  - Click to expand full messages (recall from nmem)
- [ ] Add progress indicator: "Summarizing conversation..."
- [ ] **Verify:** User can view summaries

#### 4.7 Testing
- [ ] Test 100-message conversation (2 summaries generated)
- [ ] Test 500-message conversation (10 summaries)
- [ ] Test 1000-message conversation (performance check)
- [ ] Verify summaries are useful for context
- [ ] Verify old messages can be recalled despite archival
- [ ] **Verify:** Long conversations work seamlessly

### Acceptance Criteria
- ✅ Summaries generated every 50 messages
- ✅ Summaries stored in DB and nmem
- ✅ Long conversations (1000+ msgs) remain performant
- ✅ User can view and navigate summaries
- ✅ Context remains accurate despite archival

---

## Phase 5: Optimization & Rollout (Week 5)

### Goal
Performance tuning, caching, telemetry, beta testing, and production rollout.

### Tasks

#### 5.1 Performance Optimization
- [ ] Implement in-memory caching (see architecture doc)
  - `ContextCache` class with LRU eviction
  - Cache active windows (5 min TTL)
  - Cache nmem recall results (5 min TTL)
- [ ] Implement batch nmem operations
  - `NmemBatchQueue` class
  - Batch 10 operations together
  - Flush every 5 seconds
- [ ] Optimize database queries
  - Add covering indexes
  - Preload chat memory config
- [ ] **Verify:** Performance targets met (<100ms retrieval)

#### 5.2 Performance Benchmarks
- [ ] Create benchmark suite `src/__tests__/performance.bench.ts`
  - Active window retrieval: <50ms
  - nmem recall: <200ms
  - Context assembly: <100ms
  - End-to-end message: <2s
- [ ] Run benchmarks on production-like data
  - 10 conversations with 500+ messages each
  - Measure p50, p95, p99 latencies
- [ ] **Verify:** All benchmarks pass

#### 5.3 Telemetry
- [ ] Add comprehensive telemetry events
  ```typescript
  // Context assembly
  telemetry.track('context_assembled', {
    chatId,
    activeWindowSize,
    recalledMessagesCount,
    totalTokens,
    latencyMs
  });

  // Summarization
  telemetry.track('conversation_summarized', {
    chatId,
    messageRange: [startId, endId],
    summaryTokens,
    latencyMs
  });

  // Migration
  telemetry.track('chat_migrated', {
    chatId,
    totalMessages,
    migrationLatencyMs
  });
  ```
- [ ] Create analytics dashboard
  - Token usage over time
  - Context retrieval performance
  - Migration progress
- [ ] **Verify:** All events captured

#### 5.4 Beta Testing
- [ ] Create beta testing group (10 internal users)
- [ ] Prepare beta testing guide:
  - How to enable neural memory
  - What to test
  - How to report issues
- [ ] Enable feature flag for beta users (10%)
- [ ] Collect feedback via survey
- [ ] **Verify:** Beta feedback is positive

#### 5.5 Bug Fixes & Polish
- [ ] Fix bugs reported by beta testers
- [ ] Polish UI for summaries and recall indicators
- [ ] Improve error messages
- [ ] Add help documentation
- [ ] **Verify:** No critical bugs remain

#### 5.6 Gradual Rollout
- [ ] Week 5, Day 1: 10% (beta users)
- [ ] Week 5, Day 2: 25% (early adopters)
- [ ] Week 5, Day 3: 50% (half of users)
- [ ] Week 5, Day 4: 75% (majority)
- [ ] Week 5, Day 5: 100% (general availability)
- [ ] Monitor metrics at each stage
- [ ] Be ready to rollback if issues arise
- [ ] **Verify:** No incidents during rollout

#### 5.7 Documentation
- [ ] Update user documentation:
  - How neural memory works
  - Benefits (unlimited conversations)
  - How to view summaries
- [ ] Update developer documentation:
  - Architecture overview
  - API reference
  - How to debug
- [ ] Create blog post: "Dyad Now Supports Unlimited Conversations"
- [ ] **Verify:** Documentation is complete

#### 5.8 Launch Communication
- [ ] Announce in Discord/Slack
- [ ] Post on Twitter/X
- [ ] Send email to users
- [ ] Update website with feature
- [ ] **Verify:** Users are informed

### Acceptance Criteria
- ✅ Performance targets met
- ✅ Telemetry shows 90%+ token reduction
- ✅ Beta feedback is positive (>80% satisfaction)
- ✅ Gradual rollout completes without incidents
- ✅ Documentation is complete
- ✅ Feature is live for all users

---

## Critical Path

These tasks MUST be completed in order. Any delay blocks subsequent phases.

```
Week 1: Database Migration
  ↓
Week 2: Active Window Implementation
  ↓
Week 3: Semantic Retrieval Integration
  ↓
Week 4: Summarization Service
  ↓
Week 5: Production Rollout
```

**Parallelizable tasks:**
- Testing can happen concurrently with implementation
- Documentation can be written alongside development
- UI work can proceed independently after APIs are defined

---

## Risk Management

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **nmem CLI failures** | Medium | High | Retry logic, fallback to legacy mode |
| **Migration data loss** | Low | Critical | Backup before migration, thorough testing |
| **Performance regression** | Medium | High | Benchmarks, gradual rollout, rollback plan |
| **Context accuracy issues** | Medium | Medium | Extensive testing, tunable heuristics |
| **User confusion** | Low | Medium | Clear documentation, UI indicators |

---

## Success Metrics

| Metric | Baseline | Target | How to Measure |
|--------|----------|--------|----------------|
| **Avg tokens per request** | 120k | <50k | Telemetry |
| **Max conversation length** | 200 msgs | Unlimited | User testing |
| **Context retrieval latency** | N/A | <100ms | Benchmarks |
| **User satisfaction** | N/A | >80% | Survey |
| **Error rate** | <1% | <1% | Telemetry |

---

## Daily Standup Template

**What did I complete yesterday?**
- [ ] Task 1
- [ ] Task 2

**What will I work on today?**
- [ ] Task 3
- [ ] Task 4

**Any blockers?**
- None / Blocker description

**Progress:**
- Phase X: Y% complete

---

## Weekly Review Template

**Week X Review**

**Completed:**
- ✅ Task 1
- ✅ Task 2

**In Progress:**
- 🔄 Task 3 (50%)

**Blocked:**
- ❌ Task 4 (waiting for X)

**Next Week:**
- [ ] Task 5
- [ ] Task 6

**Risks:**
- Risk 1: Mitigation plan

**Metrics:**
- Token usage: 80k avg (-33%)
- Performance: 150ms avg

---

## Rollback Procedure

If critical issues arise during rollout:

1. **Immediate:**
   - Set `neuralMemory.enabled = false` in settings
   - Restart app (or push config update)
   - Verify users can continue with legacy mode

2. **Within 24 hours:**
   - Analyze telemetry to identify root cause
   - Fix bug and deploy patch
   - Test fix in dev/staging

3. **Re-enable:**
   - Gradual re-enable (10% → 25% → 50% → 100%)
   - Monitor metrics closely
   - Communicate with users about fix

**No data loss:** SQLite retains all messages, nmem has full history. Rollback is seamless.

---

## Contact & Escalation

**Project Owner:** [Name]
**Tech Lead:** [Name]
**Escalation:** [Manager Name]

**Questions?** Post in #dyad-neural-memory Slack channel.

---

**Document Status:** Living document, updated weekly
**Last Updated:** 2026-02-08
