# Simple Way to Copy Database Schema (Structure Only)

## What You Want to Do
Copy the **database structure** (tables, functions, triggers, etc.) from your **OLD Supabase project** to your **NEW Supabase project**, **WITHOUT copying the data**.

## ⚠️ Important Note
Supabase website doesn't have a built-in "Export Schema" button. But I've created a complete solution for you!

## ✅ EASIEST METHOD (Recommended)

I already created a complete schema script for you! Here's what to do:

### Option 1: Use the Complete Schema Script (Easiest)

1. **Open your NEW Supabase project** (the empty one)
2. Go to **SQL Editor** → **New query**
3. Open the file: `supabase/COMPLETE_SCHEMA_SETUP.sql`
4. **Copy the ENTIRE file** (all 1300+ lines)
5. **Paste it** into SQL Editor
6. Click **"Run"**
7. Wait 1-2 minutes
8. **Done!** Your database structure is ready

This script creates:
- ✅ All tables
- ✅ All functions
- ✅ All triggers
- ✅ All RLS policies
- ✅ Storage buckets
- ✅ Permissions and roles
- ❌ **NO DATA** (which is what you want!)

### Option 2: Export from Old Database (If you want to customize)

If you want to export directly from your old database:

1. **In your OLD Supabase project:**
   - Go to **SQL Editor**
   - Run this query to see all your tables:
   
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_type = 'BASE TABLE'
   ORDER BY table_name;
   ```

2. **For each table, get the structure:**
   ```sql
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_schema = 'public' 
   AND table_name = 'customers'  -- Replace with your table name
   ORDER BY ordinal_position;
   ```

3. **But this is tedious!** That's why I created `COMPLETE_SCHEMA_SETUP.sql` for you.

## 🎯 Recommended Approach

**Just use `COMPLETE_SCHEMA_SETUP.sql`** - it's already complete and tested. It will create the exact same structure as your current database.

## After Running the Script

1. **Create your first admin user:**
   - Go to **Authentication** → **Users** → **Add user**
   - Create a user, copy the User ID
   - Go to **SQL Editor** and run:
   
   ```sql
   INSERT INTO public.user_roles (user_id, role) 
   VALUES ('YOUR_USER_ID_HERE', 'admin');
   ```

2. **Update your app's `.env` file:**
   ```env
   VITE_SUPABASE_URL=https://your-new-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-new-anon-key
   ```

3. **Test your app!**

## Why This Method?

- ✅ Works 100% with Supabase website (no CLI needed)
- ✅ Complete and ready to use
- ✅ Includes all functions, triggers, and policies
- ✅ No data copied (only structure)
- ✅ Fast and reliable

## Need Help?

If you encounter any errors:
1. Check the error message in SQL Editor
2. Make sure you copied the ENTIRE script
3. Try running it section by section if needed

---

**TL;DR:** Just use `COMPLETE_SCHEMA_SETUP.sql` in your NEW Supabase project's SQL Editor. It's the easiest way!
