create or replace function public.log_chat_event(p_session_id uuid, p_access_token text, p_event_type text, p_input_chars integer default 0, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = private, public
as $$
begin
  if not private.valid_chat_token(p_session_id, p_access_token) then raise exception 'Sessione non trovata'; end if;
  insert into private.chat_events(session_id, event_type, input_chars, metadata)
  values (p_session_id, p_event_type, greatest(0, least(coalesce(p_input_chars, 0), 5000)), coalesce(p_metadata, '{}'::jsonb));
end;
$$;
