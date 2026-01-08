-- Remove the 'admin' role for the specific user
DELETE FROM public.user_roles
WHERE role = 'admin'
AND user_id IN (
    SELECT id FROM auth.users WHERE email = 'a.kuwaity2020@gmail.com'
);
