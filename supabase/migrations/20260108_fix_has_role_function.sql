-- Fix has_role function to handle both text roles and UUIDs (legacy data)
-- This ensures that if user_roles.role contains a UUID (from previous foreign key), it still works by looking up the role name in app_roles.

-- 1. Drop dependent policies first to avoid "cannot drop function because other objects depend on it" error
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow full access to permissions for admins" ON public.permissions;
DROP POLICY IF EXISTS "Allow full access to role_permissions for admins" ON public.role_permissions;
DROP POLICY IF EXISTS "Allow full access to app_roles for admins" ON public.app_roles;

-- 2. Drop the function (now safe)
DROP FUNCTION IF EXISTS public.has_role(uuid, text);

-- 3. Create the new function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.app_roles ar ON ar.id::text = ur.role -- Try to join if role is an ID
    WHERE ur.user_id = _user_id
    AND (
      ur.role = _role -- Direct match (text role, e.g. 'admin')
      OR
      ar.name = _role -- Match via ID lookup (e.g. ur.role is UUID, ar.name is 'admin')
    )
  );
END;
$function$;

-- 4. Recreate the policies
-- Policies for user_roles
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
CREATE POLICY "Allow full access to app_roles for admins" ON public.app_roles
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin')
    );
