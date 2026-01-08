-- Check permissions for 'staff' role
SELECT 
    r.name as role_name,
    p.code as permission_code,
    p.name as permission_name
FROM public.app_roles r
JOIN public.role_permissions rp ON r.id = rp.role_id
JOIN public.permissions p ON rp.permission_id = p.id
WHERE r.name = 'staff' AND p.code LIKE 'expenses%';
