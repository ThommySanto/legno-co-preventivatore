create or replace function public.add_chat_cart_item(session_id uuid, access_token text, product_id text, width_cm numeric, height_cm numeric, depth_cm numeric, wood text, finish text, quantity integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.product_catalog%rowtype; item_id bigint; item jsonb;
begin
  if not private.valid_chat_token($1, $2) then raise exception 'Sessione non trovata'; end if;
  select * into p from public.product_catalog where id = $3 and active;
  if not found then raise exception 'Prodotto non trovato'; end if;
  if $9 not between 1 and 20 then raise exception 'La quantità deve essere tra 1 e 20'; end if;
  if $4 < (p.min_dimensions->>'larghezza')::numeric or $4 > (p.max_dimensions->>'larghezza')::numeric or $5 < (p.min_dimensions->>'altezza')::numeric or $5 > (p.max_dimensions->>'altezza')::numeric or $6 < (p.min_dimensions->>'profondita')::numeric or $6 > (p.max_dimensions->>'profondita')::numeric then raise exception 'Misure fuori dai limiti del prodotto'; end if;
  if not exists (select 1 from jsonb_array_elements_text(p.allowed_woods) w where w = $7) then raise exception 'Legno non ammesso per il prodotto'; end if;
  if not exists (select 1 from public.finishes where active and name = $8) then raise exception 'Finitura non valida'; end if;
  insert into private.chat_cart_items(session_id, product_id, width_cm, height_cm, depth_cm, wood, finish, quantity) values ($1,$3,$4,$5,$6,$7,$8,$9) returning id into item_id;
  select jsonb_build_object('id', c.id, 'productId', c.product_id, 'name', p.name, 'widthCm', c.width_cm, 'heightCm', c.height_cm, 'depthCm', c.depth_cm, 'wood', c.wood, 'finish', c.finish, 'quantity', c.quantity) into item from private.chat_cart_items c join public.product_catalog p on p.id=c.product_id where c.id=item_id;
  return item;
end;
$$;
revoke all on function public.add_chat_cart_item(uuid,text,text,numeric,numeric,numeric,text,text,integer) from public;
grant execute on function public.add_chat_cart_item(uuid,text,text,numeric,numeric,numeric,text,text,integer) to anon, authenticated;
