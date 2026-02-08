# 🔍 How to Find Dyad Logs

## 📁 Log File Location

Dyad uses `electron-log` which automatically saves logs to:

### Windows:
```
C:\Users\<username>\AppData\Roaming\dyad\logs\main.log
```

### Quick Access:
1. Press `Win + R`
2. Type: `%APPDATA%\dyad\logs`
3. Press Enter
4. Open `main.log`

---

## 🔍 What to Look For

When "Save to Memory" fails, look for these log entries:

### Success Pattern:
```
[AutoSave] User triggered save for chat 123
[AutoSave] Running: nmem remember "Project: ..."
[AutoSave] Project context saved
[AutoSave] Saved 5 decisions
[AutoSave] Saved 3 errors
[AutoSave] Project directory indexed
[AutoSave] Memories consolidated
[AutoSave] ✅ Conversation successfully saved to neural memory
[ManualSave] ✅ Success - 45 messages, 15 decisions, 12 errors
```

### Error Pattern:
```
[AutoSave] User triggered save for chat 123
[AutoSave] Running: nmem remember "Project: ..."
[AutoSave] Failed to save project context: <ERROR HERE>
[AutoSave] Error details: { message: "...", code: "...", stderr: "...", stdout: "..." }
[AutoSave] ❌ Failed to save conversation: <ERROR>
[ManualSave] ❌ Failed
```

### Key Error Fields:
- **message**: Main error description
- **code**: Error code (ENOENT = not found, EPERM = permission)
- **stderr**: Error output from nmem command
- **stdout**: Standard output from nmem

---

## 📝 Common Errors & Solutions

### 1. `ENOENT` - nmem not found
```
Error: spawn nmem ENOENT
```

**Solution:**
```bash
# Check if nmem is installed
nmem --help

# If not found, install:
pip install neural-memory

# Initialize:
nmem init --no-mcp

# Verify PATH:
where nmem
```

### 2. `No brain found`
```
stderr: "Error: No brain found. Run 'nmem init' first."
```

**Solution:**
```bash
nmem init --no-mcp
```

### 3. Permission Error
```
code: "EPERM"
```

**Solution:**
- Run Dyad as Administrator
- Check folder permissions

### 4. Python not found
```
'python' is not recognized as an internal or external command
```

**Solution:**
- Install Python 3.8+
- Add to PATH
- Restart Dyad

---

## 🚀 Quick Debug Steps

1. **Find log file:**
   ```
   %APPDATA%\dyad\logs\main.log
   ```

2. **Click "Save to Memory"**

3. **Immediately check log** (sort by time, newest at bottom)

4. **Look for `[AutoSave]` or `[ManualSave]` entries**

5. **Copy error details**

6. **Report back with:**
   - Error message
   - Error code
   - stderr output
   - stdout output

---

## 💡 Enable Verbose Logging

If you need MORE details, you can enable verbose logging:

**Option 1: Environment Variable**
```bash
# Set before launching Dyad
set ELECTRON_LOG_LEVEL=debug
D:\GITHUB\dyad\out\dyad-win32-x64\dyad.exe
```

**Option 2: Check Console**
In Dyad, press `Ctrl+Shift+I` to open DevTools Console and look for errors there.

---

## 📋 Log Analysis Checklist

- [ ] Found log file location
- [ ] Clicked "Save to Memory" button
- [ ] Checked newest entries in log
- [ ] Found `[AutoSave]` or `[ManualSave]` entries
- [ ] Identified error message
- [ ] Noted error code
- [ ] Copied stderr/stdout
- [ ] Ready to report!

---

**Once you have the error details, we can fix it!** 🔧
