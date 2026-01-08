-- Convert user_roles.role to TEXT to support dynamic roles
-- We need to drop dependent policies first

-- Drop policies on permissions table that depend on user_roles
DROP POLICY IF EXISTS "Allow full access to permissions for admins" ON public.permissions;
DROP POLICY IF EXISTS "Allow read access to permissions for authenticated users" ON public.permissions;

-- Drop policies on role_permissions table that depend on user_roles
DROP POLICY IF EXISTS "Allow full access to role_permissions for admins" ON public.role_permissions;

-- Drop policies on app_roles table that depend on user_roles (via has_role or direct check)
DROP POLICY IF EXISTS "Allow full access to app_roles for admins" ON public.app_roles;
DROP POLICY IF EXISTS "Allow read access to app_roles for authenticated users" ON public.app_roles;

-- Drop policies on user_roles table itself
DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Now we can alter the column
ALTER TABLE public.user_roles ALTER COLUMN role TYPE TEXT;

-- Update existing has_role to handle TEXT comparison (overload for app_role)
-- This ensures existing RLS policies using 'admin'::app_role continue to work
CREATE OR REPLACE FUNCTION public.has_role(user_id_to_check UUID, role_to_check public.app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = user_id_to_check
        AND role = role_to_check::text
    );
END;
$$;

-- Create new has_role for TEXT input (for dynamic roles)
CREATE OR REPLACE FUNCTION public.has_role(user_id_to_check UUID, role_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = user_id_to_check
        AND role = role_to_check
    );
END;
$$;

-- Recreate policies

-- Policies for user_roles
CREATE POLICY "Users can read their own role" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Use has_role() function which is SECURITY DEFINER to avoid infinite recursion
CREATE POLICY "Admins can manage all roles" ON public.user_roles
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Admins can update user_roles" ON public.user_roles
    FOR UPDATE
    USING (
        public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        public.has_role(auth.uid(), 'admin')
    );

-- Policies for permissions
CREATE POLICY "Allow read access to permissions for authenticated users" ON public.permissions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full access to permissions for admins" ON public.permissions
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin')
    );

-- Policies for role_permissions
CREATE POLICY "Allow full access to role_permissions for admins" ON public.role_permissions
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin')
    );

-- Policies for app_roles
CREATE POLICY "Allow read access to app_roles for authenticated users" ON public.app_roles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full access to app_roles for admins" ON public.app_roles
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin')
    );
