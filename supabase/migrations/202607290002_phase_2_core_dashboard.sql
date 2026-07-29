-- Phase 2: one core account, wallet and dashboard model.
alter table public.simulation_wallets rename to wallets;
alter table public.wallets rename constraint simulation_wallets_pkey to wallets_pkey;
alter table public.wallets rename constraint simulation_wallets_user_id_fkey to wallets_user_id_fkey;
alter table public.wallets rename constraint simulation_wallets_balance_check to wallets_balance_check;

alter table public.profiles drop constraint profiles_role_check;
update public.profiles set role = 'member' where role = 'customer';
alter table public.profiles alter column role set default 'member';
alter table public.profiles add constraint profiles_role_check check (role in ('member', 'agent', 'admin'));
alter table public.profiles add column if not exists account_status text not null default 'active'
  constraint profiles_account_status_check check (account_status in ('pending', 'active', 'suspended'));

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_type text not null check (entry_type in ('opening', 'credit', 'debit', 'adjustment')),
  amount numeric(14,2) not null check (amount <> 0),
  balance_after numeric(14,2) not null check (balance_after >= 0),
  description text not null,
  created_at timestamptz not null default now()
);
create index wallet_ledger_user_created_idx on public.wallet_ledger (user_id, created_at desc);
insert into public.wallet_ledger (user_id, entry_type, amount, balance_after, description)
select w.user_id, 'opening', w.balance, w.balance, 'ยอดตั้งต้นของบัญชี'
from public.wallets w
where not exists (select 1 from public.wallet_ledger l where l.user_id = w.user_id and l.entry_type = 'opening');

alter table public.wallets enable row level security;
alter table public.wallet_ledger enable row level security;
create policy wallet_ledger_select_own on public.wallet_ledger for select to authenticated
using ((select auth.uid()) = user_id);
grant select on public.profiles, public.wallets, public.wallet_ledger, public.rounds to authenticated;
grant update (display_name) on public.profiles to authenticated;
revoke all on public.wallets, public.wallet_ledger from anon;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare initial_balance numeric(14,2);
begin
  insert into public.profiles (id, display_name, role, account_status)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'สมาชิกใหม่'), 'member', 'active');
  insert into public.wallets (user_id) values (new.id) returning balance into initial_balance;
  insert into public.wallet_ledger (user_id, entry_type, amount, balance_after, description)
  values (new.id, 'opening', initial_balance, initial_balance, 'ยอดตั้งต้นของบัญชี');
  return new;
end;
$function$;