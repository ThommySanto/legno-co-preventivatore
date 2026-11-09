-- Blocco 2: restituisce esclusivamente i messaggi non inclusi nel riepilogo.
-- La posizione nel flusso della sessione e' usata invece di un filtro sul testo.
create or replace function public.read_chat_memory(session_id uuid, access_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'summary', s.summary,
    'summaryMessageCount', s.summary_message_count,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('role', recent.role, 'content', recent.content, 'id', recent.id) order by recent.id)
      from (
        select m.id, m.role, m.content,
          row_number() over (order by m.id) as message_number
        from private.chat_messages m
        where m.session_id = s.id
      ) recent
      where recent.message_number > s.summary_message_count
    ), '[]'::jsonb)
  )
  from private.chat_sessions s
  where s.id = session_id and private.valid_chat_token(session_id, access_token);
$$;
revoke all on function public.read_chat_memory(uuid,text) from public;
grant execute on function public.read_chat_memory(uuid,text) to anon, authenticated;
