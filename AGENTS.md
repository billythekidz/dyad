# 🤖 AI AGENT GUIDE - Custom Dyad Workflow

**For: Claude, ChatGPT, Gemini, and other AI agents**

This guide explains how to work with the custom Dyad fork that has Build Mode enhanced with Agent Pro tools.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Repository Structure](#repository-structure)
3. [Custom Features (v1.0 - v1.3)](#custom-features)
4. [Adding New Tools](#adding-new-tools)
5. [Build Workflow](#build-workflow)
6. [Git Workflow](#git-workflow)
7. [Maintenance Strategy](#maintenance-strategy)
8. [Testing](#testing)
9. [Common Tasks](#common-tasks)

---

## 🎯 Overview

### What This Fork Does:

**Problem:** Official Dyad has powerful tools only in Agent mode (paid Pro tier). Build mode (free) was limited to dyad-write/read tags only.

**Solution:** This fork adds all essential Agent Pro tools to Build mode for FREE.

### Tools Added:

| Version | Tools Added | Purpose |
|---------|-------------|---------|
| v1.0 | bash | Shell command execution (Agent mode only) |
| v1.1 | bash | Moved to Build mode (FREE) |
| v1.2 | read_file, list_files, grep, run_type_checks | Agent Pro file operations (FREE) |
| v1.3 | web_search, sqlite_query | Web search + Database (FREE) |

### Key Repositories:

- **Official:** `https://github.com/dyad-sh/dyad.git` (upstream)
- **Fork:** `https://github.com/billythekidz/dyad.git` (your fork)
- **Branch:** `custom-bash-tool` (custom features)
- **Local:** `D:\GITHUB\dyad` (working directory)

---

## 📂 Repository Structure

### Critical Files:

```
D:\GITHUB\dyad/
├── src/
│   ├── ipc/handlers/
│   │   ├── chat_stream_handlers.ts  ← BUILD MODE TOOLS (main file!)
│   │   └── free_agent_quota_handlers.ts
│   └── pro/main/ipc/handlers/
│       └── local_agent/
│           ├── tool_definitions.ts   ← Agent mode tools registry
│           └── tools/
│               └── bash.ts           ← Original bash tool (v1.0)
│
├── out/
│   └── dyad-win32-x64/
│       └── dyad.exe                  ← Built executable
│
├── BUILD_MODE_V1.3.md                ← Latest feature docs
├── BUILD_MODE_V1.2.md
├── BUILD_MODE_BASH.md
├── MODEL_SETUP_GUIDE.md
├── QUICK_REFERENCE.md
├── MAINTENANCE_STRATEGY.md
├── AGENTS.md                         ← This file
└── update-dyad.sh                    ← Update script
```

### Where Tools Are Defined:

**Build Mode Tools (FREE):**
- File: `src/ipc/handlers/chat_stream_handlers.ts`
- Function: `getMcpTools(event: IpcMainInvokeEvent): Promise<ToolSet>`
- Lines: ~1899-2134

**Agent Mode Tools (Pro):**
- File: `src/pro/main/ipc/handlers/local_agent/tool_definitions.ts`
- Array: `TOOL_DEFINITIONS`

---

## 🔧 Custom Features

### v1.3 Tools in Build Mode:

#### 1. bash
```typescript
mcpToolSet["bash"] = {
  description: "Execute bash/shell commands...",
  inputSchema: z.object({
    command: z.string(),
    description: z.string().optional()
  }),
  execute: async (args) => { /* execution logic */ }
}
```

#### 2. read_file
```typescript
mcpToolSet["read_file"] = {
  description: "Read file contents...",
  inputSchema: z.object({
    file_path: z.string()
  }),
  execute: async (args) => { /* read logic */ }
}
```

#### 3. list_files
```typescript
mcpToolSet["list_files"] = {
  description: "List directory files...",
  inputSchema: z.object({
    directory: z.string().optional(),
    recursive: z.boolean().optional()
  }),
  execute: async (args) => { /* list logic */ }
}
```

#### 4. grep
```typescript
mcpToolSet["grep"] = {
  description: "Search patterns in files...",
  inputSchema: z.object({
    pattern: z.string(),
    directory: z.string().optional(),
    file_pattern: z.string().optional()
  }),
  execute: async (args) => { /* grep logic */ }
}
```

#### 5. run_type_checks
```typescript
mcpToolSet["run_type_checks"] = {
  description: "TypeScript type checking...",
  inputSchema: z.object({
    fix: z.boolean().optional()
  }),
  execute: async (args) => { /* tsc logic */ }
}
```

#### 6. web_search (v1.3)
```typescript
mcpToolSet["web_search"] = {
  description: "Brave Search API...",
  inputSchema: z.object({
    query: z.string(),
    count: z.number().optional()
  }),
  execute: async (args) => {
    const BRAVE_API_KEY = 'BSAk6ycQkrPTCb9RkvDP-9fEQVwADNt';
    // Fetch from Brave Search API
  }
}
```

#### 7. sqlite_query (v1.3)
```typescript
mcpToolSet["sqlite_query"] = {
  description: "SQLite database operations...",
  inputSchema: z.object({
    database: z.string(),
    query: z.string(),
    params: z.array(z.any()).optional()
  }),
  execute: async (args) => {
    // better-sqlite3 logic
  }
}
```

---

## ➕ Adding New Tools

### Step 1: Decide Where to Add

**For Build Mode (FREE):**
- File: `src/ipc/handlers/chat_stream_handlers.ts`
- Function: `getMcpTools()`
- Location: Add after line ~2088 (after bash tool)

**For Agent Mode (Pro):**
- Create file: `src/pro/main/ipc/handlers/local_agent/tools/your_tool.ts`
- Register in: `src/pro/main/ipc/handlers/local_agent/tool_definitions.ts`

### Step 2: Tool Template

```typescript
mcpToolSet["your_tool_name"] = {
  description: `What this tool does...

Usage:
- Example 1
- Example 2

Important:
- Note 1
- Note 2`,
  inputSchema: z.object({
    param1: z.string().describe('Parameter description'),
    param2: z.number().optional().describe('Optional parameter'),
  }),
  execute: async (args: any) => {
    const { param1, param2 = defaultValue } = args;

    try {
      logger.log(`[your_tool_name] Executing with ${param1}`);

      // Your tool logic here
      const result = await someOperation(param1, param2);

      logger.log(`[your_tool_name] Success!`);
      return result;
    } catch (error: any) {
      logger.error(`[your_tool_name] Error:`, error.message);
      throw new Error(`Tool failed: ${error.message}`);
    }
  },
};
```

### Step 3: Common Imports Needed

```typescript
import z from 'zod';  // Already imported
import { exec } from 'child_process';  // For shell commands
import { promisify } from 'util';  // For async/await
import { readFile, writeFile } from 'fs/promises';  // File operations
import path from 'path';  // Path operations
```

### Step 4: Security Considerations

- **Block dangerous commands** (rm -rf /, fork bombs, disk overwrite)
- **Set timeouts** (60s for bash, 30s for grep, etc.)
- **Limit output size** (maxBuffer: 10MB)
- **Validate inputs** (use Zod schemas)
- **Log operations** (use logger.log/error)

---

## 🔨 Build Workflow

### Full Build Process:

```bash
# 1. Kill running Dyad
cd /d/GITHUB/dyad
powershell -Command "Get-Process dyad -ErrorAction SilentlyContinue | Stop-Process -Force"

# 2. Build
npm run build

# 3. Launch
./out/dyad-win32-x64/dyad.exe
```

### Quick Rebuild:

```bash
cd /d/GITHUB/dyad && npm run build
```

### Build Output:

- **Location:** `D:\GITHUB\dyad\out\dyad-win32-x64\`
- **Executable:** `dyad.exe`
- **Size:** ~200-300MB
- **Time:** ~2-3 minutes

---

## 🌿 Git Workflow

### Branch Structure:

```
main (official dyad-sh/dyad)
  └── custom-bash-tool (your custom branch)
```

### Commit Workflow:

```bash
# 1. Check status
git status

# 2. Stage files
git add src/ipc/handlers/chat_stream_handlers.ts
git add BUILD_MODE_V1.3.md

# 3. Commit with detailed message
git commit -m "feat: add your_tool to Build mode (vX.X)

- Description of what was added
- Why it was added
- How it works

Files:
- src/ipc/handlers/chat_stream_handlers.ts - Added tool
- BUILD_MODE_VX.X.md - Documentation"

# 4. Tag version
git tag -a custom-bash-vX.X -m "Build mode vX.X: Your feature"

# 5. Push to fork
git push myfork custom-bash-tool --tags
```

### Version Tagging Convention:

- **v1.0** - Initial feature (bash in Agent mode)
- **v1.1** - Bash moved to Build mode
- **v1.2** - Agent Pro tools added
- **v1.3** - Web search + SQLite
- **vX.X** - Your new features

### Remote Setup:

```bash
# List remotes
git remote -v

# Should show:
# myfork   → https://github.com/billythekidz/dyad.git (your fork)
# origin   → https://github.com/dyad-sh/dyad.git (official, read-only)
# upstream → https://github.com/dyad-sh/dyad.git (same as origin)
```

---

## 🔄 Maintenance Strategy

### Updating from Upstream:

When official Dyad releases updates, use this workflow:

```bash
# 1. Fetch latest from official repo
git fetch origin main

# 2. Rebase your changes on top of latest
git checkout custom-bash-tool
git rebase origin/main

# 3. If conflicts, resolve them
# Edit conflicted files
git add <resolved-files>
git rebase --continue

# 4. Force push to your fork (rebase changes history)
git push myfork custom-bash-tool --force

# 5. Rebuild
npm run build
```

### Conflict Resolution:

**Common conflict file:**
- `src/ipc/handlers/chat_stream_handlers.ts`

**How to resolve:**
1. Open the file in editor
2. Find conflict markers: `<<<<<<<`, `=======`, `>>>>>>>`
3. Keep both changes (official + your custom tools)
4. Remove conflict markers
5. Test build: `npm run build`

**Script available:**
- `update-dyad.sh` - Automated update script
- Read `MAINTENANCE_STRATEGY.md` for details

---

## 🧪 Testing

### Test New Tool:

1. **Build Dyad:**
   ```bash
   npm run build
   ```

2. **Launch Dyad:**
   ```bash
   ./out/dyad-win32-x64/dyad.exe
   ```

3. **Create/Open App:**
   - Click "New App" or open existing

4. **Select Build Mode:**
   - Chat mode dropdown → "Build"

5. **Test Tool:**
   ```
   User: "Use your_tool_name to do something"
   Dyad: (should execute your tool)
   ```

### Verify Tool Works:

**Check logs:**
- Dyad console should show: `[your_tool_name] Executing...`
- Should return result to user

**Common issues:**
- Tool not showing? Check `getMcpTools()` function
- Errors? Check `logger.error()` output
- Timeout? Increase timeout value

---

## 🎯 Common Tasks

### Task 1: Add API-Based Tool

**Example: Weather API**

```typescript
mcpToolSet["weather"] = {
  description: "Get weather for a location using OpenWeatherMap API",
  inputSchema: z.object({
    location: z.string().describe('City name (e.g., "London, UK")'),
  }),
  execute: async (args: any) => {
    const { location } = args;
    const API_KEY = 'your-api-key-here';

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${API_KEY}&units=metric`;

      const response = await fetch(url);
      const data = await response.json();

      return `Weather in ${location}:
Temperature: ${data.main.temp}°C
Conditions: ${data.weather[0].description}`;
    } catch (error: any) {
      throw new Error(`Weather API failed: ${error.message}`);
    }
  },
};
```

### Task 2: Add File Operation Tool

**Example: Delete File**

```typescript
mcpToolSet["delete_file"] = {
  description: "Delete a file from the project",
  inputSchema: z.object({
    file_path: z.string().describe('Path to file to delete'),
    confirm: z.boolean().describe('Confirm deletion (must be true)'),
  }),
  execute: async (args: any) => {
    const { file_path, confirm } = args;

    if (!confirm) {
      throw new Error('Deletion not confirmed');
    }

    try {
      const { unlink } = await import('fs/promises');
      await unlink(file_path);

      logger.log(`[delete_file] Deleted: ${file_path}`);
      return `Successfully deleted: ${file_path}`;
    } catch (error: any) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  },
};
```

### Task 3: Add Database Tool (Non-SQLite)

**Example: MongoDB Query**

```typescript
mcpToolSet["mongodb_query"] = {
  description: "Query MongoDB database",
  inputSchema: z.object({
    collection: z.string(),
    query: z.string(),
  }),
  execute: async (args: any) => {
    const { collection, query } = args;

    try {
      const { MongoClient } = await import('mongodb');
      const client = new MongoClient('mongodb://localhost:27017');

      await client.connect();
      const db = client.db('mydb');
      const result = await db.collection(collection).find(JSON.parse(query)).toArray();

      await client.close();

      return JSON.stringify(result, null, 2);
    } catch (error: any) {
      throw new Error(`MongoDB query failed: ${error.message}`);
    }
  },
};
```

### Task 4: Update Existing Tool

1. **Find tool in `chat_stream_handlers.ts`:**
   ```typescript
   mcpToolSet["tool_name"] = { ... }
   ```

2. **Modify logic:**
   ```typescript
   execute: async (args: any) => {
     // Add new feature
     // Update parameters
     // Improve error handling
   }
   ```

3. **Update inputSchema if needed:**
   ```typescript
   inputSchema: z.object({
     existing_param: z.string(),
     new_param: z.boolean().optional(),  // Add new parameter
   })
   ```

4. **Build and test**

### Task 5: Remove Tool

```typescript
// Simply delete or comment out the tool:
// mcpToolSet["unwanted_tool"] = { ... };
```

Then rebuild: `npm run build`

---

## 📚 Documentation Requirements

### When Adding Features:

1. **Update BUILD_MODE_VX.X.md:**
   - Document new tools
   - Add usage examples
   - Include test cases

2. **Update QUICK_REFERENCE.md:**
   - Add tool to the list
   - Add example commands

3. **Create Git Commit:**
   - Descriptive commit message
   - List all modified files
   - Tag with version number

4. **Push to Fork:**
   - `git push myfork custom-bash-tool --tags`

---

## ⚠️ Important Notes

### For AI Agents:

1. **Always read chat_stream_handlers.ts first** before modifying
2. **Check existing tools** to avoid duplicates
3. **Follow security patterns** from existing tools
4. **Test after every change** with `npm run build`
5. **Document everything** - future agents need context
6. **Keep it in Build mode** - goal is FREE features
7. **Don't modify Agent mode** unless explicitly asked

### File Safety:

- **NEVER** delete `getMcpTools()` function
- **NEVER** modify MCP tools section (lines 2094+)
- **ALWAYS** add tools BEFORE MCP tools section
- **ALWAYS** keep tool names unique

### Build Safety:

- **Kill Dyad process** before building (avoids EPERM errors)
- **Check for errors** in build output
- **Test immediately** after build

---

## 🚀 Quick Start for New Agents

### If User Says: "Add [feature] to Dyad"

```bash
# 1. Read the tool definitions file
Read: src/ipc/handlers/chat_stream_handlers.ts (lines 1899-2134)

# 2. Add your tool after bash tool (~line 2088)
Edit: Add new tool definition

# 3. Build
Bash: cd /d/GITHUB/dyad && npm run build

# 4. Document
Write: BUILD_MODE_VX.X.md (increment version)
Edit: QUICK_REFERENCE.md (add tool to list)

# 5. Commit
Bash: git add files && git commit -m "feat: ..."
Bash: git tag -a custom-bash-vX.X -m "..."

# 6. Push
Bash: git push myfork custom-bash-tool --tags
```

### If User Says: "Update from official Dyad"

```bash
# 1. Fetch and rebase
Bash: git fetch origin main
Bash: git rebase origin/main

# 2. Resolve conflicts (if any)
Read: Conflicted files
Edit: Resolve conflicts
Bash: git add . && git rebase --continue

# 3. Rebuild and test
Bash: npm run build
Bash: ./out/dyad-win32-x64/dyad.exe
```

---

## 📞 Support Files

- `BUILD_MODE_V1.3.md` - Latest features (v1.3)
- `MAINTENANCE_STRATEGY.md` - Fork maintenance guide
- `QUICK_REFERENCE.md` - Quick command reference
- `MODEL_SETUP_GUIDE.md` - Model configuration
- `update-dyad.sh` - Automated update script

---

## ✅ Checklist for New Features

- [ ] Tool added to `chat_stream_handlers.ts`
- [ ] Tool follows existing patterns (security, logging, error handling)
- [ ] inputSchema defined with Zod
- [ ] execute function handles errors gracefully
- [ ] Built successfully (`npm run build`)
- [ ] Tested in Dyad UI (Build mode)
- [ ] Documentation created (BUILD_MODE_VX.X.md)
- [ ] Quick reference updated
- [ ] Git committed with clear message
- [ ] Git tagged with version
- [ ] Pushed to fork with tags

---

**This custom Dyad fork gives FREE users the full power of Agent Pro mode!** 🚀

All 7 tools available in Build mode - no subscription needed!

---

**Version:** v1.3
**Last Updated:** 2026-02-08
**Maintained By:** AI Agents (Claude, ChatGPT, Gemini, etc.)
**Fork:** https://github.com/billythekidz/dyad
**Branch:** custom-bash-tool
