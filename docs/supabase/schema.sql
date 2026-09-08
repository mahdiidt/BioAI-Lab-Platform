-- BioAI Lab — Auth schema
-- Run this once in the Supabase project's SQL Editor (Dashboard -> SQL Editor -> New query).

-- 1. Profile table, one row per user, kept separate from auth.users so we can
--    freely add app-specific fields (like `plan`) without touching Supabase's
--    own auth tables.
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  -- 'free' today; becomes the hook for a paid tier later, e.g. 'pro'.
  -- Gate a feature with: profile.plan === 'pro' — no other auth changes needed.
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

-- 2. Row Level Security: each user can only see/update their own profile.
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Note: there is intentionally no insert/delete policy for normal users.
-- Profile rows are created automatically by the trigger below, and `plan`
-- changes should come from a trusted process (e.g. a Stripe webhook running
-- with the service_role key) once a paid tier exists — not from the client.

-- 3. Auto-create a profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, plan)
  values (new.id, new.email, 'free');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
