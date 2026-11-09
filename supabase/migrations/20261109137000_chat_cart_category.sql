create or replace function public.read_chat_cart(session_id uuid, access_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('row', c.row_number, 'id', c.id, 'productId', c.product_id, 'name', p.name, 'category', p.category, 'widthCm', c.width_cm, 'heightCm', c.height_cm, 'depthCm', c.depth_cm, 'wood', c.wood, 'finish', c.finish, 'quantity', c.quantity) order by c.row_number), '[]'::jsonb)
  from (select c.*, row_number() over (order by c.id) from private.chat_cart_items c where c.session_id = $1) c
  join public.product_catalog p on p.id = c.product_id
  where private.valid_chat_token($1, $2);
$$;

create or replace function public.add_chat_cart_item(session_id uuid, access_token text, product_id text, width_cm numeric, height_cm numeric, depth_cm numeric, wood text, finish text, quantity integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare product_row public.product_catalog%rowtype; item_id bigint; item jsonb;
begin
  if not private.valid_chat_token($1, $2) then raise exception 'Sessione non trovata'; end if;
  select pc.* into product_row from public.product_catalog pc where pc.id = $3 and pc.active;
  if not found then raise exception 'Prodotto non trovato'; end if;
  if $9 not between 1 and 20 then raise exception 'La quantità deve essere tra 1 e 20'; end if;
  if $4 < (product_row.min_dimensions->>'larghezza')::numeric or $4 > (product_row.max_dimensions->>'larghezza')::numeric or $5 < (product_row.min_dimensions->>'altezza')::numeric or $5 > (product_row.max_dimensions->>'altezza')::numeric or $6 < (product_row.min_dimensions->>'profondita')::numeric or $6 > (product_row.max_dimensions->>'profondita')::numeric then raise exception 'Misure fuori dai limiti del prodotto'; end if;
  if not exists (select 1 from jsonb_array_elements_text(product_row.allowed_woods) w where w = $7) then raise exception 'Legno non ammesso per il prodotto'; end if;
  if not exists (select 1 from public.finishes where active and name = $8) then raise exception 'Finitura non valida'; end if;
  insert into private.chat_cart_items(session_id, product_id, width_cm, height_cm, depth_cm, wood, finish, quantity) values ($1,$3,$4,$5,$6,$7,$8,$9) returning id into item_id;
  select jsonb_build_object('id', c.id, 'productId', c.product_id, 'name', pc.name, 'category', pc.category, 'widthCm', c.width_cm, 'heightCm', c.height_cm, 'depthCm', c.depth_cm, 'wood', c.wood, 'finish', c.finish, 'quantity', c.quantity) into item from private.chat_cart_items c join public.product_catalog pc on pc.id=c.product_id where c.id=item_id;
  return item;
end;
$$;
