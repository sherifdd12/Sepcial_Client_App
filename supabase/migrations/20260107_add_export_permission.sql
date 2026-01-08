-- Add 'can_export_data' permission
INSERT INTO public.permissions (code, name, description, module)
VALUES ('can_export_data', 'تصدير البيانات', 'إمكانية تصدير البيانات إلى Excel أو PDF', 'system')
ON CONFLICT (code) DO NOTHING;

-- Assign 'can_export_data' to 'admin' role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.app_roles r, public.permissions p
WHERE r.name = 'admin' AND p.code = 'can_export_data'
ON CONFLICT DO NOTHING;
