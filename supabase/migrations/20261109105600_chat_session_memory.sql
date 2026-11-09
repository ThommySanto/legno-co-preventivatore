-- Blocco 2: memoria conversazionale senza account cliente.
-- Il token casuale della sessione e' una capability: non viene mai salvato in chiaro.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.chat_sessions (
  id uuid primary key,
  access_token_hash text not null check (access_token_hash ~ '^[0-9a-f]{64}$'),
  summary text not null default '' check (char_length(summary) <= 4000),
  summary_message_count integer not null default 0 check (summary_message_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.chat_sessions enable row level security;
revoke all on private.chat_sessions from public, anon, authenticated;

create table private.chat_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references private.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index chat_messages_session_id_id_idx on private.chat_messages(session_id, id);
alter table private.chat_messages enable row level security;
revoke all on private.chat_messages from public, anon, authenticated;

create function private.valid_chat_token(session_id uuid, access_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select session_id is not null
    and access_token ~ '^[0-9a-f]{64}$'
    and exists (
      select 1 from private.chat_sessions s
      where s.id = session_id
        and s.access_token_hash = encode(extensions.digest(access_token, 'sha256'), 'hex')
    );
$$;
revoke all on function private.valid_chat_token(uuid,text) from public, anon, authenticated;

create function public.open_chat_session(session_id uuid, access_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if session_id is null or access_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Sessione non valida' using errcode = '22023';
  end if;
  insert into private.chat_sessions(id, access_token_hash)
  values (session_id, encode(extensions.digest(access_token, 'sha256'), 'hex'));
end;
$$;

create function public.read_chat_memory(session_id uuid, access_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'summary', s.summary,
    'summaryMessageCount', s.summary_message_count,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content, 'id', m.id) order by m.id)
      from (
        select m.id, m.role, m.content
        from private.chat_messages m
        where m.session_id = s.id
        order by m.id
        offset s.summary_message_count
      ) m
    ), '[]'::jsonb)
  )
  from private.chat_sessions s
  where s.id = session_id and private.valid_chat_token(session_id, access_token);
$$;

create function public.append_chat_message(session_id uuid, access_token text, message_role text, message_content text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if message_role not in ('user', 'assistant') or char_length(message_content) not between 1 and 4000 then
    raise exception 'Messaggio non valido' using errcode = '22023';
  end if;
  if not private.valid_chat_token(session_id, access_token) then
    raise exception 'Sessione non trovata' using errcode = '42501';
  end if;
  insert into private.chat_messages(session_id, role, content) values (session_id, message_role, message_content);
  update private.chat_sessions set updated_at = now() where id = session_id;
end;
$$;

create function public.update_chat_summary(session_id uuid, access_token text, next_summary text, summarized_messages integer) returns void
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

revoke all on function public.open_chat_session(uuid,text) from public;
revoke all on function public.read_chat_memory(uuid,text) from public;
revoke all on function public.append_chat_message(uuid,text,text,text) from public;
revoke all on function public.update_chat_summary(uuid,text,text,integer) from public;
grant execute on function public.open_chat_session(uuid,text) to anon, authenticated;
grant execute on function public.read_chat_memory(uuid,text) to anon, authenticated;
grant execute on function public.append_chat_message(uuid,text,text,text) to anon, authenticated;
grant execute on function public.update_chat_summary(uuid,text,text,integer) to anon, authenticated;
