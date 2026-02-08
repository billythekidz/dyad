# 🚀 Dyad Build Mode v1.5.4 - Auto-Enforcement Update

**Date:** 2026-02-08
**Version:** v1.5.4
**Status:** ✅ Built Successfully

## 🎯 What's New in v1.5.4

### Auto-Enforcement of Neural Memory Usage

Added aggressive enforcement mechanisms to **force** the agent to use neural_memory tool at session start and before reading files.

### Changes Made

#### 1. Enhanced System Prompt with FORBIDDEN ACTIONS
**File:** `src/prompts/system_prompt.ts` (lines 89-100)

Added strong language section that explicitly forbids common violations:
- ❌ FORBIDDEN: Reading files directly without checking memory first
- ❌ FORBIDDEN: Starting work without loading context
- ❌ FORBIDDEN: Answering questions without checking recall first
- ❌ FORBIDDEN: Making decisions without storing them in memory
- ❌ FORBIDDEN: Fixing bugs without recording the fix
- ❌ FORBIDDEN: Ignoring neural_memory tool

#### 2. Auto-Injection of Memory Reminders
**File:** `src/ipc/handlers/chat_stream_handlers.ts` (lines 1252-1280)

Implemented logic to automatically inject critical reminders for the first 2 messages:

```typescript
const userMessageCount = chatMessages.filter(m => m.role === "user").length;
const shouldForceMemory = userMessageCount <= 2;

let memoryEnforcementPrefix = "";
if (shouldForceMemory) {
  memoryEnforcementPrefix = `
🚨 CRITICAL REMINDER: This is ${userMessageCount === 1 ? "the FIRST message" : "an EARLY message"} of the session!
YOU MUST:
1. IMMEDIATELY call neural_memory context --limit 10
2. IMMEDIATELY call neural_memory today
3. THEN proceed with the user's request
DO NOT skip memory loading! DO NOT read files before loading memory!
MEMORY FIRST, THEN WORK!`;
}
```

The prefix gets prepended to the system prompt via `systemPromptOverride` parameter in `simpleStreamText()`.

## 🔧 How It Works

### Session Start Behavior
1. **First message:** Agent receives critical reminder at the TOP of system prompt
2. **Second message:** Agent still receives reminder to reinforce behavior
3. **Message 3+:** Normal system prompt (rules still present but not injected at top)

### Expected Agent Flow
```
User: "Fix the login bug"
  ↓
Agent sees: 🚨 CRITICAL REMINDER at top of prompt
  ↓
Agent calls: neural_memory context --limit 10
Agent calls: neural_memory today
  ↓
Agent checks: neural_memory recall "login bug"
  ↓
Agent reads files if needed
  ↓
Agent fixes bug
  ↓
Agent calls: neural_memory remember "Fixed login bug at file.ts:42 - issue was XYZ"
```

## 📋 Testing Checklist

To verify the auto-enforcement works:

1. ✅ Build successful (done)
2. ⏳ Launch Dyad Build mode
3. ⏳ Send first message asking about code
4. ⏳ Verify agent calls `neural_memory context` BEFORE reading files
5. ⏳ Verify agent calls `neural_memory today`
6. ⏳ Verify agent uses `neural_memory recall` before answering
7. ⏳ Make code change
8. ⏳ Verify agent calls `neural_memory remember` after the change

## 🐛 Known Issues from v1.5.3

**Previous Problem:** Agent was ignoring all neural memory rules and reading files directly.

**Root Cause:**
1. ~~Build mode wasn't exposing tools at all (FIXED in v1.5.3)~~
2. System prompt rules weren't strong enough (ADDRESSED in v1.5.4)

**Solution:**
- v1.5.3: Added `getMcpTools()` call to Build mode
- v1.5.4: Added FORBIDDEN language + auto-injection of reminders

## 🚀 Launch Command

```bash
D:\GITHUB\dyad\out\dyad-win32-x64\dyad.exe
```

## 📊 Version History

- **v1.5.4** - Auto-enforcement with memory reminders injection
- **v1.5.3** - Critical fix: Build mode now exposes tools
- **v1.5.2** - Strict rules with 200+ lines of memory instructions
- **v1.5.1** - System prompt instructions for neural memory
- **v1.5** - Neural memory tool integration + auto-install
- **v1.4** - Removed Basic Agent mode from UI
- **v1.3** - Added web_search (Brave) + sqlite_query
- **v1.2** - Added Agent Pro tools to Build mode
- **v1.1** - Moved bash tool to Build mode
- **v1.0** - Initial bash tool in Agent mode

## 📝 Files Modified

1. `src/prompts/system_prompt.ts` - Added FORBIDDEN ACTIONS section
2. `src/ipc/handlers/chat_stream_handlers.ts` - Auto-injection logic
3. `BUILD_MODE_V1.5.4_AUTO_ENFORCE.md` - This document

## 🎯 Next Steps

If agent STILL ignores rules after this update, consider:
1. Even MORE aggressive prefix injection (inject on EVERY message)
2. Tool execution order enforcement (block file reads until memory is loaded)
3. Pre-flight checks that fail if memory commands aren't called first
4. Wrapper functions that force memory checks before executing file operations

---

**Built and ready for testing!** 🚀
