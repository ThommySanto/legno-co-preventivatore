-- Integration assertions. All fixtures and price edits are rolled back.
begin;
insert into private.catalog_admins(email) values ('catalog-admin-test@example.invalid');
insert into auth.users(id,email,email_confirmed_at,is_anonymous)
values ('a0000000-0000-4000-8000-000000000001','catalog-admin-test@example.invalid',now(),false),
       ('a0000000-0000-4000-8000-000000000002','catalog-other-test@example.invalid',now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
do $$
declare n integer;
begin
  if public.is_catalog_admin() then raise exception 'Non-admin incorrectly authorized'; end if;
  update public.woods set price_per_m2=999 where id='rovere';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Non-admin bypassed RLS'; end if;
  begin
    perform public.save_pricing_catalog(0,'{}'::jsonb);
    raise exception 'Non-admin saved catalog';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
do $$
declare c jsonb; payload jsonb; saved jsonb; rev integer;
begin
  if not public.is_catalog_admin() then raise exception 'Verified allowlisted admin rejected'; end if;
  c := public.get_pricing_catalog(); rev := (c->>'revision')::integer;
  payload := jsonb_build_object(
    'woods',(select jsonb_agg(jsonb_build_object('id',x->>'id','price',case when x->>'id'='rovere' then 198.50 else (x->>'pricePerM2')::numeric end)) from jsonb_array_elements(c->'woods') x),
    'finishes',(select jsonb_agg(jsonb_build_object('id',x->>'id','price',(x->>'pricePerM2')::numeric)) from jsonb_array_elements(c->'finishes') x),
    'deliveries',(select jsonb_agg(jsonb_build_object('id',x->>'id','price',(x->>'price')::numeric)) from jsonb_array_elements(c->'deliveries') x),
    'settings',c->'settings');
  saved := public.save_pricing_catalog(rev,payload);
  if (saved->>'revision')::integer <> rev + 1 or (select price_per_m2 from public.woods where id='rovere') <> 198.50 then raise exception 'Save did not persist coherently'; end if;
  begin
    perform public.save_pricing_catalog(rev,payload);
    raise exception 'Stale revision accepted';
  exception when serialization_failure then null;
  end;
  payload := jsonb_set(payload,'{settings,shelfThicknessCm}','15'::jsonb);
  payload := jsonb_set(payload,'{woods,0,price}','999'::jsonb);
  begin
    perform public.save_pricing_catalog(rev+1,payload);
    raise exception 'Invalid settings accepted';
  exception when check_violation then null;
  end;
  if public.get_pricing_catalog() is distinct from saved then raise exception 'Failed save was not atomic'; end if;
end;
$$;
reset role;
update auth.users set email_confirmed_at=null where id='a0000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin if public.is_catalog_admin() then raise exception 'Unconfirmed email accepted'; end if; end; $$;
reset role;
set local role anon;
do $$
begin
  if (public.get_pricing_catalog()->'woods') is null then raise exception 'Public catalog unavailable'; end if;
  begin
    perform public.save_pricing_catalog(0,'{}'::jsonb);
    raise exception 'Anonymous save accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select 'All admin security, atomicity and concurrency assertions passed; fixtures rolled back.' as result;
rollback;
