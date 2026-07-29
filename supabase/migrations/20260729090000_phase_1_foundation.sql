create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'สมาชิกใหม่' check (char_length(display_name) between 2 and 80),
  role text not null default 'customer' check (role in ('customer', 'operator', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.simulation_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(14,2) not null default 10000 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  category text not null default 'quick',
  status text not null default 'open' check (status in ('scheduled', 'open', 'closed', 'settled', 'cancelled')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint rounds_time_order check (closes_at > opens_at)
);

alter table public.profiles enable row level security;
alter table public.simulation_wallets enable row level security;
alter table public.rounds enable row level security;

create policy "profiles_select_own"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "wallets_select_own"
on public.simulation_wallets for select to authenticated
using ((select auth.uid()) = user_id);

create policy "rounds_read_active"
on public.rounds for select to authenticated
using (status in ('scheduled', 'open', 'closed', 'settled'));

grant usage on schema public to anon, authenticated;
grant select, update (display_name) on public.profiles to authenticated;
grant select on public.simulation_wallets to authenticated;
grant select on public.rounds to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'สมาชิกใหม่')
  );
  insert into public.simulation_wallets (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.handle_new_user();

insert into public.rounds (code, title, category, status, opens_at, closes_at)
values (
  'QUICK-DEMO-001',
  'Quick Lab 15 นาที',
  'quick',
  'open',
  now() - interval '1 hour',
  now() + interval '30 days'
);
