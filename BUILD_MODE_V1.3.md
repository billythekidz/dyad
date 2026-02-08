# 🌐 WEB SEARCH + DATABASE TOOLS IN BUILD MODE! (v1.3)

## 🎉 New Tools Added - FREE!

**Web Search + SQLite Database now in Build mode!**

---

## 🆕 New Tools in v1.3:

### **Web Search (Brave Search API):**
- ✅ **web_search** - Search the web with Brave Search API
  - Real-time web results
  - Up to 20 results per query
  - Titles, URLs, descriptions
  - Latest documentation, trends, news

### **SQLite Database:**
- ✅ **sqlite_query** - Execute SQL on SQLite databases
  - SELECT, INSERT, UPDATE, DELETE
  - Create tables, manage data
  - Prepared statements for safety
  - Auto-creates database files

---

## 📊 Complete Build Mode Tools (v1.3):

| Tool | Description | Status |
|------|-------------|--------|
| **bash** | Shell commands | ✅ FREE |
| **read_file** | Read file contents | ✅ FREE |
| **list_files** | List directory files | ✅ FREE |
| **grep** | Search patterns in files | ✅ FREE |
| **run_type_checks** | TypeScript type checking | ✅ FREE |
| **web_search** | Brave Search API | ✅ FREE (NEW!) |
| **sqlite_query** | SQLite database | ✅ FREE (NEW!) |

**7 powerful tools - ALL FREE!** 🎉

---

## 🎯 Web Search Examples:

### **1. Search Latest Docs:**
```
"Search the web for Next.js App Router tutorial 2026"
"Find React hooks best practices"
"Search for Tailwind CSS v4 documentation"
```

### **2. Research Current Events:**
```
"Search for web development trends 2026"
"Find latest TypeScript features"
"Search for Node.js performance optimization"
```

### **3. Technical Help:**
```
"Search how to fix CORS error in Express"
"Find solutions for React useEffect infinite loop"
"Search TypeScript generic constraints examples"
```

---

## 🗄️ SQLite Database Examples:

### **1. Create Database & Table:**
```
"Create a SQLite database at ./data.db with a users table"

Tool call:
sqlite_query({
  database: "./data.db",
  query: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)"
})
```

### **2. Insert Data:**
```
"Add a user named John with email john@example.com"

Tool call:
sqlite_query({
  database: "./data.db",
  query: "INSERT INTO users (name, email) VALUES (?, ?)",
  params: ["John", "john@example.com"]
})
```

### **3. Query Data:**
```
"Show all users in the database"

Tool call:
sqlite_query({
  database: "./data.db",
  query: "SELECT * FROM users"
})
```

### **4. Update Data:**
```
"Update John's email to newemail@example.com"

Tool call:
sqlite_query({
  database: "./data.db",
  query: "UPDATE users SET email = ? WHERE name = ?",
  params: ["newemail@example.com", "John"]
})
```

---

## 🔑 Brave Search API:

**API Key:** `BSAk6ycQkrPTCb9RkvDP-9fEQVwADNt`

**Features:**
- Real-time web search
- No rate limit (depends on your plan)
- Privacy-focused (Brave Search)
- Returns titles, URLs, descriptions

**Endpoint:** `https://api.search.brave.com/res/v1/web/search`

---

## 📦 SQLite Dependencies:

**Required Package:** `better-sqlite3`

**Installation:**
```bash
npm install better-sqlite3
```

**Features:**
- Synchronous API (faster for small DBs)
- Prepared statements (SQL injection safe)
- WAL mode (better performance)
- Creates DB file automatically

---

## 💡 Workflow Examples:

### **Research + Database Workflow:**
```
You: "Search for best practices for storing user data in SQLite"
Dyad: (uses web_search) → Shows results

You: "Create a users table following those best practices"
Dyad: (uses sqlite_query) → Creates table

You: "Add a test user"
Dyad: (uses sqlite_query) → Inserts data

You: "Show all users"
Dyad: (uses sqlite_query) → Returns data
```

### **Documentation Search + Code:**
```
You: "Search for Next.js dynamic routes documentation"
Dyad: (uses web_search) → Shows latest docs

You: "Read my app/page.tsx file"
Dyad: (uses read_file) → Shows code

You: "Add dynamic routes based on the docs"
Dyad: (uses dyad-write tags) → Creates routes
```

---

## 🔧 Git Status:

```bash
Branch: custom-bash-tool
Version: custom-bash-v1.3

Recent Commits:
- custom-bash-v1.3 feat: add web_search (Brave) + sqlite_query to Build mode (NEW!)
- d96e622 feat: add Agent Pro tools to Build mode (FREE)
- c721d15 feat: add bash tool to Build mode (free tier)
```

---

## 📂 Files Modified:

```
src/ipc/handlers/chat_stream_handlers.ts
  └─ getMcpTools() function
     ├─ read_file tool
     ├─ list_files tool
     ├─ grep tool
     ├─ run_type_checks tool
     ├─ bash tool
     ├─ web_search tool (NEW!)
     └─ sqlite_query tool (NEW!)
```

---

## ⚡ What Makes v1.3 Special:

### **Before:**
- Build mode: File operations + bash only
- Web search: Not available
- Database: Only Supabase (complex setup)

### **After v1.3:**
- Build mode: Full agent capabilities
- Web search: Built-in Brave Search API
- Database: Simple SQLite queries
- 100% FREE
- No Pro subscription needed!

---

## 🧪 Test the New Tools:

### **Test 1: Web Search**
```
"Search the web for TypeScript 5.0 new features"
```
→ Should return Brave Search results

### **Test 2: Create SQLite Database**
```
"Create a SQLite database at ./test.db with a products table (id, name, price)"
```
→ Should create database and table

### **Test 3: Insert Data**
```
"Add a product: iPhone 15, price 999"
```
→ Should insert into database

### **Test 4: Query Data**
```
"Show all products in test.db"
```
→ Should return all products

### **Test 5: Combined Workflow**
```
"Search for best ecommerce database schema, then create that schema in products.db"
```
→ Should search web, then create database

---

## 🚀 Launch Dyad:

### **Quick Start:**
```bash
cd /d/GITHUB/dyad/out/dyad-win32-x64
start dyad.exe
```

### **Or Double-click:**
```
D:\GITHUB\dyad\out\dyad-win32-x64\dyad.exe
```

---

## 🔥 Summary:

**Version:** custom-bash-v1.3
**Date:** 2026-02-08
**Tools Added:** 2 (web_search, sqlite_query)
**Total Build Mode Tools:** 7
**Cost:** FREE
**Pro Required:** NO

**Dyad Build mode is now a COMPLETE AI AGENT!** 🚀

Features:
- ✅ File operations (read, list, grep)
- ✅ Code tools (type checking)
- ✅ Shell commands (bash)
- ✅ Web search (Brave API)
- ✅ Database (SQLite)

**All in FREE Build mode! No subscription needed!** 🎉

---

**Executable:**
```
D:\GITHUB\dyad\out\dyad-win32-x64\dyad.exe
```

**Ready to test!** 🔥
