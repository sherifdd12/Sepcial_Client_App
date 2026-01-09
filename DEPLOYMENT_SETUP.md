# 🚀 Deployment Setup Guide

Complete instructions to connect your app to the new Supabase database and deploy to Cloudflare.

## 📋 Prerequisites Checklist

- ✅ New Supabase project created
- ✅ Database schema setup completed (COMPLETE_SCHEMA_SETUP.sql run successfully)
- ✅ GitHub repository ready
- ✅ Cloudflare account ready

---

## Step 1: Get Your Supabase Credentials

1. **Go to your NEW Supabase project dashboard**
2. Click **Settings** (gear icon) → **API**
3. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public key** (the `anon` key, NOT `service_role`)

4. **Save them somewhere safe** - you'll need them in Step 3

---

## Step 2: Create Your First Admin User

Before deploying, create an admin user:

1. In Supabase dashboard, go to **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Enter:
   - **Email**: your admin email
   - **Password**: create a strong password
4. Click **"Create user"**
5. **Copy the User ID** (UUID) that appears

6. Go to **SQL Editor** and run:
   ```sql
   INSERT INTO public.user_roles (user_id, role) 
   VALUES ('PASTE_YOUR_USER_ID_HERE', 'admin');
   ```

7. **Test login** in your local app to make sure it works

---

## Step 3: Configure Environment Variables

### For Local Development

1. In your project root, check if `.env` file exists
2. If not, create `.env` file
3. Add these variables:

```env
VITE_SUPABASE_URL=https://your-new-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important:** 
- Replace `your-new-project-id` with your actual Supabase project URL
- Replace `your-anon-key-here` with your actual anon key
- **Never commit `.env` to GitHub** (it should be in `.gitignore`)

### For Cloudflare Pages Deployment

1. Go to **Cloudflare Dashboard** → **Pages**
2. Select your project (or create new one connected to your GitHub repo)
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

**Variable 1:**
- **Name:** `VITE_SUPABASE_URL`
- **Value:** `https://your-new-project-id.supabase.co`
- **Environment:** Production (and Preview if you want)

**Variable 2:**
- **Name:** `VITE_SUPABASE_ANON_KEY`
- **Value:** `your-anon-key-here`
- **Environment:** Production (and Preview if you want)

5. Click **Save**

---

## Step 4: Update Your App Code (If Needed)

Check that your app uses these environment variables correctly:

1. Open `src/integrations/supabase/client.ts`
2. It should look like this:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

If it's different, update it to match.

---

## Step 5: Configure Cloudflare Pages Build Settings

1. In Cloudflare Pages project settings, go to **Builds & deployments**
2. Set **Build command:**
   ```
   npm run build
   ```
3. Set **Build output directory:**
   ```
   dist
   ```
4. Set **Root directory:** (if your app is in a subfolder)
   ```
   qd-installments-pro-feature-enhanced-ui-mobile-v2
   ```

---

## Step 6: Enable Auto-Deploy from GitHub

1. In Cloudflare Pages, go to **Settings** → **Builds & deployments**
2. Make sure **"Auto-deploy"** is enabled
3. Select your GitHub repository
4. Select branch: `main` (or your default branch)
5. Cloudflare will automatically deploy when you push to GitHub

---

## Step 7: Test Your Deployment

1. **Push a test commit to GitHub:**
   ```bash
   git add .
   git commit -m "Test deployment"
   git push origin main
   ```

2. **Watch Cloudflare Pages:**
   - Go to Cloudflare Pages dashboard
   - You should see a new deployment starting
   - Wait for it to complete (usually 2-5 minutes)

3. **Visit your deployed site:**
   - Click on the deployment
   - Click "View deployment"
   - Try logging in with your admin user

---

## Step 8: Configure Custom Domain (Optional)

1. In Cloudflare Pages, go to **Custom domains**
2. Click **"Set up a custom domain"**
3. Enter your domain name
4. Follow the DNS configuration instructions
5. Cloudflare will automatically set up SSL

---

## 🔧 Troubleshooting

### App shows "Invalid API key" error
- ✅ Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly in Cloudflare
- ✅ Make sure you're using the **anon key**, not service_role key
- ✅ Redeploy after changing environment variables

### Can't log in after deployment
- ✅ Make sure you created the admin user in Supabase
- ✅ Make sure you added the user to `user_roles` table with role 'admin'
- ✅ Check browser console for errors

### Build fails in Cloudflare
- ✅ Check build logs in Cloudflare Pages
- ✅ Make sure `package.json` has correct build script
- ✅ Make sure all dependencies are in `package.json` (not just devDependencies)

### Environment variables not working
- ✅ Make sure variable names start with `VITE_` (Vite requirement)
- ✅ Redeploy after adding/changing environment variables
- ✅ Check that variables are set for the correct environment (Production/Preview)

---

## 📝 Quick Reference

### Supabase Credentials Location
- **Dashboard:** Settings → API
- **Project URL:** Copy from "Project URL" field
- **Anon Key:** Copy from "anon public" key field

### Cloudflare Environment Variables
- **Location:** Pages → Your Project → Settings → Environment Variables
- **Required Variables:**
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### First Admin User Setup
```sql
-- Run in Supabase SQL Editor
INSERT INTO public.user_roles (user_id, role) 
VALUES ('YOUR_USER_ID', 'admin');
```

---

## ✅ Deployment Checklist

- [ ] Supabase database schema setup complete
- [ ] Supabase credentials copied (URL and anon key)
- [ ] First admin user created and added to user_roles
- [ ] Local `.env` file configured
- [ ] Cloudflare Pages project created
- [ ] Cloudflare environment variables set
- [ ] Build settings configured
- [ ] GitHub repository connected
- [ ] Auto-deploy enabled
- [ ] Test deployment successful
- [ ] Can log in to deployed app

---

## 🎉 You're Done!

Once all steps are complete:
1. Your app will auto-deploy on every GitHub push
2. You can access it via Cloudflare Pages URL
3. All data will be stored in your new Supabase database
4. You can manage users, roles, and data through Supabase dashboard

**Need help?** Check the troubleshooting section or review the error messages in Cloudflare build logs.
