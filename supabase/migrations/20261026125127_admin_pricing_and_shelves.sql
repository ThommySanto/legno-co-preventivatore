-- The allowlist lives outside the exposed API schema. Provision addresses separately.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table private.catalog_admins (email text primary key check (email = lower(trim(email))));
alter table private.catalog_admins enable row level security;
revoke all on private.catalog_admins from public, anon, authenticated;

-- A narrowly scoped lookup needs access to auth.users; never trust user-editable metadata.
create function private.is_catalog_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from auth.users u join private.catalog_admins a on lower(u.email) = a.email
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous, false) and (u.banned_until is null or u.banned_until < now())
  );
$$;
revoke all on function private.is_catalog_admin() from public, anon;
grant execute on function private.is_catalog_admin() to authenticated;
create function public.is_catalog_admin() returns boolean
language sql stable security invoker set search_path = '' as $$ select private.is_catalog_admin(); $$;
revoke all on function public.is_catalog_admin() from public, anon;
grant execute on function public.is_catalog_admin() to authenticated;

alter table public.pricing_settings
  add column revision integer not null default 0 check (revision >= 0),
  add column updated_at timestamptz,
  add column shelf_thickness_cm numeric(6,4) not null default 2 check (shelf_thickness_cm between 0.1 and 10),
  add column max_shelves integer not null default 12 check (max_shelves between 0 and 24),
  add constraint shelves_fit_smallest_dimension check (min_dimension_cm > 2 * shelf_thickness_cm);

grant update (price_per_m2) on public.woods, public.finishes to authenticated;
grant update (price) on public.delivery_options to authenticated;
grant update (version, revision, updated_at, vat_rate, min_dimension_cm, max_dimension_cm, shelf_thickness_cm, max_shelves) on public.pricing_settings to authenticated;
create policy "Admin updates wood prices" on public.woods for update to authenticated
  using ((select private.is_catalog_admin())) with check ((select private.is_catalog_admin()));
create policy "Admin updates finish prices" on public.finishes for update to authenticated
  using ((select private.is_catalog_admin())) with check ((select private.is_catalog_admin()));
create policy "Admin updates delivery prices" on public.delivery_options for update to authenticated
  using ((select private.is_catalog_admin())) with check ((select private.is_catalog_admin()));
create policy "Admin updates settings" on public.pricing_settings for update to authenticated
  using ((select private.is_catalog_admin())) with check ((select private.is_catalog_admin()));

create or replace function public.get_pricing_catalog() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'version', s.version, 'revision', s.revision, 'updatedAt', s.updated_at,
    'woods', coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'description',w.description,'pricePerM2',w.price_per_m2,'color',w.color) order by w.sort_order,w.id) from public.woods w where w.active), '[]'::jsonb),
    'finishes', coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'description',f.description,'pricePerM2',f.price_per_m2) order by f.sort_order,f.id) from public.finishes f where f.active), '[]'::jsonb),
    'deliveries', coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'description',d.description,'price',d.price) order by d.sort_order,d.id) from public.delivery_options d where d.active), '[]'::jsonb),
    'settings', jsonb_build_object('vatRate',s.vat_rate,'minDimensionCm',s.min_dimension_cm,'maxDimensionCm',s.max_dimension_cm,'shelfThicknessCm',s.shelf_thickness_cm,'maxShelves',s.max_shelves)
  ) from public.pricing_settings s where s.id = 1;
$$;

-- One transaction, row lock and revision check: every field is published together.
create function public.save_pricing_catalog(expected_revision integer, changes jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  current_revision integer;
  item jsonb;
  setting jsonb;
  amount numeric;
begin
  if not private.is_catalog_admin() then raise exception 'Accesso amministratore richiesto' using errcode = '42501'; end if;
  select revision into current_revision from public.pricing_settings where id = 1 for update;
  if expected_revision is distinct from current_revision then raise exception 'Il listino è stato aggiornato. Ricarica prima di salvare.' using errcode = '40001'; end if;
  if jsonb_typeof(changes) is distinct from 'object' or jsonb_typeof(changes->'woods') is distinct from 'array'
    or jsonb_typeof(changes->'finishes') is distinct from 'array' or jsonb_typeof(changes->'deliveries') is distinct from 'array'
    or jsonb_typeof(changes->'settings') is distinct from 'object' then raise exception 'Dati incompleti'; end if;
  if (select array_agg(x->>'id' order by x->>'id') from jsonb_array_elements(changes->'woods') x) is distinct from (select array_agg(id order by id) from public.woods where active)
    or (select array_agg(x->>'id' order by x->>'id') from jsonb_array_elements(changes->'finishes') x) is distinct from (select array_agg(id order by id) from public.finishes where active)
    or (select array_agg(x->>'id' order by x->>'id') from jsonb_array_elements(changes->'deliveries') x) is distinct from (select array_agg(id order by id) from public.delivery_options where active)
    then raise exception 'Le voci del catalogo sono cambiate. Ricarica il listino.' using errcode = '40001'; end if;
  for item in select x from jsonb_array_elements((changes->'woods') || (changes->'finishes') || (changes->'deliveries')) x loop
    if jsonb_typeof(item->'price') is distinct from 'number' then raise exception 'Prezzo non valido'; end if;
    amount := (item->>'price')::numeric;
    if not (amount between 0 and 1000000) or amount <> round(amount, 2) then raise exception 'Prezzo non valido'; end if;
  end loop;
  setting := changes->'settings';
  if not (setting ?& array['vatRate','minDimensionCm','maxDimensionCm','shelfThicknessCm','maxShelves'])
    or exists (select 1 from jsonb_each(setting) e where jsonb_typeof(e.value) is distinct from 'number') then raise exception 'Impostazioni non valide'; end if;
  if (setting->>'vatRate')::numeric <> round((setting->>'vatRate')::numeric,6)
    or (setting->>'minDimensionCm')::numeric <> round((setting->>'minDimensionCm')::numeric,4)
    or (setting->>'maxDimensionCm')::numeric <> round((setting->>'maxDimensionCm')::numeric,4)
    or (setting->>'shelfThicknessCm')::numeric <> round((setting->>'shelfThicknessCm')::numeric,4)
    or (setting->>'maxShelves')::numeric <> trunc((setting->>'maxShelves')::numeric) then raise exception 'Troppi decimali nelle impostazioni'; end if;
  update public.woods w set price_per_m2 = (x->>'price')::numeric from jsonb_array_elements(changes->'woods') x where w.id = x->>'id';
  update public.finishes f set price_per_m2 = (x->>'price')::numeric from jsonb_array_elements(changes->'finishes') x where f.id = x->>'id';
  update public.delivery_options d set price = (x->>'price')::numeric from jsonb_array_elements(changes->'deliveries') x where d.id = x->>'id';
  update public.pricing_settings set vat_rate = (setting->>'vatRate')::numeric,
    min_dimension_cm = (setting->>'minDimensionCm')::numeric, max_dimension_cm = (setting->>'maxDimensionCm')::numeric,
    shelf_thickness_cm = (setting->>'shelfThicknessCm')::numeric, max_shelves = (setting->>'maxShelves')::integer,
    revision = current_revision + 1, updated_at = now(), version = to_char(now() at time zone 'Europe/Rome','YYYYMMDD') || '.' || (current_revision + 1)::text
    where id = 1;
  return public.get_pricing_catalog();
end;
$$;
revoke all on function public.save_pricing_catalog(integer,jsonb) from public, anon;
grant execute on function public.save_pricing_catalog(integer,jsonb) to authenticated;
