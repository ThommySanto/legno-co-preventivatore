import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

type Product = { id: string; name: string; category: string; minDimensions: Record<string, number>; maxDimensions: Record<string, number>; allowedWoods: string[]; deliveryDays: number; description: string };
const labels: Record<string, string> = { larghezza: 'L', altezza: 'H', profondita: 'P' };

export default function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tutte');
  const [error, setError] = useState(false);
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    fetch(`${url}/rest/v1/product_catalog?active=eq.true&select=id,name,category,min_dimensions,max_dimensions,allowed_woods,delivery_days,description&order=id`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setProducts(data as Product[])).catch(() => setError(true));
  }, []);
  const categories = useMemo(() => ['Tutte', ...Array.from(new Set(products.map(product => product.category))).sort()], [products]);
  const visible = products.filter(product => (category === 'Tutte' || product.category === category) && `${product.name} ${product.description}`.toLowerCase().includes(query.toLowerCase()));
  if (error) return <p className="product-catalog-error">Il catalogo prodotti non è disponibile al momento.</p>;
  if (!products.length) return null;
  return <section className="product-catalog" id="catalogo" aria-labelledby="catalog-title">
    <div className="catalog-heading"><div><span className="eyebrow">OLTRE IL SU MISURA</span><h2 id="catalog-title">Il catalogo Legno & Co.</h2><p>Scopri i nostri prodotti e chiedi al chatbot di configurarli.</p></div><span className="catalog-count">{products.length} prodotti</span></div>
    <div className="catalog-filters"><label className="catalog-search"><Search size={16} /><span className="sr-only">Cerca nel catalogo</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cerca un prodotto…" /></label><label className="catalog-select"><span className="sr-only">Filtra per categoria</span><select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label></div>
    <div className="product-grid">{visible.map(product => <article className="product-card" key={product.id}><div className="product-card-top"><span className="product-category">{product.category}</span><span className="product-id">{product.id}</span></div><h3>{product.name}</h3><p>{product.description}</p><div className="product-meta"><span>{Object.entries(product.minDimensions).map(([key, value]) => `${labels[key] ?? key}: ${value}–${product.maxDimensions[key]} cm`).join(' · ')}</span><span>{product.deliveryDays} giorni</span></div><div className="product-woods">{product.allowedWoods.join(' · ')}</div></article>)}</div>
    {!visible.length && <p className="catalog-empty">Nessun prodotto corrisponde alla ricerca.</p>}
  </section>;
}
