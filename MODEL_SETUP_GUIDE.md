# ✅ Dyad Tools - Setup Guide

## 🎯 TL;DR: CỨ XÀI THÔI!

**Không cần setup gì đặc biệt!** Tools đã sẵn sàng.

---

## 🔧 Model Settings

### **Default Model:**
```javascript
selectedModel: {
  name: "auto",
  provider: "auto"
}
```

**"auto" có nghĩa là:**
- Dyad tự động chọn model tốt nhất có sẵn
- Ưu tiên: OpenAI hoặc Anthropic (nếu có API key)
- Fallback: Model khác nếu có

---

## 🚀 Quick Start

### **Option 1: Dùng luôn (Recommended)**
```
1. Mở Dyad
2. Tạo/mở app
3. Chọn Build mode
4. Start chatting!
```

**Dyad sẽ:**
- Tự detect API keys
- Auto-select best model
- Load tools tự động
- Just works!

---

### **Option 2: Setup API Key (Nếu chưa có)**

**Trong Dyad UI:**
```
1. Click Settings (⚙️ icon)
2. Go to "Model Settings"
3. Select provider:
   - OpenAI → Enter API key
   - Anthropic → Enter API key
   - Google → Enter API key
   - Azure/xAI/etc → Enter credentials
4. Save
```

**Supported Providers:**
- ✅ OpenAI (GPT-4, GPT-3.5)
- ✅ Anthropic (Claude)
- ✅ Google (Gemini)
- ✅ Azure OpenAI
- ✅ xAI (Grok)
- ✅ Bedrock
- ✅ OpenRouter
- ✅ Local (Ollama, LM Studio)

---

## 🔑 API Key Priority

Dyad checks in this order:

1. **Anthropic API key** (Claude) - Best for coding
2. **OpenAI API key** (GPT-4) - Great for coding
3. **Google API key** (Gemini) - Good alternative
4. **Other providers** - If configured
5. **Local models** - Ollama/LM Studio

**Pick one and you're good to go!**

---

## 🛠️ Tools Auto-Detection

### **Tools Available:**

**Build Mode (FREE):**
```javascript
✅ bash             // Always works
✅ read_file        // Always works
✅ list_files       // Always works
✅ grep             // Always works
✅ run_type_checks  // Always works
✅ MCP tools        // If MCP servers configured
```

**Tools load automatically when:**
- Model supports function calling (most modern models do)
- AI SDK auto-converts tools to model format
- No manual config needed!

---

## 🎯 Model Requirements for Tools

### **✅ Models that support tools:**
- **OpenAI:** GPT-4, GPT-4-turbo, GPT-3.5-turbo
- **Anthropic:** Claude 3 (Opus, Sonnet, Haiku)
- **Google:** Gemini 1.5 Pro, Gemini 1.5 Flash
- **Azure:** All GPT-4 models
- **xAI:** Grok models

### **❌ Models that might not support tools:**
- Very old GPT-3 models
- Some local models (depends on implementation)

**But Dyad's "auto" setting picks a tool-compatible model!**

---

## 💡 Recommended Setup

### **For Best Experience:**

**1. Use Anthropic Claude (Best for coding):**
```
Settings → Model → Provider: Anthropic
Enter API key: sk-ant-...
Model: Auto (will pick Claude 3.5 Sonnet)
```

**2. Or Use OpenAI GPT-4:**
```
Settings → Model → Provider: OpenAI
Enter API key: sk-...
Model: Auto (will pick GPT-4)
```

**3. Or Use Google Gemini (Free tier available):**
```
Settings → Model → Provider: Google
Enter API key: ...
Model: Auto (will pick Gemini 1.5 Pro)
```

---

## 🆓 Free Options

### **Google Gemini:**
- Free tier: 60 requests/minute
- Good for testing
- Supports all tools

### **Ollama (Local):**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1

# In Dyad Settings:
Provider: Ollama
Model: llama3.1
```

**Note:** Local models may have limited tool support.

---

## 🔍 How to Check Current Model

### **In Dyad:**
```
1. Open Settings
2. Look at "Model Settings"
3. See "Selected Model"
```

### **Or check file:**
```
Windows: C:\Users\<username>\AppData\Roaming\dyad\user-settings.json

Look for:
{
  "selectedModel": {
    "name": "auto",
    "provider": "auto"
  }
}
```

---

## ⚡ Testing Tools

### **Verify tools work:**

**Test 1: Bash tool**
```
"Check git status"
```
→ Should run `git status` command

**Test 2: Read tool**
```
"Read package.json"
```
→ Should read and show file content

**Test 3: List tool**
```
"List all files in src/"
```
→ Should show directory listing

**If these work → All tools work!**

---

## 🚨 Troubleshooting

### **Tools not working?**

**Check 1: Model supports tools**
```
Settings → Model → Make sure not using old GPT-3
Switch to: Claude 3, GPT-4, or Gemini
```

**Check 2: API key valid**
```
Settings → Provider Settings
Re-enter API key if needed
```

**Check 3: Mode is Build**
```
Chat mode dropdown → Select "Build"
(NOT "Ask" mode - that's read-only)
```

**Check 4: Rebuild Dyad**
```bash
cd /d/GITHUB/dyad
npm run build
```

---

## 📋 Summary

### **Do I need to setup model?**
**→ NO! "auto" works out of the box.**

### **Do I need API key?**
**→ YES! At least one provider (OpenAI/Claude/Google)**

### **Do tools work with all models?**
**→ Most modern models (GPT-4, Claude, Gemini): YES**
**→ Old models or some local: MAYBE**

### **Best setup?**
**→ Anthropic Claude API key + Build mode = Perfect!**

---

## 🎯 Recommended First Steps

1. ✅ **Get API key:**
   - Anthropic: https://console.anthropic.com/
   - OpenAI: https://platform.openai.com/
   - Google: https://makersuite.google.com/

2. ✅ **Enter in Dyad Settings**

3. ✅ **Test:**
   ```
   "Check git status"
   "Read package.json"
   "List files in src/"
   ```

4. ✅ **Start building!**

---

**That's it! Cứ xài thôi!** 🚀

No complicated setup needed. Tools just work with modern models.
