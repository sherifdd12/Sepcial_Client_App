-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- e.g., 'transactions.view', 'payments.create'
    name TEXT NOT NULL, -- e.g., 'View Transactions'
    module TEXT NOT NULL, -- e.g., 'Transactions'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create app_roles table (dynamic roles)
CREATE TABLE IF NOT EXISTS public.app_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g., 'admin', 'staff', 'accountant'
    description TEXT,
    is_system_role BOOLEAN DEFAULT false, -- System roles cannot be deleted
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create role_permissions table (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID REFERENCES public.app_roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for RBAC tables (Admin only management, everyone read)
CREATE POLICY "Allow read access to permissions for authenticated users" ON public.permissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access to app_roles for authenticated users" ON public.app_roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access to role_permissions for authenticated users" ON public.role_permissions FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can modify these tables (we'll define 'admin' check later via function or hardcoded for now)
-- For now, let's assume anyone with 'admin' role in user_roles can edit.
-- But wait, we are moving away from user_roles string.
-- Let's stick to the current user_roles table for bootstrapping.

CREATE POLICY "Allow full access to permissions for admins" ON public.permissions
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Allow full access to app_roles for admins" ON public.app_roles
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Allow full access to role_permissions for admins" ON public.role_permissions
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));


-- Seed Permissions
INSERT INTO public.permissions (code, name, module, description) VALUES
-- Dashboard
('dashboard.view', 'View Dashboard', 'Dashboard', 'Access to view the main dashboard'),
('dashboard.stats', 'View Dashboard Stats', 'Dashboard', 'View financial statistics on dashboard'),

-- Customers
('customers.view', 'View Customers', 'Customers', 'View customer list and details'),
('customers.create', 'Create Customer', 'Customers', 'Add new customers'),
('customers.edit', 'Edit Customer', 'Customers', 'Edit existing customer details'),
('customers.delete', 'Delete Customer', 'Customers', 'Delete customers'),

-- Transactions
('transactions.view', 'View Transactions', 'Transactions', 'View transaction list and details'),
('transactions.create', 'Create Transaction', 'Transactions', 'Create new transactions'),
('transactions.edit', 'Edit Transaction', 'Transactions', 'Edit existing transactions'),
('transactions.delete', 'Delete Transaction', 'Transactions', 'Delete transactions'),
('transactions.approve', 'Approve Transaction', 'Transactions', 'Approve pending transactions'),

-- Payments
('payments.view', 'View Payments', 'Payments', 'View payment history'),
('payments.create', 'Record Payment', 'Payments', 'Record new payments'),
('payments.edit', 'Edit Payment', 'Payments', 'Edit existing payments'),
('payments.delete', 'Delete Payment', 'Payments', 'Delete payments'),

-- Expenses
('expenses.view', 'View Expenses', 'Expenses', 'View expenses list'),
('expenses.create', 'Create Expense', 'Expenses', 'Record new expenses'),
('expenses.edit', 'Edit Expense', 'Expenses', 'Edit existing expenses'),
('expenses.delete', 'Delete Expense', 'Expenses', 'Delete expenses'),

-- Reports
('reports.view', 'View Reports', 'Reports', 'Access financial reports'),
('reports.export', 'Export Reports', 'Reports', 'Export data to Excel/PDF'),

-- Settings & Admin
('settings.view', 'View Settings', 'Settings', 'View application settings'),
('settings.edit', 'Edit Settings', 'Settings', 'Modify application settings'),
('users.manage', 'Manage Users', 'Admin', 'Manage system users and roles'),
('roles.manage', 'Manage Roles', 'Admin', 'Create and modify roles and permissions')
ON CONFLICT (code) DO NOTHING;

-- Seed Roles
INSERT INTO public.app_roles (name, description, is_system_role) VALUES
('admin', 'Administrator with full access', true),
('staff', 'Staff member with standard access', true),
('viewer', 'Read-only access', false)
ON CONFLICT (name) DO NOTHING;

-- Assign Permissions to Roles

-- Admin: All permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.app_roles r, public.permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Staff: Standard access (No delete, No admin)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.app_roles r, public.permissions p
WHERE r.name = 'staff'
AND p.code NOT IN (
    'customers.delete',
    'transactions.delete',
    'payments.delete',
    'expenses.delete',
    'users.manage',
    'roles.manage',
    'settings.edit'
)
ON CONFLICT DO NOTHING;

-- Viewer: View only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.app_roles r, public.permissions p
WHERE r.name = 'viewer'
AND p.code LIKE '%.view'
ON CONFLICT DO NOTHING;


-- Helper Function to check permissions
-- This function checks if a user has a specific permission code.
-- It bridges the gap between the old user_roles table and the new RBAC system
-- by mapping user_roles.role (string) to app_roles.name.

CREATE OR REPLACE FUNCTION public.has_permission(user_id UUID, permission_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_name TEXT;
    has_perm BOOLEAN;
BEGIN
    -- Get the user's role name from the legacy user_roles table
    SELECT role INTO user_role_name
    FROM public.user_roles
    WHERE public.user_roles.user_id = has_permission.user_id;

    IF user_role_name IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check if the role has the permission
    SELECT EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        JOIN public.app_roles r ON r.id = rp.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE r.name = user_role_name
        AND p.code = permission_code
    ) INTO has_perm;

    RETURN has_perm;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.has_permission TO authenticated;
