-- Ensure permissions exist
INSERT INTO public.permissions (code, name, module) VALUES 
('expenses.view', 'View Expenses', 'expenses'),
('expenses.create', 'Create Expenses', 'expenses'),
('expenses.edit', 'Edit Expenses', 'expenses'),
('expenses.delete', 'Delete Expenses', 'expenses')
ON CONFLICT (code) DO NOTHING;

-- Grant expenses permissions to staff role
DO $$
DECLARE
    staff_role_id UUID;
    perm_id UUID;
BEGIN
    -- Get staff role id
    SELECT id INTO staff_role_id FROM public.app_roles WHERE name = 'staff';

    IF staff_role_id IS NOT NULL THEN
        -- Grant view
        SELECT id INTO perm_id FROM public.permissions WHERE code = 'expenses.view';
        INSERT INTO public.role_permissions (role_id, permission_id) VALUES (staff_role_id, perm_id) ON CONFLICT DO NOTHING;
        
        -- Grant create
        SELECT id INTO perm_id FROM public.permissions WHERE code = 'expenses.create';
        INSERT INTO public.role_permissions (role_id, permission_id) VALUES (staff_role_id, perm_id) ON CONFLICT DO NOTHING;
    END IF;
END $$;
