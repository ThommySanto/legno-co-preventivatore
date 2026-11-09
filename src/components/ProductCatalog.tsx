import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export type CatalogProduct = { id: string; name: string; category: string; minDimensions: Record<string, number>; maxDimensions: Record<string, number>; typicalDimensions: Record<string, number>; allowedWoods: string[]; deliveryDays: number; description: string };
const labels: Record<string, string> = { larghezza: 'L', altezza: 'H', profondita: 'P' };
function ProductThumbnail({ product }: { product: CatalogProduct }) {
  const text = `${product.category} ${product.name}`.toLowerCase();
  const kind = /tavol|scrivania|bancone/.test(text) ? 'table' : /letto|culla/.test(text) ? 'bed' : /sedia|sedut|poltrona|sgabello|panca/.test(text) ? 'seat' : 'cabinet';
  return <div className={`product-thumbnail product-thumbnail-${kind}`} aria-hidden="true"><svg viewBox="0 0 120 92" focusable="false">
    {kind === 'table' && <><path d="M17 33h86l-6 8H23zM29 41l-5 37M91 41l5 37M42 41l-2 32M78 41l2 32" /><path d="M21 78h12M87 78h12M34 73h12M74 73h12" /></>}
    {kind === 'bed' && <><path d="M18 26h16v46h68V38H34M18 72V38h78" /><path d="M34 48h68M47 48v24M80 48v24M18 26h84" /><path d="M47 38c0-8 13-8 13 0M72 38c0-8 13-8 13 0" /></>}
    {kind === 'seat' && <><path d="M28 40h64v25H28zM35 65l-5 17M85 65l5 17M35 40V22h50v18" /><path d="M25 82h14M81 82h14" /></>}
    {kind === 'cabinet' && <><rect x="28" y="14" width="64" height="64" rx="2" /><path d="M60 14v64M28 43h64M57 29h6M57 58h6" /><path d="M22 78h76" /></>}
  </svg></div>;
}

export default function ProductCatalog({ onSelect }: { onSelect: (product: CatalogProduct) => void }) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tutte');
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    fetch(`${url}/rest/v1/product_catalog?active=eq.true&select=id,name,category,min_dimensions,max_dimensions,typical_dimensions,allowed_woods,delivery_days,description&order=id`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setProducts((data as Array<Record<string, unknown>>).map(item => ({
        id: String(item.id), name: String(item.name), category: String(item.category),
        minDimensions: item.min_dimensions as Record<string, number>, maxDimensions: item.max_dimensions as Record<string, number>, typicalDimensions: item.typical_dimensions as Record<string, number>,
        allowedWoods: item.allowed_woods as string[], deliveryDays: Number(item.delivery_days), description: String(item.description),
      })))).catch(() => setError(true));
  }, []);
  const categories = useMemo(() => ['Tutte', ...Array.from(new Set(products.map(product => product.category))).sort()], [products]);
  const filtered = products.filter(product => (category === 'Tutte' || product.category === category) && `${product.name} ${product.description}`.toLowerCase().includes(query.toLowerCase()));
  const visible = (showAll || query || category !== 'Tutte') ? filtered : filtered.slice(0, 12);
  if (error) return <p className="product-catalog-error">Il catalogo prodotti non è disponibile al momento.</p>;
  if (!products.length) return null;
  return <section className="product-catalog" id="catalogo" aria-labelledby="catalog-title">
    <div className="catalog-heading"><div><span className="eyebrow">OLTRE IL SU MISURA</span><h2 id="catalog-title">Il catalogo Legno & Co.</h2><p>Scopri i nostri prodotti e chiedi al chatbot di configurarli.</p></div><span className="catalog-count">{products.length} prodotti</span></div>
    <div className="catalog-filters"><label className="catalog-search"><Search size={16} /><span className="sr-only">Cerca nel catalogo</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cerca un prodotto…" /></label><label className="catalog-select"><span className="sr-only">Filtra per categoria</span><select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label></div>
    <div className="product-grid">{visible.map(product => <article className="product-card" key={product.id}><ProductThumbnail product={product} /><div className="product-card-content"><div className="product-card-top"><span className="product-category">{product.category}</span><span className="product-id">{product.id}</span></div><h3>{product.name}</h3><p>{product.description}</p><div className="product-meta"><span>{Object.entries(product.minDimensions).map(([key, value]) => `${labels[key] ?? key}: ${value}–${product.maxDimensions[key]} cm`).join(' · ')}</span><span>{product.deliveryDays} gg</span></div><div className="product-woods">{product.allowedWoods.join(' · ')}</div><button className="product-configure" type="button" onClick={() => onSelect(product)}>Configura <span aria-hidden="true">→</span></button></div></article>)}</div>
    {!visible.length && <p className="catalog-empty">Nessun prodotto corrisponde alla ricerca.</p>}
    {filtered.length > 12 && !query && category === 'Tutte' && <button className="catalog-more" type="button" onClick={() => setShowAll(value => !value)}>{showAll ? 'Mostra meno prodotti' : `Vedi tutti i ${filtered.length} prodotti`}<span aria-hidden="true">{showAll ? '↑' : '↓'}</span></button>}
  </section>;
}
