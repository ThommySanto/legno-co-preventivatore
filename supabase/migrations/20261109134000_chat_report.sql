create or replace function public.get_chat_report()
returns jsonb language plpgsql security definer set search_path = private, public
as $$
declare result jsonb;
begin
  if not private.is_catalog_admin() then raise exception 'Accesso amministratore richiesto' using errcode = '42501'; end if;
  select jsonb_build_object(
    'periodo', jsonb_build_object('da', min(e.created_at), 'a', max(e.created_at)),
    'kpi', jsonb_build_object('messaggi', count(*) filter (where e.event_type = 'message'), 'sessioni', count(distinct e.session_id), 'caratteri_medi', coalesce(round(avg(e.input_chars) filter (where e.event_type = 'message')), 0), 'modifiche_carrello', count(*) filter (where e.event_type = 'cart_change'), 'preventivi', count(*) filter (where e.event_type = 'quote')),
    'giorni', coalesce((select jsonb_agg(jsonb_build_object('giorno', giorno, 'messaggi', messaggi) order by giorno) from (select date(e2.created_at) as giorno, count(*)::integer as messaggi from private.chat_events e2 where e2.event_type = 'message' group by date(e2.created_at)) daily), '[]'::jsonb)
  ) into result from private.chat_events e;
  return coalesce(result, '{"kpi":{"messaggi":0,"sessioni":0,"caratteri_medi":0,"modifiche_carrello":0,"preventivi":0},"giorni":[]}'::jsonb);
end;
$$;
revoke all on function public.get_chat_report() from public, anon;
grant execute on function public.get_chat_report() to authenticated;
