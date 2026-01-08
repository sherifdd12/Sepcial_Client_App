-- Backfill profiles for existing users
insert into public.profiles (id, email, full_name, role)
select 
  id, 
  email, 
  raw_user_meta_data->>'full_name',
  coalesce(raw_user_meta_data->>'role', 'user')
from auth.users
on conflict (id) do nothing;
