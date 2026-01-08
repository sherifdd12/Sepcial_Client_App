-- Ensure all permissions exist in the database
INSERT INTO public.permissions (code, name, module) VALUES
('dashboard.view', 'View Dashboard', 'dashboard'),
('customers.view', 'View Customers', 'customers'),
('transactions.view', 'View Transactions', 'transactions'),
('payments.view', 'View Payments', 'payments'),
('expenses.view', 'View Expenses', 'expenses'),
('reports.view', 'View Reports', 'reports'),
('settings.view', 'View Settings', 'settings'),
('settings.edit', 'Edit Settings', 'settings'),
('users.manage', 'Manage Users', 'admin'),
('roles.manage', 'Manage Roles', 'admin')
ON CONFLICT (code) DO NOTHING;

-- Grant essential permissions to 'staff' role
DO $$
DECLARE
  staff_role_id uuid;
  perm_id uuid;
BEGIN
  -- Get the staff role ID
  SELECT id INTO staff_role_id FROM public.app_roles WHERE name = 'staff';

  IF staff_role_id IS NOT NULL THEN
    -- Grant Expenses View (The reported issue)
    SELECT id INTO perm_id FROM public.permissions WHERE code = 'expenses.view';
    IF perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id) 
        VALUES (staff_role_id, perm_id) 
        ON CONFLICT DO NOTHING;
    END IF;

    -- Grant Dashboard View
    SELECT id INTO perm_id FROM public.permissions WHERE code = 'dashboard.view';
    IF perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id) 
        VALUES (staff_role_id, perm_id) 
        ON CONFLICT DO NOTHING;
    END IF;

    -- Grant Customers View
    SELECT id INTO perm_id FROM public.permissions WHERE code = 'customers.view';
    IF perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id) 
        VALUES (staff_role_id, perm_id) 
        ON CONFLICT DO NOTHING;
    END IF;

    -- Grant Transactions View
    SELECT id INTO perm_id FROM public.permissions WHERE code = 'transactions.view';
    IF perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id) 
        VALUES (staff_role_id, perm_id) 
        ON CONFLICT DO NOTHING;
    END IF;

    -- Grant Payments View
    SELECT id INTO perm_id FROM public.permissions WHERE code = 'payments.view';
    IF perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id) 
        VALUES (staff_role_id, perm_id) 
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Grant Reports View (Optional, but often needed for staff)
    SELECT id INTO perm_id FROM public.permissions WHERE code = 'reports.view';
    IF perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id) 
        VALUES (staff_role_id, perm_id) 
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
