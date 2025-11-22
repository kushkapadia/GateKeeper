# 🔗 How to Get Your Supabase Connection String

## The Problem

Your current hostname `db.eogcjubevpdtmebofxqv.supabase.co` cannot be resolved. This usually means:
- The hostname format is incorrect, OR
- Your Supabase project is paused (free tier pauses after inactivity)

---

## ✅ Solution: Get the Correct Connection String

### Step 1: Open Supabase Dashboard

1. Go to: **https://supabase.com/dashboard**
2. Log in to your account
3. You should see your project: **eogcjubevpdtmebofxqv**

### Step 2: Check Project Status

- If you see a **"Paused"** indicator or **"Restore"** button:
  1. Click **"Restore"** or **"Resume"**
  2. Wait ~30 seconds for project to wake up
  3. Continue to Step 3

### Step 3: Get Connection String

1. Click on your project (**eogcjubevpdtmebofxqv**)
2. In the left sidebar, click the **⚙️ Settings** (gear icon)
3. Click **"Database"** in the Settings menu
4. Scroll down to **"Connection string"** section
5. You'll see multiple tabs:
   - **URI** ← Use this one!
   - Session mode
   - .NET
   - etc.

6. Make sure **"URI"** tab is selected
7. Click the **"Copy"** button

### Step 4: Understand the Format

The connection string will look like ONE of these:

**Option A: Direct Connection (most common)**
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Option B: IPv4 Pooler**
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Option C: Transaction Mode**
```
postgresql://postgres:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

### Step 5: Get Your Password

In the same Database settings page:

1. Look for **"Database password"** section
2. If you don't know your password:
   - Click **"Reset database password"**
   - Click **"Generate a new password"**
   - **COPY THIS PASSWORD IMMEDIATELY** (you won't see it again!)
3. Replace `[YOUR-PASSWORD]` in the connection string with this password

---

## 🔧 Update Your .env File

1. Open `.env` file in your project root
2. Replace the `DATABASE_URL` line with the connection string you copied
3. Replace `[YOUR-PASSWORD]` with your actual password
4. Make sure there are **NO QUOTES** around the URL

### Example:

**If Supabase gave you:**
```
postgresql://postgres.eogcjubevpdtmebofxqv:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**And your password is:** `MySecretPass123`

**Your .env should have:**
```env
DATABASE_URL=postgresql://postgres.eogcjubevpdtmebofxqv:MySecretPass123@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**Important**:
- NO quotes around the URL
- NO spaces
- Replace the entire `[YOUR-PASSWORD]` part with actual password

---

## 🧪 Test the Connection

After updating `.env`:

```bash
python scripts/debug_connection.py
```

You should see:
```
✅ SUCCESS: Hostname resolves to [IP ADDRESS]
✅ SUCCESS: Port XXXX is reachable
✅ SUCCESS: Connected to PostgreSQL
```

---

## 🚨 Common Mistakes

### ❌ Wrong:
```env
DATABASE_URL="postgresql://postgres:password@host:5432/postgres"  # Has quotes
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@host:5432/postgres  # Didn't replace [YOUR-PASSWORD]
DATABASE_URL=postgresql://postgres: password@host:5432/postgres  # Space in password
```

### ✅ Correct:
```env
DATABASE_URL=postgresql://postgres:MyActualPassword123@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

---

## 📸 Visual Guide

### Where to Find Connection String:

1. **Dashboard** (https://supabase.com/dashboard)
   ```
   ┌─────────────────────────────────────┐
   │  Your Projects                      │
   ├─────────────────────────────────────┤
   │  📦 eogcjubevpdtmebofxqv  [Active]  │ ← Click this
   └─────────────────────────────────────┘
   ```

2. **Settings** (left sidebar)
   ```
   ┌─────────────────┐
   │ 🏠 Home         │
   │ 📊 Database     │
   │ 🔌 API          │
   │ ⚙️  Settings    │ ← Click this
   └─────────────────┘
   ```

3. **Database** (in Settings)
   ```
   ┌─────────────────┐
   │ General         │
   │ API             │
   │ Database        │ ← Click this
   │ Auth            │
   └─────────────────┘
   ```

4. **Connection string** (scroll down)
   ```
   Connection string
   ┌─────────────────────────────────────┐
   │  URI | Session mode | .NET | ...   │ ← Select "URI"
   ├─────────────────────────────────────┤
   │  postgresql://postgres.abc...       │
   │                      [Copy] button  │ ← Click Copy
   └─────────────────────────────────────┘
   ```

---

## 🎯 Quick Checklist

- [ ] Logged into Supabase Dashboard
- [ ] Project is **Active** (not paused)
- [ ] Opened Settings → Database
- [ ] Copied connection string from **URI** tab
- [ ] Got/reset database password
- [ ] Updated `.env` file with correct string
- [ ] Removed quotes from DATABASE_URL
- [ ] Replaced [YOUR-PASSWORD] with actual password
- [ ] Ran `python scripts/debug_connection.py`
- [ ] Saw ✅ SUCCESS messages

---

## 🆘 Still Not Working?

### Try Alternative Connection Methods:

1. **Try Connection Pooler (Port 6543)**
   - In Supabase Dashboard → Database
   - Look for "Connection pooling" section
   - Copy that connection string instead

2. **Try Direct Connection (Port 5432)**
   - Might be labeled as "Direct connection" or "Transaction mode"

3. **Check Your Internet**
   ```bash
   # Test if you can reach Supabase at all
   ping supabase.com
   ```

4. **Check Firewall**
   - Corporate firewall might block database ports
   - Try from home network or mobile hotspot

5. **Contact Supabase Support**
   - If project shows as Active but still can't connect
   - Discord: https://discord.supabase.com
   - Include project ref: `eogcjubevpdtmebofxqv`

---

## ✅ Next Steps After Connection Works

Once `debug_connection.py` shows all green checkmarks:

1. **Run migrations** in Supabase SQL Editor
   - Go to SQL Editor in dashboard
   - Run `migrations/001_init.sql`
   - Run `migrations/seed_example.sql`

2. **Set tenant password**
   ```bash
   python backend/scripts/setup_tenant_password.py acme admin
   ```

3. **Start the application**
   ```bash
   docker-compose up
   ```

4. **Continue with** [SUPABASE_SETUP.md](SUPABASE_SETUP.md)

---

**Most Important**: Get the connection string directly from Supabase Dashboard, don't try to guess the hostname format!
