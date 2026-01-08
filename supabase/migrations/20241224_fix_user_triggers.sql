-- Fix Triggers and Profiles
-- This migration drops redundant triggers and ensures a unified, robust user creation process.

BEGIN;

-- 1. Drop old triggers to avoid duplicates and conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_set_pending_role ON auth.users;

-- 2. Ensure profiles table is correct
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Create a unified handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Assign 'pending' role in user_roles table
    -- We use ON CONFLICT to prevent errors if the role already exists
    BEGIN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'pending')
        ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore errors in role assignment to ensure user creation proceeds
    END;

    -- Create/Update profile
    BEGIN
        INSERT INTO public.profiles (id, email, full_name, role)
        VALUES (
            NEW.id, 
            NEW.email, 
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', ''),
            COALESCE(NEW.raw_user_meta_data->>'role', 'user')
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore errors in profile creation to ensure user creation proceeds
    END;

    RETURN NEW;
END;
$$;

-- 4. Create the unified trigger
CREATE TRIGGER on_auth_user_created_unified
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
