-- Phase 5: simulated results, winner matching and idempotent settlement.
-- Credits are for simulation only and cannot be exchanged for money.
alter table public.round_rules add column if not exists payout_multiplier numeric(12,2) not null default 1 check (payout_multiplier >= 0);
update public.round_rules set payout_multiplier = case entry_type when 'three_straight' then 500 when 'three_permutation' then 100 when 'two_top' then 70 when 'two_bottom' then 70 else 1 end;

alter table public.entries drop constraint if exists entries_status_check;
alter table public.entries add constraint entries_status_check check (status = any (array['draft','submitted','settled','cancelled']));
alter table public.entries add column if not exists prize_amount numeric(14,2) not null default 0 check (prize_amount >= 0);
alter table public.entries add column if not exists settled_at timestamptz;
alter table public.entry_items add column if not exists is_winner boolean;
alter table public.entry_items add column if not exists payout_amount numeric(14,2) check (payout_amount is null or payout_amount >= 0);
alter table public.wallet_ledger add column if not exists settlement_key text;
create unique index if not exists wallet_ledger_settlement_key_unique on public.wallet_ledger(settlement_key) where settlement_key is not null;

create table if not exists public.round_results (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null unique references public.rounds(id) on delete restrict,
  first_prize text not null check (first_prize ~ '^[0-9]{6}$'),
  two_bottom text not null check (two_bottom ~ '^[0-9]{2}$'),
  published_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz not null default now(),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.round_results enable row level security;
revoke all on public.round_results from anon, authenticated;
grant select on public.round_results to authenticated;
drop policy if exists "Authenticated users read simulated results" on public.round_results;
create policy "Authenticated users read simulated results" on public.round_results for select to authenticated using (true);

create or replace function private.validate_entry_item()
returns trigger language plpgsql set search_path=''
as $function$
declare selected_entry public.entries%rowtype; selected_rule public.round_rules%rowtype; selected_round public.rounds%rowtype;
begin
  select * into selected_entry from public.entries where id=new.entry_id;
  select * into selected_rule from public.round_rules where id=new.rule_id;
  select * into selected_round from public.rounds where id=selected_entry.round_id;
  if selected_entry.id is null or selected_rule.id is null then raise exception 'ENTRY_OR_RULE_NOT_FOUND'; end if;
  if tg_op='UPDATE' and selected_entry.status='submitted'
    and new.entry_id=old.entry_id and new.rule_id=old.rule_id
    and new.number_text=old.number_text and new.amount=old.amount then return new;
  end if;
  if selected_entry.status<>'draft' then raise exception 'ENTRY_NOT_EDITABLE'; end if;
  if selected_rule.round_id<>selected_entry.round_id or not selected_rule.is_active then raise exception 'RULE_NOT_AVAILABLE_FOR_ROUND'; end if;
  if selected_round.status<>'open' or now()<selected_round.opens_at or now()>=selected_round.closes_at then raise exception 'ROUND_NOT_OPEN'; end if;
  if char_length(new.number_text)<>selected_rule.digits then raise exception 'INVALID_NUMBER_LENGTH'; end if;
  if new.amount<selected_rule.min_amount or new.amount>selected_rule.max_amount then raise exception 'AMOUNT_OUT_OF_RANGE'; end if;
  return new;
end;$function$;

create or replace function public.publish_simulation_result(p_round_id uuid,p_first_prize text,p_two_bottom text)
returns table(round_id uuid,settled_entries integer,winning_entries integer,total_prize numeric,settled_at timestamptz)
language plpgsql security definer set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid(); caller_role text;
  selected_round public.rounds%rowtype; result_row public.round_results%rowtype;
  settlement_time timestamptz := clock_timestamp();
  settled_count integer := 0; winner_count integer := 0; prize_total numeric(14,2) := 0;
  current_entry record; new_balance numeric(14,2);
begin
  if caller_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into caller_role from public.profiles where id=caller_id;
  if caller_role <> 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_first_prize !~ '^[0-9]{6}$' or p_two_bottom !~ '^[0-9]{2}$' then raise exception 'INVALID_RESULT_FORMAT'; end if;
  select * into selected_round from public.rounds where id=p_round_id for update;
  if selected_round.id is null then raise exception 'ROUND_NOT_FOUND'; end if;
  select * into result_row from public.round_results where round_results.round_id=p_round_id for update;
  if result_row.id is not null and result_row.settled_at is not null then
    return query select p_round_id,count(*)::integer,count(*) filter(where e.prize_amount>0)::integer,
      coalesce(sum(e.prize_amount),0),result_row.settled_at from public.entries e where e.round_id=p_round_id and e.status='settled';
    return;
  end if;
  insert into public.round_results(round_id,first_prize,two_bottom,published_by,published_at)
  values(p_round_id,p_first_prize,p_two_bottom,caller_id,settlement_time)
  on conflict on constraint round_results_round_id_key do update set first_prize=excluded.first_prize,two_bottom=excluded.two_bottom,published_by=excluded.published_by,published_at=excluded.published_at
  where public.round_results.settled_at is null returning * into result_row;

  update public.entry_items i set
    is_winner=case rr.entry_type
      when 'three_straight' then i.number_text=right(p_first_prize,3)
      when 'three_permutation' then public.sort_string(i.number_text)=public.sort_string(right(p_first_prize,3))
      when 'two_top' then i.number_text=right(p_first_prize,2)
      when 'two_bottom' then i.number_text=p_two_bottom else false end,
    payout_amount=case when case rr.entry_type
      when 'three_straight' then i.number_text=right(p_first_prize,3)
      when 'three_permutation' then public.sort_string(i.number_text)=public.sort_string(right(p_first_prize,3))
      when 'two_top' then i.number_text=right(p_first_prize,2)
      when 'two_bottom' then i.number_text=p_two_bottom else false end
      then round(i.amount*rr.payout_multiplier,2) else 0 end
  from public.round_rules rr,public.entries e
  where i.rule_id=rr.id and i.entry_id=e.id and e.round_id=p_round_id and e.status='submitted';

  perform 1 from public.entries e where e.round_id=p_round_id and e.status='submitted' for update;
  for current_entry in select e.id,e.user_id,coalesce(sum(i.payout_amount),0)::numeric(14,2) prize
    from public.entries e join public.entry_items i on i.entry_id=e.id
    where e.round_id=p_round_id and e.status='submitted' group by e.id,e.user_id
  loop
    update public.entries set status='settled',prize_amount=current_entry.prize,settled_at=settlement_time,updated_at=settlement_time where id=current_entry.id;
    settled_count:=settled_count+1;
    if current_entry.prize>0 then
      update public.wallets set balance=balance+current_entry.prize,updated_at=settlement_time where user_id=current_entry.user_id returning balance into new_balance;
      insert into public.wallet_ledger(user_id,entry_type,amount,balance_after,description,settlement_key)
      values(current_entry.user_id,'credit',current_entry.prize,new_balance,'รางวัลเครดิตจำลอง '||current_entry.id::text,'round:'||p_round_id::text||':entry:'||current_entry.id::text)
      on conflict(settlement_key) where settlement_key is not null do nothing;
      winner_count:=winner_count+1; prize_total:=prize_total+current_entry.prize;
    end if;
  end loop;
  update public.round_results set settled_at=settlement_time where id=result_row.id;
  update public.rounds set status='settled' where id=p_round_id;
  return query select p_round_id,settled_count,winner_count,prize_total,settlement_time;
end;$function$;

revoke all on function public.publish_simulation_result(uuid,text,text) from public,anon,authenticated;
grant execute on function public.publish_simulation_result(uuid,text,text) to authenticated;
grant select(payout_multiplier) on public.round_rules to authenticated;
grant select(prize_amount,settled_at) on public.entries to authenticated;
grant select(is_winner,payout_amount) on public.entry_items to authenticated;
create index if not exists round_results_published_by_idx on public.round_results(published_by);
