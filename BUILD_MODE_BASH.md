# ✅ BASH TOOL NOW IN BUILD MODE (FREE!)

## 🎉 Update v1.1 - No More Dyad Pro Required!

**Bash tool is now available in FREE Build mode!**

---

## 🔄 What Changed

### Before (v1.0):
- ❌ Bash tool only in Agent mode (Dyad Pro - paid)
- ❌ Build mode had no bash tool
- ❌ Free users couldn't run terminal commands

### After (v1.1):
- ✅ Bash tool in **Build mode** (FREE!)
- ✅ Bash tool in **Build with MCP mode** (FREE!)
- ✅ Bash tool in **Agent mode** (Pro)
- ✅ **Everyone can use bash now!**

---

## 📂 Files Modified

### New Change:
```
src/ipc/handlers/chat_stream_handlers.ts
  └─ getMcpTools() function
     └─ Added bash tool directly
```

**Strategy:**
- Build mode gets tools from `getMcpTools()`
- We added bash tool at the START of that function
- Now bash is available to all modes that use MCP tools

---

## 🎯 How to Use

### 1. Open Dyad
```
D:\GITHUB\dyad\out\dyad-win32-x64\dyad.exe
```

### 2. Create/Open an app

### 3. Select Chat Mode
**Any of these will work:**
- ✅ **Build** (default - FREE)
- ✅ **Build with MCP**
- ✅ **Agent** (Pro)

**All have bash tool now!**

### 4. Test Bash Tool

Try these prompts:

**Test 1: Git Status**
```
Check git status
```

**Test 2: NPM Scripts**
```
What npm scripts are available?
```

**Test 3: Node Version**
```
What version of Node.js am I using?
```

**Test 4: Install Package**
```
Install the lodash package
```

**Test 5: Run Tests**
```
Run npm test
```

---

## 🔐 Security

Same security features as Agent mode:

```typescript
✅ Blocks dangerous commands:
   - rm -rf /
   - Fork bombs
   - Disk overwrite attempts

✅ 60-second timeout per command

✅ 10MB output buffer limit

✅ Commands run in project directory only
```

---

## 📊 Bash Tool Availability

| Chat Mode | Bash Tool | Cost |
|-----------|-----------|------|
| **Build** | ✅ Yes | FREE |
| **Build with MCP** | ✅ Yes | FREE |
| **Agent** | ✅ Yes | Pro |
| **Plan** | ❌ No | Pro |
| **Ask** | ❌ No | FREE |

---

## 🆚 Build vs Agent Mode

### Build Mode (FREE):
```
✅ Bash tool
✅ MCP tools
✅ dyad-write, dyad-read tags
✅ Basic file operations
❌ Advanced tools (grep, code_search, etc)
```

### Agent Mode (PRO):
```
✅ Bash tool
✅ All advanced tools
✅ Code search
✅ Database operations
✅ Web search
✅ Planning tools
```

**For most tasks, Build mode is enough!**

---

## 🔄 Git Status

```bash
cd /d/GITHUB/dyad
git branch
# Output: * custom-bash-tool

git log --oneline -3
# Output:
# c721d15 feat: add bash tool to Build mode (free tier)
# 1fb8953 docs: add maintenance scripts and documentation
# dcdb0f3 feat: add bash tool for shell command execution

git tag
# Output:
# custom-bash-v1.0
# custom-bash-v1.1  ← New version!
```

---

## 🚀 Launch Dyad

### Quick Start:
```bash
cd /d/GITHUB/dyad/out/dyad-win32-x64
start dyad.exe
```

### Or Double-click:
```
D:\GITHUB\dyad\out\dyad-win32-x64\dyad.exe
```

---

## 🧪 Test Plan

1. ✅ Open Dyad
2. ✅ Create/open app
3. ✅ Select **Build mode** (default)
4. ✅ Type: "Check git status"
5. ✅ Bash tool should execute!

**No Dyad Pro subscription needed!** 🎉

---

## 📝 Notes

- **First command:** No consent needed (bash is built-in now)
- **All modes:** Bash available except Plan/Ask
- **Free users:** Full bash access in Build mode
- **Pro users:** Bash + advanced tools in Agent mode

---

## 🎯 Next Steps

Try these in Build mode:

```
1. "Check git status"
2. "Install date-fns package"
3. "Run npm run build"
4. "What TypeScript version am I using?"
5. "Show me the git log"
```

All should work in **FREE Build mode!** 🚀

---

**Version:** custom-bash-v1.1
**Date:** 2026-02-08
**Status:** ✅ Ready to use!
