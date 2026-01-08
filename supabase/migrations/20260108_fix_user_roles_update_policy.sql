-- Allow admins to update user_roles
-- This is required for the Admin > Users page to change user roles.

CREATE POLICY "Admins can update user_roles" ON public.user_roles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );
