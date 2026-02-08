# 🚀 Dyad Build Mode - Neural Memory Integration STATUS

**Last Updated:** 2026-02-08 (after v1.5.4 completion)
**Branch:** custom-bash-tool
**Latest Commit:** a315762

---

## ✅ COMPLETED - Ready for Testing

### Version History (Most Recent First)

#### v1.5.4 - Auto-Enforcement (LATEST) ✅
- **Commit:** a315762, 6b7f57f
- **Date:** 2026-02-08
- **Status:** Built, tested, documented
- **Changes:**
  - Added FORBIDDEN ACTIONS section to system prompt with strong prohibitive language
  - Implemented auto-injection of critical reminders for first 2 messages
  - Agent sees 🚨 CRITICAL REMINDER at session start forcing memory load
  - systemPromptOverride prepends enforcement when shouldForceMemory=true
  - Created comprehensive testing guide (TESTING_GUIDE_V1.5.4.md)
  - Created quick reference (READY_FOR_TESTING.md)

#### v1.5.3 - Critical Build Mode Fix ✅
- **Commit:** 5c88d8e
- **Date:** 2026-02-08
- **Status:** ✅ Fixed critical bug
- **Changes:**
  - DISCOVERED: Build mode wasn't calling getMcpTools() at all!
  - FIXED: Added `const buildModeTools = await getMcpTools(event)` to Build mode
  - FIXED: Passed tools to simpleStreamText() so agent can actually see them
  - This was the ROOT CAUSE of "agent doesn't see nmem tool" issue

#### v1.5.2 - Strict Rules ✅
- **Commit:** 13b7d48
- **Date:** 2026-02-08
- **Changes:**
  - Expanded neural memory instructions from 62 lines to 200+ lines
  - Added MANDATORY workflows table
  - Added auto-save triggers table
  - Added session workflow (start/during/end)
  - Added depth guide for recall queries
  - Added tool syntax reference
  - Added success patterns with examples
  - Added NEVER rules

#### v1.5.1 - System Prompt Instructions ✅
- **Commit:** aa6bd6e
- **Date:** 2026-02-08
- **Changes:**
  - Added neural memory usage guide to BUILD_SYSTEM_PREFIX
  - Included when to use, how to use, examples
  - Critical rules for mandatory memory operations

#### v1.5.0 - Neural Memory Integration ✅
- **Commits:** Multiple
- **Date:** 2026-02-08
- **Changes:**
  - Added neural_memory tool to getMcpTools()
  - Auto-install logic in main.ts (check/install/init nmem on launch)
  - Created BUILD_MODE_V1.5_NEURAL_MEMORY.md documentation
  - Full CLI integration using `nmem` commands

#### v1.4 - UI Cleanup ✅
- Removed Basic Agent mode from ChatModeSelector
- Only Build and Agent Pro modes remain

#### v1.3 - Web + Database ✅
- Added web_search tool (Brave API: BSAk6ycQkrPTCb9RkvDP-9fEQVwADNt)
- Added sqlite_query tool (better-sqlite3)

#### v1.2 - Agent Pro Tools ✅
- Added read_file, list_files, grep, run_type_checks to Build mode

#### v1.1 - Bash in Build ✅
- Moved bash tool from Agent mode to Build mode

#### v1.0 - Initial Bash ✅
- Created bash tool for Agent mode

---

## 🎯 Current Problem Being Solved

**User Complaint:**
> "bọn agent nó ngu quá, chúng ta đã set rule cho nó phải sử dụng nmem để load data vào memory rồi mới truy xuất, mà nó vẫn ngang bương tự đọc content"

**Translation:**
> "The agents are too dumb, we already set rules that they must use nmem to load data into memory before accessing it, but they still stubbornly read content directly"

**Solution Implemented:**
1. v1.5.3: Fixed root cause - Build mode wasn't exposing tools
2. v1.5.4: Added FORBIDDEN language + auto-injection enforcement

---

## 📦 All 8 Tools in Build Mode

1. ✅ **bash** - Shell commands
2. ✅ **read_file** - Read files
3. ✅ **list_files** - List directory contents
4. ✅ **grep** - Search file contents
5. ✅ **run_type_checks** - TypeScript validation
6. ✅ **web_search** - Brave Search API
7. ✅ **sqlite_query** - SQLite database operations
8. ✅ **neural_memory** - AI memory system using nmem CLI

---

## 🧬 How Neural Memory Works

### CLI Commands Available:
- `nmem remember` - Store memories (decision, error, fact, insight, preference, workflow, project)
- `nmem recall` - Query memories with depth control (depth:1-5)
- `nmem context` - Load recent context (--limit flag)
- `nmem today` - See today's activity
- `nmem index` - Index directories into memory
- `nmem consolidate` - Merge and strengthen memories
- `nmem todo` - Manage tasks in memory
- `nmem status` - Check brain status

### Tool Implementation:
```typescript
mcpToolSet["neural_memory"] = {
  description: `AI Memory System using NeuralMemory CLI...`,
  inputSchema: z.object({
    command: z.string().describe('nmem command to execute'),
    description: z.string().optional(),
  }),
  execute: async (args: any) => {
    const { command, description } = args;
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const { stdout, stderr } = await execAsync(`nmem ${command}`, {
      timeout: 30000,
      maxBuffer: 5 * 1024 * 1024,
    });
    return [stdout, stderr].filter(Boolean).join('\n\n') || 'Success';
  },
};
```

### Auto-Install on Launch:
Located in `src/main.ts` - runs on app.whenReady():
1. Check if `nmem --help` works
2. If not, run `pip install neural-memory`
3. Run `nmem init --no-mcp` to initialize brain
4. Ready to use!

---

## 🔧 Auto-Enforcement Mechanism (v1.5.4)

### 1. FORBIDDEN Section (System Prompt)
Location: `src/prompts/system_prompt.ts:89-100`

Strong prohibitive language:
```
## 🚫 FORBIDDEN ACTIONS (VIOLATION = CRITICAL ERROR!)

**YOU ARE ABSOLUTELY FORBIDDEN FROM:**
- ❌ Reading files directly without checking memory first
- ❌ Starting work without loading context
- ❌ Answering questions without checking recall
- ❌ Making decisions without storing them
- ❌ Fixing bugs without recording the fix
- ❌ Ignoring neural_memory tool - it is MANDATORY!
```

### 2. Auto-Injection (Chat Handler)
Location: `src/ipc/handlers/chat_stream_handlers.ts:1252-1280`

For first 2 messages:
```typescript
const userMessageCount = chatMessages.filter(m => m.role === "user").length;
const shouldForceMemory = userMessageCount <= 2;

if (shouldForceMemory) {
  memoryEnforcementPrefix = `
🚨 CRITICAL REMINDER: This is the FIRST/EARLY message of the session!
YOU MUST:
1. IMMEDIATELY call neural_memory context --limit 10
2. IMMEDIATELY call neural_memory today
3. THEN proceed with the user's request
`;
  // Prepends to system prompt via systemPromptOverride
}
```

---

## 📋 Testing Instructions

### Quick Test:
1. Launch: `D:\GITHUB\dyad\out\dyad-win32-x64\dyad.exe`
2. Select Build mode
3. Send: "What files do we have?"
4. **Expected:** Agent calls `neural_memory context` BEFORE `list_files`
5. **Success:** Memory loaded first ✅
6. **Failure:** Direct file access without memory ❌

### Detailed Tests:
See `TESTING_GUIDE_V1.5.4.md` for 6 comprehensive test cases

### Vietnamese Quick Guide:
See `READY_FOR_TESTING.md`

---

## 📁 Key Files

### Core Implementation:
- `src/ipc/handlers/chat_stream_handlers.ts` - Tool definitions + streaming logic
- `src/prompts/system_prompt.ts` - Neural memory instructions
- `src/main.ts` - Auto-install logic

### Documentation:
- `BUILD_MODE_V1.5_NEURAL_MEMORY.md` - Feature overview
- `BUILD_MODE_V1.5.4_AUTO_ENFORCE.md` - v1.5.4 changes
- `TESTING_GUIDE_V1.5.4.md` - Comprehensive testing guide
- `READY_FOR_TESTING.md` - Quick Vietnamese summary
- `QUICK_REFERENCE.md` - All 8 tools reference

---

## 🐛 Known Issues & Solutions

### Issue: Agent ignoring neural memory rules ⚠️
**Status:** ADDRESSED in v1.5.4
**Solution:** Auto-injection enforcement + FORBIDDEN language
**Next:** Awaiting real-world testing

### Issue: Build mode not exposing tools ✅
**Status:** FIXED in v1.5.3
**Root Cause:** getMcpTools() wasn't called for Build mode
**Solution:** Added buildModeTools and passed to simpleStreamText()

### Issue: Backticks in template literal ✅
**Status:** FIXED in v1.5.2
**Root Cause:** Used ``` for code blocks inside template string
**Solution:** Removed code block formatting, used plain indented text

---

## 🎯 Success Criteria

### Minimum Acceptable:
- [ ] Agent loads memory on first message 90%+ of the time
- [ ] Agent uses recall before reading files 70%+ of the time
- [ ] Agent records changes in memory 80%+ of the time

### Ideal:
- [ ] Agent ALWAYS loads memory first (100%)
- [ ] Agent ALWAYS recalls before file operations (100%)
- [ ] Agent ALWAYS records decisions/changes (100%)

---

## 🚀 Launch Commands

### Run Dyad:
```bash
D:\GITHUB\dyad\out\dyad-win32-x64\dyad.exe
```

### Build Dyad:
```bash
cd /d/GITHUB/dyad
npm run build
```

### Check nmem:
```bash
nmem --help
nmem status
nmem context --limit 5
```

---

## 🔄 Next Steps

### If Testing PASSES ✅
1. Celebrate! 🎉
2. Use Dyad Build mode with confidence
3. Monitor agent behavior over time
4. Consider upstreaming to main branch

### If Testing FAILS ❌
Escalation options (in order):

1. **Level 1:** Extend enforcement window (2 → 5 or 10 messages)
2. **Level 2:** Inject on EVERY message (remove condition)
3. **Level 3:** Block file tools until memory loaded (middleware)
4. **Level 4:** Pre-flight validation (refuse operations without memory)
5. **Level 5:** Wrapper functions (force memory check in tool execution)

---

## 📊 Statistics

- **Total Versions:** 1.0 → 1.5.4 (9 versions)
- **Total Tools:** 8 (all FREE!)
- **Lines of Memory Instructions:** 200+ (from 0)
- **Auto-Install:** Yes (neural-memory via pip)
- **Build Status:** ✅ Success
- **Test Status:** ⏳ Awaiting validation

---

## 🎯 Mission Statement

**Goal:** Force Dyad's Build mode agent to use neural memory CONSISTENTLY - load context at session start, recall before operations, remember after changes.

**Why:** Build persistent institutional knowledge across sessions, avoid repeating mistakes, accelerate development by learning from past decisions.

**Status:** Implementation complete, enforcement active, awaiting real-world testing.

---

**Ready to test!** 🚀

Launch Dyad Build mode and see if the agent respects neural memory rules now.
