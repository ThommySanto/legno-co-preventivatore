-- Source: listino_preventivatore_LegnoCo.xlsx, Listino!A5:B9, Finiture!A4:B7,
-- Consegna!A4:B6, Parametri!A4:B6. Descriptions and colors are presentation metadata.
-- Preserve owner changes if this seed is deliberately re-applied.
insert into public.woods (id,name,description,price_per_m2,color,sort_order) values
('abete','Abete','Chiaro e leggero',85,'#dfc79e',1),
('pino','Pino','Caldo e naturale',95,'#cfa36c',2),
('castagno','Castagno','Rustico e materico',160,'#a87649',3),
('rovere','Rovere','Elegante e senza tempo',180,'#b99465',4),
('noce','Noce','Intenso e raffinato',240,'#725039',5)
on conflict (id) do nothing;
insert into public.finishes (id,name,description,price_per_m2,sort_order) values
('grezzo','Grezzo','Il legno, nella sua essenza',0,1),
('cera-naturale','Cera naturale','Protezione leggera, tocco naturale',12,2),
('verniciato-opaco','Verniciato opaco','Uniforme, discreto e protetto',18,3),
('laccato','Laccato','Una superficie liscia e coprente',35,4)
on conflict (id) do nothing;
insert into public.delivery_options (id,name,description,price,sort_order) values
('ritiro','Ritiro in sede','Vieni a ritirare il tuo mobile',0,1),
('entro-50-km','Entro 50 km','Consegna nella tua zona',60,2),
('oltre-50-km','Oltre 50 km','Per le destinazioni più lontane',120,3)
on conflict (id) do nothing;
insert into public.pricing_settings (id,version,vat_rate,min_dimension_cm,max_dimension_cm)
values (1,'2026.1',0.22,30,300) on conflict (id) do nothing;
