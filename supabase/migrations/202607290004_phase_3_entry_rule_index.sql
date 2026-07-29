-- Cover the entry_items.rule_id foreign key for rule lookups and deletes.
create index entry_items_rule_idx on public.entry_items (rule_id);
