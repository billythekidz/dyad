# Neural Memory Architecture - Quick Reference

> **TL;DR:** Move from sending ALL messages to Claude → Send only RECENT + RELEVANT messages

---

## The Problem (Current State)

```
┌─────────────────────────────────────────────┐
│  CONVERSATION WITH 200 MESSAGES             │
│                                             │
│  Message 1                                  │
│  Message 2                                  │
│  ...                                        │
│  Message 198                                │
│  Message 199                                │
│  Message 200                                │
│                                             │
│  ALL SENT TO CLAUDE = ~180k tokens ❌       │
│                                             │
│  Result: HIT TOKEN LIMIT, MUST RESET       │
└─────────────────────────────────────────────┘
```

**Issues:**
- Can only have ~200 messages before hitting limit
- Slow API calls (large context)
- Context lost when forced to reset
- nmem only used for backup, never retrieved

---

## The Solution (New Architecture)

```
┌─────────────────────────────────────────────┐
│  CONVERSATION WITH 500 MESSAGES             │
│                                             │
│  Messages 1-450: ARCHIVED (nmem only)       │
│  └─ Summarized every 50 messages            │
│  └─ Retrieved on-demand if referenced       │
│                                             │
│  Messages 451-500: ACTIVE WINDOW            │
│  └─ Last 50 messages                        │
│  └─ Always sent to Claude                   │
│  └─ ~30k tokens ✅                          │
│                                             │
│  + Relevant recalled context (if needed)    │
│  └─ ~10k tokens ✅                          │
│                                             │
│  TOTAL SENT TO CLAUDE: ~40k tokens          │
│  REDUCTION: 78% fewer tokens! 🎉            │
└─────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Unlimited conversation length
- ✅ 70-90% token reduction
- ✅ Faster API calls
- ✅ No context loss (everything in nmem)
- ✅ Intelligent retrieval

---

## How It Works: Data Flow

### When User Sends a Message

```
1. USER TYPES MESSAGE
   ↓
2. SAVE TO SQLITE (immediate)
   ↓
3. SAVE TO NMEM (async, queued)
   ↓
4. LOAD ACTIVE WINDOW
   └─ Last 30-50 messages from SQLite
   └─ ~20-40k tokens
   ↓
5. DETECT IF CONTEXT NEEDED
   └─ "Remember when we..." → YES
   └─ "Continue auth feature" → YES
   └─ "Just a question" → NO
   ↓
6. IF CONTEXT NEEDED → RECALL FROM NMEM
   └─ nmem recall "chatId:123 auth" --depth 3
   └─ Get 3-5 relevant past messages
   └─ Add to context (~10k more tokens)
   ↓
7. ASSEMBLE FINAL CONTEXT
   └─ System Prompt: 5k tokens
   └─ Active Window: 30k tokens
   └─ Recalled Context: 10k tokens
   └─ TOTAL: 45k tokens (vs 180k before!)
   ↓
8. SEND TO CLAUDE API
   └─ streamText({ messages: finalContext })
   ↓
9. SAVE RESPONSE
   └─ SQLite (immediate)
   └─ nmem (async, queued)
   ↓
10. BACKGROUND: SUMMARIZE IF NEEDED
    └─ Every 50 messages → create summary
    └─ Store in nmem for later recall
```

---

## Memory Tiers

```
┌──────────────────────────────────────────────────────┐
│ TIER 1: ACTIVE WINDOW                                │
│ ┌──────────────────────────────────────────────────┐ │
│ │ • Last 30-50 messages                            │ │
│ │ • Stored: SQLite (fast) + nmem (searchable)      │ │
│ │ • Always sent to Claude                          │ │
│ │ • ~20-40k tokens                                 │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
                     ↓ (ages out)
┌──────────────────────────────────────────────────────┐
│ TIER 2: SESSION MEMORY                               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ • Messages 51-200                                │ │
│ │ • Stored: SQLite + nmem                          │ │
│ │ • Retrieved on-demand (if referenced)            │ │
│ │ • ~50-150k tokens (but NOT sent by default)      │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
                     ↓ (ages out)
┌──────────────────────────────────────────────────────┐
│ TIER 3: LONG-TERM MEMORY                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ • Messages 201+                                  │ │
│ │ • Stored: nmem only (SQLite archived to disk)    │ │
│ │ • Summarized (every 50 messages)                 │ │
│ │ • Retrieved via semantic search                  │ │
│ │ • Unlimited storage                              │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## Example: 500-Message Conversation

### Old Architecture (BROKEN)

```
Messages 1-500: ALL sent to Claude
Total tokens: ~300k
Result: ❌ EXCEEDS 200k LIMIT → CONVERSATION MUST RESET
```

### New Architecture (WORKS)

```
Messages 1-50:   TIER 3 → Summarized → "Set up auth with NextAuth"
Messages 51-100: TIER 3 → Summarized → "Built login UI with React"
Messages 101-150: TIER 3 → Summarized → "Fixed OAuth redirect bug"
Messages 151-200: TIER 3 → Summarized → "Added user dashboard"
Messages 201-250: TIER 3 → Summarized → "Deployed to Vercel"
...
Messages 451-500: TIER 1 → Active window

SENT TO CLAUDE:
- Summaries: 10 summaries × 200 tokens = 2k tokens
- Active window: 50 messages × 600 tokens = 30k tokens
- System prompt: 5k tokens
TOTAL: 37k tokens ✅

User says: "Remember the OAuth bug we fixed?"
→ nmem recall "chatId:123 OAuth bug" --depth 3
→ Retrieve messages 110-115 (the bug fix)
→ Add to context: +3k tokens
TOTAL: 40k tokens ✅ STILL UNDER LIMIT
```

---

## Semantic Recall: How It Works

### Trigger Detection

```typescript
User message: "Continue the auth feature we started yesterday"

↓

Detect keywords: ["continue", "auth", "yesterday"]
Trigger: CONTEXT NEEDED ✅

↓

nmem recall "chatId:123 auth" --since "1 day ago" --depth 5

↓

Retrieved messages:
- Message 87: "I want to add authentication"
- Message 88: "Let's use NextAuth.js for auth"
- Message 89: "Created /api/auth/[...nextauth].ts"
- Message 90: "Configured Google provider"
- Message 91: "Authentication working!"

↓

Inject into context:
"RECALLED CONTEXT (from yesterday):
[Messages 87-91 about authentication]

RECENT CONTEXT:
[Messages 490-500]

NEW MESSAGE:
Continue the auth feature we started yesterday"

↓

Claude has FULL context to continue auth work! ✅
```

---

## Summarization: Example

### Every 50 Messages

```
Messages 1-50:
  - User: "Create a todo app"
  - Assistant: "I'll create a Next.js app..."
  - [48 more messages about building todo app]

↓ SUMMARIZE ↓

Summary:
"Messages 1-50: Created Next.js todo app with:
 - Task CRUD operations
 - SQLite database with Drizzle
 - Tailwind UI
 - Deploy to Vercel
 Key decision: Use server actions instead of API routes"

Tokens: 50 messages × 600 = 30k → Summary = 200 tokens
Reduction: 99.3% ✅

Store:
- SQLite: conversation_summaries table
- nmem: "chatId:123 SUMMARY messages 1-50: [summary]"
```

---

## Database Schema Changes

### New Tables

```sql
-- Track memory configuration per chat
CREATE TABLE chat_memory_config (
  chat_id INTEGER PRIMARY KEY,
  active_window_size INTEGER DEFAULT 30,
  total_messages INTEGER DEFAULT 0,
  last_summarized_message_id INTEGER,
  nmem_project_scope TEXT
);

-- Store summaries
CREATE TABLE conversation_summaries (
  id INTEGER PRIMARY KEY,
  chat_id INTEGER,
  start_message_id INTEGER,
  end_message_id INTEGER,
  summary TEXT,
  estimated_tokens INTEGER
);
```

### New Columns on `messages`

```sql
ALTER TABLE messages ADD COLUMN memory_tier TEXT DEFAULT 'active';
  -- 'active' | 'session' | 'archived'

ALTER TABLE messages ADD COLUMN nmem_synced BOOLEAN DEFAULT 0;
  -- Track if synced to nmem

ALTER TABLE messages ADD COLUMN estimated_tokens INTEGER;
  -- Cache token count
```

---

## Implementation Phases

```
┌─────────────────────────────────────────────────────┐
│ WEEK 1: FOUNDATION                                  │
│ - Database schema                                   │
│ - nmem service wrapper                              │
│ - Background sync queue                             │
│ Result: Infrastructure ready ✅                     │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ WEEK 2: ACTIVE WINDOW                               │
│ - Memory tier assignment                            │
│ - Sliding window logic                              │
│ - Chat handler integration                          │
│ Result: 60-70% token reduction ✅                   │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ WEEK 3: SEMANTIC RETRIEVAL                          │
│ - Context need detection                            │
│ - nmem recall integration                           │
│ - Context merging                                   │
│ Result: Intelligent context retrieval ✅            │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ WEEK 4: SUMMARIZATION                               │
│ - Auto-summarization (every 50 msgs)                │
│ - Long-term memory                                  │
│ - Archive old messages                              │
│ Result: Unlimited conversations ✅                  │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ WEEK 5: OPTIMIZATION & ROLLOUT                      │
│ - Performance tuning                                │
│ - Beta testing                                      │
│ - Gradual rollout (10% → 100%)                      │
│ Result: Production ready ✅                         │
└─────────────────────────────────────────────────────┘
```

---

## Performance Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| **Avg tokens/request** | 120k | 40k | -67% |
| **Max conversation length** | 200 msgs | ∞ | Unlimited |
| **Active window retrieval** | N/A | <50ms | Fast |
| **nmem recall** | N/A | <200ms | Acceptable |
| **End-to-end latency** | 3-5s | 1-2s | -60% |

---

## Trade-offs

### ✅ Benefits

- **Unlimited conversations** - Never hit token limit again
- **Faster API calls** - Smaller context = faster responses
- **Cost savings** - Fewer tokens = lower API costs
- **Better UX** - No forced conversation resets
- **Scalable** - Works for 10 messages or 10,000 messages

### ⚠️ Trade-offs

- **Added complexity** - More moving parts (tiers, recall, summaries)
- **nmem dependency** - Requires nmem CLI to be installed
- **Potential context misses** - Might not recall relevant context (but we have heuristics)
- **Migration needed** - Existing conversations need migration
- **Async operations** - nmem sync happens in background (brief lag)

### 🛡️ Mitigations

- **Complexity:** Well-tested, modular code
- **Dependency:** Graceful fallback if nmem unavailable
- **Context misses:** Tunable heuristics, user can trigger recall manually
- **Migration:** Automatic, transparent to user
- **Async lag:** Queue with retry, <5s max delay

---

## Rollout Strategy

```
Day 1:  10% users  → Monitor metrics
Day 2:  25% users  → Check for issues
Day 3:  50% users  → Confidence building
Day 4:  75% users  → Almost there
Day 5: 100% users  → Full rollout ✅

Rollback plan: Feature flag → Instant disable if issues
```

---

## Success Criteria

**After Week 5:**

- ✅ Users can have 500+ message conversations without errors
- ✅ Average token usage reduced by 60%+
- ✅ Context retrieval works 90%+ of the time
- ✅ No increase in error rate
- ✅ Positive user feedback (>80% satisfaction)
- ✅ Performance targets met
- ✅ 100% of users on new architecture

---

## Quick Commands Reference

### nmem Operations

```bash
# Save a message
nmem remember "chatId:123 user: How do I add auth?"

# Recall context
nmem recall "chatId:123 authentication" --depth 5

# Get recent context
nmem context --limit 30

# Get today's work
nmem today

# Consolidate memories
nmem consolidate
```

### Database Queries

```sql
-- Get active window
SELECT * FROM messages
WHERE chat_id = ? AND memory_tier = 'active'
ORDER BY created_at DESC
LIMIT 30;

-- Get summaries
SELECT * FROM conversation_summaries
WHERE chat_id = ?
ORDER BY start_message_id DESC;

-- Get memory config
SELECT * FROM chat_memory_config
WHERE chat_id = ?;
```

---

## FAQ

**Q: Will I lose my conversation history?**
A: No! Everything is stored in nmem. You can always retrieve old messages.

**Q: What if nmem fails?**
A: Graceful fallback to legacy mode (send all messages like before).

**Q: Can I manually retrieve old context?**
A: Yes! UI will have "Recall context" feature.

**Q: Will this work for existing conversations?**
A: Yes! Automatic migration when you open the conversation.

**Q: How do I know if context is recalled?**
A: UI indicator: 🧠 "Context recalled from earlier"

**Q: Can I disable neural memory?**
A: Yes, feature flag in settings (but why would you? 😊)

---

## Next Steps

1. **Review architecture:** Read full document at `neural-memory-architecture.md`
2. **Approve timeline:** 5 weeks, starting Week 1
3. **Assign team:** Backend, frontend, QA
4. **Set up tracking:** Telemetry for token usage, performance
5. **Begin Week 1:** Database schema implementation

---

**Questions?** See full architecture document for deep dive.

**Ready to build?** See implementation plan for detailed task breakdown.

**Let's eliminate that token limit! 🚀**
