create or replace function public.calculate_chat_quote(session_id uuid, access_token text, delivery text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item record; wood_price numeric; finish_price numeric; delivery_price numeric; area numeric; net numeric := 0; vat numeric; total numeric; lines jsonb := '[]'::jsonb;
begin
  if not private.valid_chat_token($1, $2) then raise exception 'Sessione non trovata'; end if;
  select price into delivery_price from public.delivery_options where active and name = $3;
  if delivery_price is null then raise exception 'Consegna non valida'; end if;
  for item in select c.*, p.name from private.chat_cart_items c join public.product_catalog p on p.id=c.product_id where c.session_id=$1 order by c.id loop
    select price_per_m2 into wood_price from public.woods where active and name=item.wood;
    select price_per_m2 into finish_price from public.finishes where active and name=item.finish;
    if wood_price is null or finish_price is null then raise exception 'Listino non valido'; end if;
    area := 2 * (item.width_cm*item.height_cm + item.width_cm*item.depth_cm + item.height_cm*item.depth_cm) / 10000;
    net := net + round(area * (wood_price + finish_price), 2) * item.quantity;
    lines := lines || jsonb_build_array(jsonb_build_object('name',item.name,'quantity',item.quantity,'areaM2',round(area,4),'amount',round(area*(wood_price+finish_price),2)*item.quantity));
  end loop;
  net := round(net + delivery_price, 2);
  select vat_rate into vat from public.pricing_settings where id=1;
  total := round(net + round(net*vat,2),2);
  return jsonb_build_object('lines',lines,'delivery',delivery,'net',net,'vat',round(net*vat,2),'total',total);
end;
$$;
revoke all on function public.calculate_chat_quote(uuid,text,text) from public;
grant execute on function public.calculate_chat_quote(uuid,text,text) to anon, authenticated;
