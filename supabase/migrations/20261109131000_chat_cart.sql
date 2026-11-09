-- Blocco 4: carrello privato associato alla sessione anonima.
create table private.chat_cart_items (
  id bigint generated always as identity primary key,
  session_id uuid not null references private.chat_sessions(id) on delete cascade,
  product_id text not null references public.product_catalog(id),
  width_cm numeric(10,2) not null,
  height_cm numeric(10,2) not null,
  depth_cm numeric(10,2) not null,
  wood text not null,
  finish text not null,
  quantity integer not null check (quantity between 1 and 20),
  created_at timestamptz not null default now()
);
alter table private.chat_cart_items enable row level security;
revoke all on private.chat_cart_items from public, anon, authenticated;

create or replace function public.search_product_catalog(search_text text default '', search_category text default '') returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]'::jsonb)
  from (
    select id, name, category, min_dimensions as "minDimensions", max_dimensions as "maxDimensions", allowed_woods as "allowedWoods", delivery_days as "deliveryDays", typical_dimensions as "typicalDimensions", description
    from public.product_catalog
    where active and (coalesce(search_text, '') = '' or name ilike '%' || search_text || '%' or description ilike '%' || search_text || '%')
      and (coalesce(search_category, '') = '' or category = search_category)
    order by id limit 8
  ) p;
$$;
revoke all on function public.search_product_catalog(text,text) from public;
grant execute on function public.search_product_catalog(text,text) to anon, authenticated;

create or replace function public.add_chat_cart_item(session_id uuid, access_token text, product_id text, width_cm numeric, height_cm numeric, depth_cm numeric, wood text, finish text, quantity integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.product_catalog%rowtype; item jsonb;
begin
  if not private.valid_chat_token(session_id, access_token) then raise exception 'Sessione non trovata'; end if;
  select * into p from public.product_catalog where id = product_id and active;
  if not found then raise exception 'Prodotto non trovato'; end if;
  if quantity not between 1 and 20 then raise exception 'La quantità deve essere tra 1 e 20'; end if;
  if width_cm < (p.min_dimensions->>'larghezza')::numeric or width_cm > (p.max_dimensions->>'larghezza')::numeric
     or height_cm < (p.min_dimensions->>'altezza')::numeric or height_cm > (p.max_dimensions->>'altezza')::numeric
     or depth_cm < (p.min_dimensions->>'profondita')::numeric or depth_cm > (p.max_dimensions->>'profondita')::numeric then
    raise exception 'Misure fuori dai limiti del prodotto';
  end if;
  if not exists (select 1 from jsonb_array_elements_text(p.allowed_woods) w where w = wood) then raise exception 'Legno non ammesso per il prodotto'; end if;
  if not exists (select 1 from public.finishes where active and name = finish) then raise exception 'Finitura non valida'; end if;
  insert into private.chat_cart_items(session_id, product_id, width_cm, height_cm, depth_cm, wood, finish, quantity)
  values (session_id, product_id, width_cm, height_cm, depth_cm, wood, finish, quantity)
  returning jsonb_build_object('id', id, 'productId', product_id, 'name', p.name, 'widthCm', width_cm, 'heightCm', height_cm, 'depthCm', depth_cm, 'wood', wood, 'finish', finish, 'quantity', quantity) into item;
  return item;
end;
$$;

create or replace function public.read_chat_cart(session_id uuid, access_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('row', c.row_number, 'id', c.id, 'productId', c.product_id, 'name', p.name, 'widthCm', c.width_cm, 'heightCm', c.height_cm, 'depthCm', c.depth_cm, 'wood', c.wood, 'finish', c.finish, 'quantity', c.quantity) order by c.row_number), '[]'::jsonb)
  from (select c.*, row_number() over (order by c.id) from private.chat_cart_items c where c.session_id = $1) c
  join public.product_catalog p on p.id = c.product_id
  where private.valid_chat_token($1, $2);
$$;

create or replace function public.remove_chat_cart_item(session_id uuid, access_token text, row_number integer) returns void
language plpgsql security definer set search_path = '' as $$
declare target_id bigint;
begin
  if not private.valid_chat_token(session_id, access_token) then raise exception 'Sessione non trovata'; end if;
  select id into target_id from (select id, row_number() over (order by id) as n from private.chat_cart_items where chat_cart_items.session_id = $1) x where n = row_number;
  if target_id is null then raise exception 'Riga carrello non trovata'; end if;
  delete from private.chat_cart_items where id = target_id;
end;
$$;

create or replace function public.clear_chat_cart(session_id uuid, access_token text, confirmed boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not confirmed then raise exception 'Conferma richiesta'; end if;
  if not private.valid_chat_token(session_id, access_token) then raise exception 'Sessione non trovata'; end if;
  delete from private.chat_cart_items where chat_cart_items.session_id = $1;
end;
$$;

revoke all on function public.add_chat_cart_item(uuid,text,text,numeric,numeric,numeric,text,text,integer) from public;
revoke all on function public.read_chat_cart(uuid,text) from public;
revoke all on function public.remove_chat_cart_item(uuid,text,integer) from public;
revoke all on function public.clear_chat_cart(uuid,text,boolean) from public;
grant execute on function public.add_chat_cart_item(uuid,text,text,numeric,numeric,numeric,text,text,integer), public.read_chat_cart(uuid,text), public.remove_chat_cart_item(uuid,text,integer), public.clear_chat_cart(uuid,text,boolean) to anon, authenticated;
