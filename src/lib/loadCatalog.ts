import { parseCatalog, type Catalog } from './catalog';

type CatalogEnv = {
  VITE_CATALOG_SOURCE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

export function getCatalogMode(env: CatalogEnv = import.meta.env) {
  const mode = env.VITE_CATALOG_SOURCE || (env.VITE_SUPABASE_URL ? 'supabase' : 'local');
  if (mode !== 'local' && mode !== 'supabase') throw new Error('Configurazione del listino non valida.');
  return mode;
}

export async function loadCatalog(signal: AbortSignal, env: CatalogEnv = import.meta.env): Promise<Catalog> {
  if (getCatalogMode(env) === 'local') {
    const response = await fetch('/data/catalog.json', { signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Il listino non è disponibile. Controlla la connessione e riprova.');
    return parseCatalog(await response.json());
  }
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !key.startsWith('sb_publishable_') || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
    throw new Error('Il collegamento al listino non è ancora configurato.');
  }
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.rpc('get_pricing_catalog', {}, { get: true }).abortSignal(signal);
  if (error) throw new Error('Non riusciamo ad aggiornare il listino. Controlla la connessione e riprova.');
  return parseCatalog(data);
}
