-- Public catalog only. No customer data, authentication or quote storage.
create table public.woods (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null check (length(trim(name)) between 1 and 100),
  description text not null default '' check (length(description) <= 200),
  price_per_m2 numeric(12,2) not null check (price_per_m2 between 0 and 1000000),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  active boolean not null default true
);
create table public.finishes (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null check (length(trim(name)) between 1 and 100),
  description text not null default '' check (length(description) <= 200),
  price_per_m2 numeric(12,2) not null check (price_per_m2 between 0 and 1000000),
  sort_order integer not null default 0,
  active boolean not null default true
);
create table public.delivery_options (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null check (length(trim(name)) between 1 and 100),
  description text not null default '' check (length(description) <= 200),
  price numeric(12,2) not null check (price between 0 and 1000000),
  sort_order integer not null default 0,
  active boolean not null default true
);
create table public.pricing_settings (
  id integer primary key default 1 check (id = 1),
  version text not null default '2026.1' check (length(version) > 0),
  vat_rate numeric(8,6) not null check (vat_rate between 0 and 1),
  min_dimension_cm numeric(10,4) not null check (min_dimension_cm > 0),
  max_dimension_cm numeric(10,4) not null check (max_dimension_cm <= 100000 and max_dimension_cm >= min_dimension_cm)
);

comment on column public.woods.price_per_m2 is 'Euro al m², IVA esclusa. Modificabile dal titolare.';
comment on column public.finishes.price_per_m2 is 'Supplemento in euro al m², IVA esclusa.';
comment on column public.delivery_options.price is 'Costo fisso in euro, IVA esclusa.';
comment on column public.pricing_settings.vat_rate is 'Aliquota in forma decimale: 0.22 significa 22%.';

alter table public.woods enable row level security;
alter table public.finishes enable row level security;
alter table public.delivery_options enable row level security;
alter table public.pricing_settings enable row level security;

-- Remove default write grants. Owners use Supabase Table Editor, never browser credentials.
revoke all on public.woods, public.finishes, public.delivery_options, public.pricing_settings from anon, authenticated;
grant select on public.woods, public.finishes, public.delivery_options, public.pricing_settings to anon, authenticated;
create policy "Read active woods" on public.woods for select to anon, authenticated using (active);
create policy "Read active finishes" on public.finishes for select to anon, authenticated using (active);
create policy "Read active delivery options" on public.delivery_options for select to anon, authenticated using (active);
create policy "Read pricing settings" on public.pricing_settings for select to anon, authenticated using (true);

-- One stable, read-only statement supplies a coherent catalog snapshot.
create function public.get_pricing_catalog()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'version', s.version,
    'woods', coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'description',w.description,'pricePerM2',w.price_per_m2,'color',w.color) order by w.sort_order,w.id) from public.woods w where w.active), '[]'::jsonb),
    'finishes', coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'description',f.description,'pricePerM2',f.price_per_m2) order by f.sort_order,f.id) from public.finishes f where f.active), '[]'::jsonb),
    'deliveries', coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'description',d.description,'price',d.price) order by d.sort_order,d.id) from public.delivery_options d where d.active), '[]'::jsonb),
    'settings', jsonb_build_object('vatRate',s.vat_rate,'minDimensionCm',s.min_dimension_cm,'maxDimensionCm',s.max_dimension_cm)
  ) from public.pricing_settings s where s.id = 1;
$$;
revoke all on function public.get_pricing_catalog() from public;
grant execute on function public.get_pricing_catalog() to anon, authenticated;
