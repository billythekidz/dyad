# 🚀 Quick Reference - Dyad Custom Version

## ✅ Setup Complete!

Your Dyad fork with bash tool is ready:
- ✅ Custom branch: `custom-bash-tool`
- ✅ Tagged version: `custom-bash-v1.0`
- ✅ Upstream remote: `https://github.com/dyad-sh/dyad.git`
- ✅ Backup patch: `dyad-bash-tool.patch`

---

## 📋 Daily Usage

### Start working:
```bash
cd /d/GITHUB/dyad
git checkout custom-bash-tool  # Make sure you're on custom branch
npm run build && npm start
```

---

## 🔄 Update Dyad (Keep your changes)

### Automatic (Recommended):
```bash
cd /d/GITHUB/dyad
./update-dyad.sh
```

### Manual:
```bash
# 1. Fetch latest
git fetch upstream

# 2. Check what's new
git log custom-bash-tool..upstream/main --oneline

# 3. Update main
git checkout main
git merge upstream/main

# 4. Rebase your changes
git checkout custom-bash-tool
git rebase main

# 5. Rebuild
npm install
npm run build
```

---

## 🆘 If Update Breaks

### Rollback to working version:
```bash
git checkout custom-bash-tool
git reset --hard custom-bash-v1.0
npm install && npm run build
```

### Restore from patch (nuclear option):
```bash
# Fresh clone
git clone https://github.com/dyad-sh/dyad.git dyad-fresh
cd dyad-fresh

# Apply your changes
git apply ../dyad/dyad-bash-tool.patch

# Build
npm install && npm run build
```

---

## 🔍 Useful Commands

### Check current version:
```bash
git describe --tags
# Output: custom-bash-v1.0
```

### See your custom changes:
```bash
git diff main..custom-bash-tool
```

### List all versions:
```bash
git tag -l "custom-bash-v*"
```

### Check for updates:
```bash
git fetch upstream
git log custom-bash-tool..upstream/main --oneline
# If empty: No updates available
# If shows commits: Updates available
```

---

## 🎯 Branch Diagram

```
upstream/main (Original Dyad)
    |
    v
main (Your synced copy)
    |
    | (rebase)
    v
custom-bash-tool (Your working branch)
    - bash.ts
    - tool_definitions.ts
    - local_agent_prompt.ts
```

---

## ⚠️ Rules

1. **NEVER commit directly to `main`** - it should mirror upstream
2. **ALWAYS work on `custom-bash-tool`** - your changes live here
3. **TAG every stable version** - easy rollback if needed
4. **TEST after every update** - before tagging new version

---

## 📦 Files Changed (Your custom changes)

```
✅ New:
  - src/pro/main/ipc/handlers/local_agent/tools/bash.ts

✅ Modified:
  - src/pro/main/ipc/handlers/local_agent/tool_definitions.ts
  - src/prompts/local_agent_prompt.ts

✅ Docs:
  - BASH_TOOL_FIX.md
  - MAINTENANCE_STRATEGY.md
  - update-dyad.sh
```

---

## 🎉 You're Protected!

Your changes are now safe and will survive Dyad updates! 🚀
