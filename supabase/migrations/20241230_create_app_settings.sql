create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users(id)
);

-- Enable RLS
alter table app_settings enable row level security;

-- Policies
create policy "Allow read access to authenticated users"
  on app_settings for select
  to authenticated
  using (true);

create policy "Allow full access to admins only"
  on app_settings for all
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role = 'admin'
    )
  );
