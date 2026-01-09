# Supabase Database Setup Instructions

This guide will help you copy your database structure (without data) to a new Supabase project.

## Prerequisites

1. A new Supabase project (free account is fine)
2. Access to the Supabase SQL Editor

## Step-by-Step Instructions

### Step 1: Open Your New Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in and open your **NEW** project (the one you want to copy the structure to)
3. Make sure this is a **fresh/empty** project (or you're okay with overwriting)

### Step 2: Open SQL Editor

1. In your Supabase dashboard, click on **"SQL Editor"** in the left sidebar
2. Click **"New query"** button

### Step 3: Copy and Run the Schema Script

1. Open the file `COMPLETE_SCHEMA_SETUP.sql` in this folder
2. **Copy the ENTIRE contents** of the file (it's a large file, make sure you get everything)
3. **Paste it** into the SQL Editor in Supabase
4. Click **"Run"** button (or press `Ctrl+Enter` / `Cmd+Enter`)

### Step 4: Wait for Completion

- The script will take **1-2 minutes** to complete
- You should see a success message: "Success. No rows returned"
- If you see any errors, check the error message and let me know

### Step 5: Create Your First Admin User

After the schema is set up, you need to create an admin user:

1. Go to **"Authentication"** → **"Users"** in Supabase dashboard
2. Click **"Add user"** → **"Create new user"**
3. Enter an email and password
4. **Copy the User ID** (UUID) that appears

5. Go back to **SQL Editor** and run this query (replace `YOUR_USER_ID` with the actual UUID):

```sql
INSERT INTO public.user_roles (user_id, role) 
VALUES ('YOUR_USER_ID', 'admin');
```

### Step 6: Update Your App Configuration

1. In your Supabase project, go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (the `anon` key, not the `service_role` key)

3. In your app, update the `.env` file (or create one if it doesn't exist):

```env
VITE_SUPABASE_URL=https://your-new-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-new-anon-key-here
```

### Step 7: Test Your App

1. Start your app: `npm run dev`
2. Try logging in with the admin user you created
3. Verify that all pages load correctly

## What This Script Does

✅ Creates all database tables (customers, transactions, payments, etc.)  
✅ Creates all functions (record_payment, get_dashboard_stats, etc.)  
✅ Sets up all triggers (auto-sequence numbers, updated_at timestamps)  
✅ Configures Row Level Security (RLS) policies  
✅ Creates storage buckets for file uploads  
✅ Seeds permissions and roles (admin, staff, viewer)  
❌ **Does NOT copy any data** (customers, transactions, payments remain empty)

## Troubleshooting

### Error: "relation already exists"
- Your database already has some tables. You can either:
  - Start with a fresh Supabase project, OR
  - Drop existing tables first (be careful!)

### Error: "permission denied"
- Make sure you're running the script as the project owner
- Check that you're in the correct Supabase project

### Error: "function already exists"
- Some functions might already exist. The script uses `CREATE OR REPLACE` so this should be fine, but if you see this error, it's usually safe to ignore.

### Can't log in after setup
- Make sure you created the user in Supabase Auth
- Make sure you added the user to `user_roles` table with role 'admin'
- Check that your `.env` file has the correct Supabase URL and key

## Need Help?

If you encounter any issues, check:
1. The error message in Supabase SQL Editor
2. Your Supabase project logs (Settings → Logs)
3. Your browser console for frontend errors

## Next Steps After Setup

1. **Import your data** (if needed) - Use the Data Import page in your app
2. **Configure storage buckets** - Make sure file uploads work
3. **Set up Tap Payments** (if using) - Configure Tap API keys in app settings
4. **Customize permissions** - Adjust roles and permissions as needed

---

**Note:** This script creates the structure only. All your actual data (customers, transactions, payments) will need to be imported separately if you want to copy it from your old database.
