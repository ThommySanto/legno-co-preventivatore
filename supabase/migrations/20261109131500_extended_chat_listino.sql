-- Blocco 4: voci necessarie al catalogo esteso, senza alterare i prezzi esistenti.
insert into public.woods (id,name,description,price_per_m2,color,sort_order) values
('faggio','Faggio','Compatto e resistente',130,'#d7a875',6),
('frassino','Frassino','Chiaro e venato',150,'#d9c19a',7),
('ciliegio','Ciliegio','Caldo e rosato',210,'#a85f43',8)
on conflict (id) do nothing;
insert into public.finishes (id,name,description,price_per_m2,sort_order) values
('olio-naturale','Olio naturale','Esalta la venatura del legno',10,5),
('tinto','Tinto','Colore personalizzato',22,6)
on conflict (id) do nothing;
