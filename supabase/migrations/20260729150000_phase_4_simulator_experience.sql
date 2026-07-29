-- Phase 4: multi-category lottery simulator and atomic credit submission.
-- This project uses non-withdrawable simulation credits only.

alter table public.entries
  add column if not exists submitted_at timestamptz,
  add column if not exists reference_code text;

create unique index if not exists entries_reference_code_unique
  on public.entries (reference_code) where reference_code is not null;

-- Tighten direct table privileges. RLS remains the row-level boundary.
revoke all on public.rounds, public.wallets, public.wallet_ledger from anon, authenticated;
grant select on public.rounds, public.wallets, public.wallet_ledger to authenticated;

revoke update on public.entries from authenticated;
grant update (note) on public.entries to authenticated;

create or replace function public.submit_simulation_entry(p_entry_id uuid)
returns table (
  entry_id uuid,
  reference_code text,
  total_amount numeric,
  balance_after numeric,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  selected_entry public.entries%rowtype;
  selected_round public.rounds%rowtype;
  selected_wallet public.wallets%rowtype;
  calculated_total numeric(14,2);
  generated_reference text;
  submitted_time timestamptz := clock_timestamp();
begin
  if caller_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into selected_entry
  from public.entries
  where id = p_entry_id and user_id = caller_id
  for update;

  if selected_entry.id is null then
    raise exception 'ENTRY_NOT_FOUND';
  end if;

  if selected_entry.status = 'submitted' then
    return query
      select selected_entry.id, selected_entry.reference_code,
             selected_entry.total_amount, w.balance, selected_entry.submitted_at
      from public.wallets w
      where w.user_id = caller_id;
    return;
  end if;

  if selected_entry.status <> 'draft' then
    raise exception 'ENTRY_NOT_SUBMITTABLE';
  end if;

  select * into selected_round
  from public.rounds
  where id = selected_entry.round_id;

  if selected_round.status <> 'open'
     or now() < selected_round.opens_at
     or now() >= selected_round.closes_at then
    raise exception 'ROUND_NOT_OPEN';
  end if;

  select coalesce(sum(i.amount), 0)
  into calculated_total
  from public.entry_items i
  where i.entry_id = selected_entry.id;

  if calculated_total <= 0 then
    raise exception 'ENTRY_EMPTY';
  end if;

  select * into selected_wallet
  from public.wallets
  where user_id = caller_id
  for update;

  if selected_wallet.user_id is null then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  if selected_wallet.balance < calculated_total then
    raise exception 'INSUFFICIENT_SIMULATION_CREDITS';
  end if;

  generated_reference :=
    'SIM-' || to_char(submitted_time at time zone 'Asia/Bangkok', 'YYYYMMDD-HH24MISS')
    || '-' || upper(substr(replace(selected_entry.id::text, '-', ''), 1, 6));

  update public.wallets
  set balance = balance - calculated_total,
      updated_at = submitted_time
  where user_id = caller_id;

  update public.entries
  set status = 'submitted',
      total_amount = calculated_total,
      reference_code = generated_reference,
      submitted_at = submitted_time,
      updated_at = submitted_time
  where id = selected_entry.id;

  insert into public.wallet_ledger
    (user_id, entry_type, amount, balance_after, description)
  values
    (caller_id, 'debit', -calculated_total,
     selected_wallet.balance - calculated_total,
     'ใช้เครดิตจำลอง ' || generated_reference);

  return query
    select selected_entry.id, generated_reference, calculated_total,
           selected_wallet.balance - calculated_total, submitted_time;
end;
$function$;

revoke all on function public.submit_simulation_entry(uuid) from public, anon;
grant execute on function public.submit_simulation_entry(uuid) to authenticated;

create index if not exists entries_user_status_updated_idx
  on public.entries (user_id, status, updated_at desc);

-- Seed representative simulation rounds. Times are intentionally long-lived
-- so the mobile UI can be tested without an external result provider.
insert into public.rounds (code, title, category, status, opens_at, closes_at)
values
  ('THAI-DEMO-001', 'รัฐบาลไทย - รอบจำลอง', 'thai', 'open', now() - interval '1 hour', now() + interval '30 days'),
  ('YEEKEE-DEMO-001', 'ยี่กี รอบ 1 - จำลอง', 'yeekee', 'open', now() - interval '1 hour', now() + interval '30 days'),
  ('LAO-DEMO-001', 'ลาวพัฒนา - รอบจำลอง', 'lao', 'open', now() - interval '1 hour', now() + interval '30 days'),
  ('HANOI-DEMO-001', 'ฮานอยพิเศษ - รอบจำลอง', 'hanoi', 'open', now() - interval '1 hour', now() + interval '30 days')
on conflict (code) do update
set title = excluded.title,
    category = excluded.category,
    status = 'open',
    opens_at = least(public.rounds.opens_at, now()),
    closes_at = greatest(public.rounds.closes_at, now() + interval '30 days');

insert into public.round_rules
  (round_id, entry_type, display_name, digits, min_amount, max_amount, sort_order)
select r.id, rule.entry_type, rule.display_name, rule.digits, 1, 1000, rule.sort_order
from public.rounds r
cross join (values
  ('three_straight', '3 ตัวตรง', 3, 10),
  ('three_permutation', '3 ตัวโต๊ด', 3, 20),
  ('two_top', '2 ตัวบน', 2, 30),
  ('two_bottom', '2 ตัวล่าง', 2, 40)
) as rule(entry_type, display_name, digits, sort_order)
where r.code in ('THAI-DEMO-001', 'YEEKEE-DEMO-001', 'LAO-DEMO-001', 'HANOI-DEMO-001')
on conflict (round_id, entry_type) do update
set display_name = excluded.display_name,
    digits = excluded.digits,
    min_amount = excluded.min_amount,
    max_amount = excluded.max_amount,
    sort_order = excluded.sort_order,
    is_active = true;
