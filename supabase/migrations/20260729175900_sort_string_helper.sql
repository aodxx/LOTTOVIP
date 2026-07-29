create or replace function public.sort_string(input text) returns text
language sql immutable strict security invoker set search_path=''
as $function$
  select string_agg(ch,'' order by ch) from regexp_split_to_table(input,'') ch;
$function$;
revoke all on function public.sort_string(text) from public,anon,authenticated;

