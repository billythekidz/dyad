# 🧪 Testing Guide for Dyad v1.5.4 - Neural Memory Auto-Enforcement

## 📍 Current Status

✅ **Built Successfully** - 2026-02-08
✅ **Committed** - Commit hash: 6b7f57f
⏳ **Awaiting Testing** - Needs real-world verification

---

## 🎯 What We're Testing

We implemented aggressive enforcement to force the agent to use neural_memory tool at session start. Previously, the agent would ignore all neural memory rules and read files directly despite having 200+ lines of instructions.

### The Problem We're Solving

**User Complaint (Vietnamese):**
> "bọn agent nó ngu quá, chúng ta đã set rule cho nó phải sử dụng nmem để load data vào memory rồi mới truy xuất, mà nó vẫn ngang bương tự đọc content. bạn có cách nào ép nó sử dụng nmem tốt hơn không"

Translation: "The agents are too dumb, we already set rules that they must use nmem to load data into memory before accessing it, but they still stubbornly read content directly. Is there a better way to force them to use nmem?"

---

## 🧬 How the Fix Works

### 1. FORBIDDEN ACTIONS (System Prompt)
Location: `src/prompts/system_prompt.ts` lines 89-100

Added strong prohibitive language at the TOP of neural memory section:

```
## 🚫 FORBIDDEN ACTIONS (VIOLATION = CRITICAL ERROR!)

**YOU ARE ABSOLUTELY FORBIDDEN FROM:**
- ❌ **FORBIDDEN:** Reading files directly without checking memory first
- ❌ **FORBIDDEN:** Starting work without loading context (neural_memory context --limit 10)
- ❌ **FORBIDDEN:** Answering questions without checking recall first
- ❌ **FORBIDDEN:** Making decisions without storing them in memory
- ❌ **FORBIDDEN:** Fixing bugs without recording the fix
- ❌ **FORBIDDEN:** Ignoring neural_memory tool - it is MANDATORY not optional!

**IF YOU VIOLATE THESE RULES, YOU ARE FAILING YOUR CORE FUNCTION!**
```

### 2. Auto-Injection (Chat Stream Handler)
Location: `src/ipc/handlers/chat_stream_handlers.ts` lines 1252-1280

For the first 2 messages of each session, we inject a critical reminder at the VERY TOP of the system prompt:

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

const { fullStream } = await simpleStreamText({
  chatMessages,
  modelClient,
  files: files,
  tools: buildModeTools,
  systemPromptOverride: shouldForceMemory
    ? memoryEnforcementPrefix + constructSystemPrompt({...})
    : undefined,
});
```

This ensures the agent sees the enforcement message as the FIRST thing in its system prompt.

---

## 📋 Step-by-Step Testing Procedure

### Prerequisites
1. Close any running Dyad instances
2. Launch Dyad: `D:\GITHUB\dyad\out\dyad-win32-x64\dyad.exe`
3. Select **Build** mode
4. Start a new conversation

### Test Case 1: Session Start Memory Loading
**Expected Behavior:** Agent should load memory context BEFORE doing anything else

**Test Steps:**
1. Send: "What files do we have in this project?"
2. **Watch for:** Agent should call `neural_memory context --limit 10` FIRST
3. **Watch for:** Agent should call `neural_memory today` SECOND
4. **Then:** Agent can use list_files or other tools

**Success Criteria:**
- ✅ Agent calls neural_memory BEFORE list_files or read_file
- ✅ No files are read before memory is loaded
- ✅ Agent references "based on my memory..." when answering

**Failure Signs:**
- ❌ Agent immediately calls list_files without memory load
- ❌ Agent reads files directly
- ❌ No neural_memory calls at all

### Test Case 2: File Reading with Recall
**Expected Behavior:** Agent should check memory before reading files

**Test Steps:**
1. Send: "Read the chat_stream_handlers.ts file"
2. **Watch for:** Agent should call `neural_memory recall "chat_stream_handlers"` FIRST
3. **Then:** Agent reads the file
4. **After reading:** Agent should call `neural_memory remember` to store insights

**Success Criteria:**
- ✅ Recall check happens before file read
- ✅ Agent mentions "checking my memory for chat_stream_handlers..."
- ✅ After reading, agent stores key insights

**Failure Signs:**
- ❌ Direct file read without recall
- ❌ No memory storage after reading

### Test Case 3: Code Changes with Memory Recording
**Expected Behavior:** Agent should record decisions in memory

**Test Steps:**
1. Send: "Add a console.log to the getMcpTools function"
2. **Watch for:** Agent should recall context about getMcpTools
3. Agent makes the change
4. **Watch for:** Agent should call `neural_memory remember` with the decision

**Success Criteria:**
- ✅ Recall before modification
- ✅ Memory recording with TYPE:decision
- ✅ Clear description of what changed and why

**Failure Signs:**
- ❌ No recall before change
- ❌ No memory recording after change

### Test Case 4: Bug Fixing with Memory
**Expected Behavior:** Agent should record bug fixes with root cause

**Test Steps:**
1. Send: "There's a bug in the build - fix it"
2. **Watch for:** Agent recalls similar errors
3. Agent diagnoses the issue
4. **Watch for:** Agent stores TYPE:error with root cause and fix

**Success Criteria:**
- ✅ Recall of past errors before debugging
- ✅ Memory recording with detailed root cause
- ✅ Fix description includes what was learned

### Test Case 5: Second Message (Still Enforced)
**Expected Behavior:** Second message should still show enforcement

**Test Steps:**
1. After Test Case 1, send a second message: "Show me the system prompt file"
2. **Watch for:** Agent should STILL see enforcement reminder (because userMessageCount=2)
3. Agent should use recall before reading

**Success Criteria:**
- ✅ Enforcement still active on message 2
- ✅ Memory usage is consistent

### Test Case 6: Third Message (Normal Mode)
**Expected Behavior:** By message 3, enforcement is passive (rules still present but not injected)

**Test Steps:**
1. Send a third message: "Update the documentation"
2. Agent should still use memory (due to rules) but without the injected reminder
3. Behavior should be consistent with earlier messages

**Success Criteria:**
- ✅ Memory usage continues even without injection
- ✅ Agent has learned the pattern

---

## 🐛 What to Watch For

### Good Signs ✅
- Agent consistently calls `neural_memory context` at session start
- Agent uses `recall` before reading files
- Agent stores decisions with `remember`
- Agent references "based on my memory..." or "I recall..."
- Memory commands appear in tool call logs

### Bad Signs ❌
- Agent jumps straight to `read_file` without memory check
- No `neural_memory` calls at all
- Agent ignores the tool despite instructions
- Enforcement reminder appears but agent still skips memory

---

## 📊 Expected Tool Call Sequence

### Ideal First Message Flow:
```
User: "Fix the authentication bug"
  ↓
1. neural_memory context --limit 10
2. neural_memory today
3. neural_memory recall "authentication bug"
4. read_file src/auth.ts (if needed)
5. [make fix]
6. neural_memory remember "TYPE:error Fixed auth bug in src/auth.ts:42 - issue was missing null check"
```

### Current (Broken) Flow:
```
User: "Fix the authentication bug"
  ↓
1. read_file src/auth.ts ❌ (skipped memory entirely)
2. [make fix]
3. [no memory recording] ❌
```

---

## 🔧 If Testing Fails

### Escalation Options (In Order of Aggression)

#### Level 1: Extend Enforcement Window
Change `shouldForceMemory = userMessageCount <= 2` to `<= 5` or even `<= 10`

#### Level 2: Inject on EVERY Message
Remove the condition entirely - inject enforcement reminder on ALL messages

#### Level 3: Block File Tools Until Memory Loaded
Modify tool execution logic to return error if `read_file` is called before `neural_memory context`

#### Level 4: Pre-Flight Validation
Add middleware that checks for memory calls and refuses to execute file operations until memory is loaded

#### Level 5: Wrapper Functions
Wrap all file tools with automatic memory checks - force memory load before allowing file access

---

## 📝 Testing Checklist

- [ ] Launch Dyad Build mode
- [ ] Test Case 1: Session start memory loading
- [ ] Test Case 2: File reading with recall
- [ ] Test Case 3: Code changes with recording
- [ ] Test Case 4: Bug fixing with memory
- [ ] Test Case 5: Second message enforcement
- [ ] Test Case 6: Third message normal mode
- [ ] Document results
- [ ] If failed, choose escalation level
- [ ] If succeeded, celebrate! 🎉

---

## 📞 Reporting Results

After testing, note:
1. **Which test cases passed/failed**
2. **Actual tool call sequence observed**
3. **Any error messages or unexpected behavior**
4. **Whether enforcement reminder was visible in agent responses**

---

## 🎯 Success Definition

**Minimum Acceptable:**
- Agent loads memory on first message 90%+ of the time
- Agent uses recall before reading files 70%+ of the time
- Agent records changes in memory 80%+ of the time

**Ideal:**
- Agent ALWAYS loads memory first (100%)
- Agent ALWAYS recalls before file operations (100%)
- Agent ALWAYS records decisions/changes (100%)

---

**Ready for testing!** Launch Dyad and run through the test cases above.
