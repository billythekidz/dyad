# 🧠 NEURAL MEMORY INTEGRATION - Dyad v1.5

## 🎉 AI Memory System Now in Build Mode!

**NeuralMemory** is now integrated into Dyad Build mode - giving your AI agent a REAL BRAIN! 🧠

---

## 🤔 What is NeuralMemory?

**Reflex-based memory system** that works like your brain:
- Stores memories as interconnected neurons
- Recalls through spreading activation (not search!)
- Builds associative connections between concepts
- Applies forgetting curve and memory consolidation
- Tracks temporal relationships

### Why NOT RAG/Vector Search?

| Aspect | RAG/Vector Search | NeuralMemory |
|--------|-------------------|--------------|
| **Model** | Search engine | Human brain |
| **Query** | "Find similar text" | "Recall through association" |
| **Structure** | Flat chunks + embeddings | Neural graph + synapses |
| **Relationships** | None | `CAUSED_BY`, `LEADS_TO`, `DISCUSSED` |
| **Multi-hop** | Multiple queries | Natural graph traversal |
| **Lifecycle** | Static | Decay, reinforcement, consolidation |

**Example:** "Why did Tuesday's outage happen?"
- **RAG**: Returns "JWT caused outage" (missing context)
- **NeuralMemory**: Traces `outage ← CAUSED_BY ← JWT ← SUGGESTED_BY ← Alice` → full chain!

---

## 📦 Installation

### Step 1: Install neural-memory

```bash
pip install neural-memory
```

With optional features:
```bash
pip install neural-memory[server]   # FastAPI server + dashboard
pip install neural-memory[nlp-vi]   # Vietnamese NLP
pip install neural-memory[all]      # All features
```

### Step 2: Initialize

```bash
nmem init
```

Creates:
- Config file
- Default brain
- Auto-configures MCP for Claude Code & Cursor

### Step 3: Launch Dyad

```bash
D:\GITHUB\dyad\out\dyad-win32-x64\dyad.exe
```

**That's it!** Neural memory is now available in Build mode! 🎉

---

## 🎯 Usage in Dyad Build Mode

### Available through `neural_memory` tool:

Dyad agent can now:
- ✅ Store memories (facts, decisions, insights, todos)
- ✅ Recall memories through neural activation
- ✅ Track project context across sessions
- ✅ Index codebase for code-aware recall
- ✅ Manage multiple brains for different projects
- ✅ Auto-consolidate and decay memories

---

## 📝 Commands (via neural_memory tool)

### Store Memories

```
"Use neural memory to remember: Fixed auth bug in login.py:42"
→ nmem remember "Fixed auth bug in login.py:42"

"Store a decision: We will use PostgreSQL for the database"
→ nmem remember "We will use PostgreSQL" --type decision

"Add a TODO: Review PR #123 with priority 7"
→ nmem todo "Review PR #123" --priority 7
```

### Recall Memories

```
"What do we know about auth bugs?"
→ nmem recall "auth bug"

"Deep search for database decisions"
→ nmem recall "database" --depth 2

"Show last 5 memories"
→ nmem last 5

"What did we work on today?"
→ nmem today
```

### Get Context for AI

```
"Give me recent context for this session"
→ nmem context --limit 10 --json
```

### Codebase Indexing

```
"Index the src/ directory into memory"
→ nmem index src/

"Index components folder"
→ nmem index components/
```

### Brain Management

```
"List all brains"
→ nmem brain list

"Create a new brain for work project"
→ nmem brain create work

"Switch to work brain"
→ nmem brain use work

"Check brain health"
→ nmem brain health

"Export brain backup"
→ nmem brain export -o backup.json

"Import brain from backup"
→ nmem brain import backup.json
```

### Memory Lifecycle

```
"Apply memory decay (forgetting curve)"
→ nmem decay

"Consolidate memories (prune, merge, summarize)"
→ nmem consolidate

"Clean up expired memories"
→ nmem cleanup
```

### Statistics & Visualization

```
"Show brain statistics"
→ nmem stats

"Show rich dashboard"
→ nmem dashboard

"Visualize neural connections for auth"
→ nmem graph "auth"
```

---

## 🔥 Example Workflows

### Workflow 1: Bug Fix Memory

```
User: "I fixed the auth bug by adding null check in login.py line 42. Remember this."

Dyad (neural_memory tool):
→ nmem remember "Fixed auth bug with null check in login.py:42" --type insight

Later...

User: "What was that auth fix we did?"

Dyad (neural_memory tool):
→ nmem recall "auth fix"

Returns:
- Fixed auth bug with null check in login.py:42
- [Related: auth, bug, login.py, null check]
```

### Workflow 2: Decision Tracking

```
User: "We decided to use PostgreSQL instead of MySQL. Store this decision."

Dyad:
→ nmem remember "Use PostgreSQL instead of MySQL for database" --type decision

User: "Also remember that Alice suggested this."

Dyad:
→ nmem remember "Alice suggested PostgreSQL"

Later...

User: "Why did we choose PostgreSQL?"

Dyad:
→ nmem recall "database decision" --depth 2

Returns:
- Use PostgreSQL instead of MySQL
- Alice suggested PostgreSQL
- [Connection: decision ← SUGGESTED_BY ← Alice]
```

### Workflow 3: Codebase Indexing

```
User: "Index all our source code so you can remember it."

Dyad:
→ nmem index src/

User: "Where is the authentication logic?"

Dyad:
→ nmem recall "authentication logic"

Returns:
- [file] src/auth/login.py - Authentication handler
- [file] src/middleware/auth.ts - Auth middleware
- [concept] JWT token validation in auth middleware
```

### Workflow 4: Project Context

```
User: "Start tracking this project: Building Card Games Academy website"

Dyad:
→ nmem project set "Card Games Academy"

User: "Remember: We're using Next.js 15 with App Router"

Dyad:
→ nmem remember "Using Next.js 15 with App Router" --type tech-stack

User: "Also using Tailwind CSS v4 and TypeScript"

Dyad:
→ nmem remember "Tech stack: Tailwind CSS v4, TypeScript"

Later (new session)...

User: "What's the context of this project?"

Dyad:
→ nmem context --limit 10

Returns:
- Project: Card Games Academy
- Using Next.js 15 with App Router
- Tech stack: Tailwind CSS v4, TypeScript
- [Plus 7 more recent memories...]
```

---

## 🧪 Testing Neural Memory

### Test 1: Store First Memory

```bash
nmem remember "Testing neural memory integration in Dyad v1.5"
```

Output:
```
Remembered: Testing neural memory integration in Dyad v...
  [type: insight, priority: normal, expires: 89d]
```

### Test 2: Recall Memory

```bash
nmem recall "Dyad integration"
```

Output:
```
## Relevant Memories

- Testing neural memory integration in Dyad v1.5

## Related Information

- [concept] Dyad integration
- [concept] neural memory
- [concept] Testing

[confidence: 1.00, neurons: 3]
```

### Test 3: View Stats

```bash
nmem stats
```

Output:
```
Brain: default
  Neurons: 1  Synapses: 0  Fibers: 0

  Today: 1 memories
  Last save: 2 minutes ago

  Freshness: 100% (all recent)
```

---

## 🛠️ Advanced Features

### Multiple Brains

Create separate brains for different projects:

```bash
nmem brain create work        # Work memories
nmem brain create personal    # Personal notes
nmem brain create research    # Research findings

nmem brain use work           # Switch to work brain
nmem remember "Important work note"

nmem brain use personal       # Switch to personal
nmem remember "Personal reminder"
```

### Memory Types

Neural memory auto-detects types:
- **insight** - General knowledge, learnings
- **decision** - Project decisions, choices made
- **todo** - Tasks, action items (expires in 30 days)
- **fact** - Factual information
- **error** - Error encounters and solutions

### Priority Levels

```bash
nmem todo "Critical bug fix" --priority 9     # High priority
nmem todo "Nice to have feature" --priority 3  # Low priority
nmem remember "Important decision" --priority 8
```

### Expiration

```bash
nmem todo "Review PR" --expires "7d"          # Expires in 7 days
nmem remember "Temporary note" --expires "1h"  # Expires in 1 hour
```

### Git Hooks

Auto-capture memories from git commits:

```bash
nmem hooks install    # Install git hooks
```

Now every commit automatically stores in memory!

---

## 📊 Build Mode Tools Summary

| # | Tool | Purpose | Added |
|---|------|---------|-------|
| 1 | bash | Shell commands | v1.1 |
| 2 | read_file | Read files | v1.2 |
| 3 | list_files | List directories | v1.2 |
| 4 | grep | Search patterns | v1.2 |
| 5 | run_type_checks | TypeScript checks | v1.2 |
| 6 | web_search | Brave Search API | v1.3 |
| 7 | sqlite_query | SQLite database | v1.3 |
| 8 | **neural_memory** | **AI Memory System** | **v1.5** ✨ |

**8 powerful tools - ALL FREE!** 🎉

---

## 🔧 Technical Details

### How It Works:

1. **Dyad agent** uses `neural_memory` tool
2. **Tool executes** `nmem` CLI commands
3. **nmem** stores/recalls from neural graph database
4. **Results** returned to agent as context

### Storage:

- **Location:** `~/.neural-memory/` (default)
- **Format:** Neural graph database
- **Brain files:** JSON format (exportable)

### Performance:

- **Recall speed:** < 100ms for most queries
- **Memory limit:** Unlimited (auto-consolidation)
- **Concurrent access:** Thread-safe

---

## 🎯 Next Steps

1. ✅ **Install neural-memory:** `pip install neural-memory`
2. ✅ **Initialize:** `nmem init`
3. ✅ **Launch Dyad:** Already built with neural memory!
4. ✅ **Test in Build mode:**
   - "Remember: This is a test memory"
   - "What do we remember about tests?"
5. ✅ **Start building your AI's brain!**

---

## 📚 Resources

- **GitHub:** https://github.com/nhadaututtheky/neural-memory
- **PyPI:** https://pypi.org/project/neural-memory/
- **Documentation:** In README.md

---

## 🔥 Summary

**Version:** v1.5
**Date:** 2026-02-08
**Feature:** Neural Memory Integration
**Cost:** FREE
**Requirement:** Python + neural-memory package

**Dyad now has a real AI brain with persistent memory across sessions!** 🧠🚀

---

**Executable:**
```
D:\GITHUB\dyad\out\dyad-win32-x64\dyad.exe
```

**Test it now!** 🎉
