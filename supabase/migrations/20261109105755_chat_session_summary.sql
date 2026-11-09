create or replace function public.update_chat_summary(session_id uuid, access_token text, next_summary text, summarized_messages integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(next_summary) > 4000 or summarized_messages < 0 or not private.valid_chat_token(session_id, access_token) then
    raise exception 'Riepilogo non valido' using errcode = '22023';
  end if;
  update private.chat_sessions
  set summary = next_summary, summary_message_count = summarized_messages, updated_at = now()
  where id = session_id and summary_message_count <= summarized_messages;
  if not found then
    raise exception 'Riepilogo non aggiornabile' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.update_chat_summary(uuid,text,text,integer) from public;
grant execute on function public.update_chat_summary(uuid,text,text,integer) to anon, authenticated;
