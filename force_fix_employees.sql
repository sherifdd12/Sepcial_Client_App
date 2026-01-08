-- 1. Ensure the permissions exist in the permissions table
INSERT INTO public.permissions (code, name, module) VALUES
('employees.view', 'View Employees', 'employees'),
('employees.manage', 'Manage Employees', 'employees')
ON CONFLICT (code) DO NOTHING;

-- 2. Force assign these permissions to the 'admin' role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.app_roles r, public.permissions p
WHERE r.name = 'admin' 
AND p.code IN ('employees.view', 'employees.manage')
ON CONFLICT DO NOTHING;

-- 3. Also assign to 'staff' role if you want staff to see it (Optional, remove if not needed)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.app_roles r, public.permissions p
WHERE r.name = 'staff' 
AND p.code IN ('employees.view') -- Staff usually only view
ON CONFLICT DO NOTHING;

-- 4. Verify the result (This will show what permissions admin has)
SELECT r.name as role, p.code as permission
FROM public.role_permissions rp
JOIN public.app_roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE p.code LIKE 'employees%';
