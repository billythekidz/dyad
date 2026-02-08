# Dyad Custom Changes - Maintenance Strategy

## 📋 Current Custom Changes

### Changes Made:
1. **New File**: `src/pro/main/ipc/handlers/local_agent/tools/bash.ts`
   - Bash tool for shell command execution

2. **Modified**: `src/pro/main/ipc/handlers/local_agent/tool_definitions.ts`
   - Added bash tool to TOOL_DEFINITIONS array

3. **Modified**: `src/prompts/local_agent_prompt.ts`
   - Updated APP_COMMANDS_BLOCK to allow bash commands

---

## 🎯 Strategy: Custom Branch + Rebase

### Setup (One-time):

```bash
cd /d/GITHUB/dyad

# 1. Create custom branch for your changes
git checkout -b custom-bash-tool

# 2. Commit your changes
git add src/pro/main/ipc/handlers/local_agent/tools/bash.ts
git add src/pro/main/ipc/handlers/local_agent/tool_definitions.ts
git add src/prompts/local_agent_prompt.ts
git commit -m "feat: add bash tool for shell command execution

- Add bash.ts tool with security checks
- Register bash tool in tool_definitions
- Update system prompt to allow bash commands
- Block dangerous commands (rm -rf /, fork bombs, etc.)
"

# 3. Add upstream remote (original Dyad repo)
git remote add upstream https://github.com/dyad-sh/dyad.git

# 4. Tag your custom version
git tag -a custom-bash-v1.0 -m "Dyad with bash tool v1.0"
```

---

## 🔄 Update Workflow (When new Dyad version is released)

### Option A: Rebase (Recommended - Clean history)

```bash
# 1. Fetch latest from upstream
git fetch upstream

# 2. Switch to main and update
git checkout main
git merge upstream/main

# 3. Rebase your custom changes on top of new version
git checkout custom-bash-tool
git rebase main

# 4. Resolve conflicts if any (usually none with isolated changes)
# If conflicts occur, edit files, then:
git add <resolved-files>
git rebase --continue

# 5. Test the updated version
npm install
npm run build
npm start

# 6. Tag new version
git tag -a custom-bash-v1.1 -m "Dyad bash tool rebased on upstream vX.X"
```

### Option B: Merge (Easier - Messy history)

```bash
# 1. Fetch and merge upstream into custom branch
git checkout custom-bash-tool
git fetch upstream
git merge upstream/main

# 2. Resolve conflicts if any
# 3. Test and tag
```

---

## 💾 Backup Strategy: Git Patches

Create patch files for easy re-application:

```bash
# Create patches for all custom changes
git checkout custom-bash-tool
git format-patch main --stdout > dyad-bash-tool.patch

# To re-apply patch on fresh clone:
git clone https://github.com/dyad-sh/dyad.git dyad-fresh
cd dyad-fresh
git apply ../dyad-bash-tool.patch
```

---

## 🍴 Alternative: Fork Repository

If you want full control:

### 1. Fork on GitHub:
- Go to https://github.com/dyad-sh/dyad
- Click "Fork" button
- Creates `https://github.com/YOUR_USERNAME/dyad`

### 2. Update local remote:
```bash
cd /d/GITHUB/dyad

# Remove origin
git remote remove origin

# Add your fork as origin
git remote add origin https://github.com/YOUR_USERNAME/dyad.git

# Add upstream (original repo)
git remote add upstream https://github.com/dyad-sh/dyad.git

# Push your custom branch to your fork
git push origin custom-bash-tool
```

### 3. Update workflow:
```bash
# Get latest from original Dyad
git fetch upstream
git checkout main
git merge upstream/main
git push origin main

# Rebase custom changes
git checkout custom-bash-tool
git rebase main
git push origin custom-bash-tool --force-with-lease
```

---

## 🔍 Conflict Resolution Guide

### Common conflicts when rebasing:

#### 1. `tool_definitions.ts` - New tools added upstream
```typescript
// Your changes (custom-bash-tool branch):
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  ...existingTools,
  bash, // ← Your addition
  ...planTools,
];

// Upstream added new tools:
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  ...existingTools,
  newUpstreamTool1,
  newUpstreamTool2,
  ...planTools,
];

// Resolution - merge both:
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  ...existingTools,
  newUpstreamTool1,
  newUpstreamTool2,
  bash, // ← Keep your tool
  ...planTools,
];
```

#### 2. `local_agent_prompt.ts` - Prompt updates
```typescript
// If APP_COMMANDS_BLOCK changed upstream:
// 1. Accept upstream changes
// 2. Re-apply your bash tool description manually
```

---

## 📦 Quick Reference Commands

### Daily workflow:
```bash
# Work on custom version
git checkout custom-bash-tool

# Build and run
npm run build && npm start
```

### Check for Dyad updates:
```bash
git fetch upstream
git log custom-bash-tool..upstream/main --oneline
# Shows what's new in upstream
```

### Update to latest:
```bash
git checkout main
git merge upstream/main
git checkout custom-bash-tool
git rebase main
npm install && npm run build
```

### Rollback if update breaks:
```bash
git checkout custom-bash-tool
git reset --hard custom-bash-v1.0  # Go back to tagged version
```

---

## 🎯 Recommended Setup

Run this now to protect your changes:

```bash
cd /d/GITHUB/dyad

# Create and commit to custom branch
git checkout -b custom-bash-tool
git add src/pro/main/ipc/handlers/local_agent/tools/bash.ts
git add src/pro/main/ipc/handlers/local_agent/tool_definitions.ts
git add src/prompts/local_agent_prompt.ts
git add BASH_TOOL_FIX.md
git commit -m "feat: add bash tool for shell command execution"

# Add upstream remote
git remote add upstream https://github.com/dyad-sh/dyad.git

# Tag it
git tag -a custom-bash-v1.0 -m "Initial bash tool implementation"

# Always work from this branch
echo "custom-bash-tool" > .git/HEAD
```

Now your changes are safe! ✅
