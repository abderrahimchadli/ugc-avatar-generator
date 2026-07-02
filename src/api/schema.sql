-- Supabase setup for the Vercel MVP.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists packages (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('avatar', 'product')),
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists package_items (
  id text primary key,
  package_id text references packages(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  source text,
  mode text,
  url text,
  prompt text,
  size_bytes bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists weekly_jobs (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null,
  week_start date not null,
  status text not null default 'draft',
  avatar_package_id text references packages(id) on delete set null,
  product_package_id text references packages(id) on delete set null,
  location_id text not null default 'studio',
  video_format text not null default 'ugc-ad',
  video_brief text not null default '',
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table packages enable row level security;
alter table package_items enable row level security;
alter table weekly_jobs enable row level security;

create policy "profiles read self" on profiles for select using (auth.uid() = id);
create policy "packages owner all" on packages for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "items owner all" on package_items for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "weekly jobs owner all" on weekly_jobs for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, status)
  values (new.id, new.email, 'user', 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- After your first signup, make yourself the super user:
-- update profiles set role = 'super_user', status = 'approved' where email = 'you@example.com';
