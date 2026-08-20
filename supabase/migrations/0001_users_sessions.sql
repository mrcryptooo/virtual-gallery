-- Seismic Museum: real identity/auth schema.
--
-- Deliberately minimal, per the architecture decision recorded in
-- docs/reports/premium-experience-infrastructure-boundary.md and its
-- follow-up: Submit Your Art and museum screenshots keep living in Vercel
-- Blob (already working, tested, hardened) -- this schema only adds the
-- one thing Blob genuinely cannot do: real user identity, profile, role,
-- and revocable sessions. "Screenshot/submission ownership" is satisfied
-- by the existing `userId` field on those Blob JSON records now being
-- populated with a real users.id instead of always null.
--
-- Auth model: NOT Supabase Auth. X's modern OAuth 2.0 + PKCE flow is
-- handled by hand (api/auth/*.ts) because Supabase Auth's built-in
-- "twitter" provider is the legacy OAuth 1.0a flow, not what's required
-- here. This project's own API routes are the only thing that ever holds
-- the Supabase service-role key; the browser never talks to Supabase
-- directly (no anon key is used client-side), so Row Level Security below
-- is defense-in-depth, not the primary access-control mechanism -- the
-- service role bypasses it by design, exactly like every other
-- Postgres/Supabase deployment.

create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  x_user_id text not null unique,
  x_username text not null,
  display_name text not null,
  avatar_url text,
  bio text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_x_user_id_idx on public.users (x_user_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text,
  revoked_at timestamptz
);

create index sessions_user_id_idx on public.sessions (user_id);
create index sessions_expires_at_idx on public.sessions (expires_at);

alter table public.users enable row level security;
alter table public.sessions enable row level security;
-- No policies are defined: with RLS enabled and zero policies, every
-- table denies all access to any role except the ones Postgres/Supabase
-- always exempts from RLS (the table owner and the service_role key).
-- The anon/publishable key -- the only key this app would ever consider
-- shipping to a browser -- gets nothing, even if it were exposed by
-- accident.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row
  execute function public.set_updated_at();
