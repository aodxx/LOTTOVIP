-- Phase 3: round rules and member-owned draft entries.
create table public.round_rules (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  entry_type text not null check (entry_type in ('three_straight', 'three_permutation', 'two_top', 'two_bottom')),
  display_name text not null check (char_length(display_name) between 2 and 40),
  digits smallint not null check (digits in (2, 3)),
  min_amount numeric(14,2) not null default 1 check (min_amount > 0),
  max_amount numeric(14,2) not null default 1000 check (max_amount >= min_amount),
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (round_id, entry_type)
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'cancelled')),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entry_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  rule_id uuid not null references public.round_rules(id) on delete restrict,
  number_text text not null check (number_text ~ '^[0-9]{2,3}$'),
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (entry_id, rule_id, number_text)
);

create index round_rules_round_idx on public.round_rules (round_id, is_active, sort_order);
create index entries_user_updated_idx on public.entries (user_id, updated_at desc);
create index entries_round_idx on public.entries (round_id, status);
create index entry_items_entry_idx on public.entry_items (entry_id);

create or replace function private.validate_entry_item()
returns trigger language plpgsql set search_path = ''
as $function$
declare
  selected_entry public.entries%rowtype;
  selected_rule public.round_rules%rowtype;
  selected_round public.rounds%rowtype;
begin
  select * into selected_entry from public.entries where id = new.entry_id;
  select * into selected_rule from public.round_rules where id = new.rule_id;
  select * into selected_round from public.rounds where id = selected_entry.round_id;

  if selected_entry.id is null or selected_rule.id is null then
    raise exception 'ENTRY_OR_RULE_NOT_FOUND';
  end if;
  if selected_entry.status <> 'draft' then
    raise exception 'ENTRY_NOT_EDITABLE';
  end if;
  if selected_rule.round_id <> selected_entry.round_id or not selected_rule.is_active then
    raise exception 'RULE_NOT_AVAILABLE_FOR_ROUND';
  end if;
  if selected_round.status <> 'open' or now() < selected_round.opens_at or now() >= selected_round.closes_at then
    raise exception 'ROUND_NOT_OPEN';
  end if;
  if char_length(new.number_text) <> selected_rule.digits then
    raise exception 'INVALID_NUMBER_LENGTH';
  end if;
  if new.amount < selected_rule.min_amount or new.amount > selected_rule.max_amount then
    raise exception 'AMOUNT_OUT_OF_RANGE';
  end if;
  return new;
end;
$function$;

create or replace function private.refresh_entry_total()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare target_entry_id uuid;
begin
  target_entry_id := coalesce(new.entry_id, old.entry_id);
  update public.entries
  set total_amount = coalesce((select sum(amount) from public.entry_items where entry_id = target_entry_id), 0),
      updated_at = now()
  where id = target_entry_id;
  return coalesce(new, old);
end;
$function$;

revoke all on function private.validate_entry_item() from public;
grant execute on function private.validate_entry_item() to authenticated;
revoke all on function private.refresh_entry_total() from public;

create trigger validate_entry_item_before_write
before insert or update on public.entry_items
for each row execute function private.validate_entry_item();

create trigger refresh_entry_total_after_write
after insert or update or delete on public.entry_items
for each row execute function private.refresh_entry_total();

alter table public.round_rules enable row level security;
alter table public.entries enable row level security;
alter table public.entry_items enable row level security;

create policy round_rules_select_open on public.round_rules for select to authenticated
using (
  is_active and exists (
    select 1 from public.rounds r
    where r.id = round_id and r.status = 'open' and now() >= r.opens_at and now() < r.closes_at
  )
);
create policy entries_select_own on public.entries for select to authenticated
using ((select auth.uid()) = user_id);
create policy entries_insert_own_draft on public.entries for insert to authenticated
with check ((select auth.uid()) = user_id and status = 'draft');
create policy entries_update_own_draft on public.entries for update to authenticated
using ((select auth.uid()) = user_id and status = 'draft')
with check ((select auth.uid()) = user_id and status in ('draft', 'cancelled'));
create policy entries_delete_own_draft on public.entries for delete to authenticated
using ((select auth.uid()) = user_id and status = 'draft');
create policy entry_items_select_own on public.entry_items for select to authenticated
using (exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid())));
create policy entry_items_insert_own_draft on public.entry_items for insert to authenticated
with check (exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid()) and e.status = 'draft'));
create policy entry_items_update_own_draft on public.entry_items for update to authenticated
using (exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid()) and e.status = 'draft'))
with check (exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid()) and e.status = 'draft'));
create policy entry_items_delete_own_draft on public.entry_items for delete to authenticated
using (exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid()) and e.status = 'draft'));

revoke all on public.round_rules, public.entries, public.entry_items from anon, authenticated;
grant select on public.round_rules to authenticated;
grant select on public.entries to authenticated;
grant insert (round_id, status, note) on public.entries to authenticated;
grant update (status, note) on public.entries to authenticated;
grant delete on public.entries to authenticated;
grant select, insert, update, delete on public.entry_items to authenticated;

insert into public.round_rules (round_id, entry_type, display_name, digits, min_amount, max_amount, sort_order)
select r.id, rule.entry_type, rule.display_name, rule.digits, 1, 1000, rule.sort_order
from public.rounds r
cross join (values
  ('three_straight', '3 ตัวตรง', 3, 10),
  ('three_permutation', '3 ตัวโต๊ด', 3, 20),
  ('two_top', '2 ตัวบน', 2, 30),
  ('two_bottom', '2 ตัวล่าง', 2, 40)
) as rule(entry_type, display_name, digits, sort_order)
where r.status = 'open'
on conflict (round_id, entry_type) do nothing;

