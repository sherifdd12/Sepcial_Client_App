-- Fix RLS policy for user_roles to allow users to read their own role
-- This is required for the usePermissions hook to work for non-admin users

CREATE POLICY "Users can see their own role" ON public.user_roles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Ensure the specific admin user exists (based on the error log provided by user)
-- User ID: 25af76de-96cd-4ecb-a91a-23905e2858b0
INSERT INTO public.user_roles (user_id, role)
VALUES ('25af76de-96cd-4ecb-a91a-23905e2858b0', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Also ensure this user has the 'admin' role in the NEW app_roles system if we were linking them
-- But for now, usePermissions maps 'admin' string to 'admin' app_role.
