import { afterEach, describe, expect, it, vi } from 'vitest';
import rawCatalog from '../public/data/catalog.json';
import { getCatalogMode, loadCatalog } from '../src/lib/loadCatalog';

afterEach(() => vi.unstubAllGlobals());

describe('Caricamento del listino e privacy', () => {
  it('carica il file separato senza cache e senza dati del cliente', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => rawCatalog });
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;
    expect(await loadCatalog(signal, { VITE_CATALOG_SOURCE: 'local' })).toEqual(rawCatalog);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/data/catalog.json', { signal, cache: 'no-store' });
  });
  it('non usa prezzi locali se Supabase è configurato in modo incompleto', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadCatalog(new AbortController().signal, { VITE_CATALOG_SOURCE: 'supabase' })).rejects.toThrow('non è ancora configurato');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rifiuta chiavi segrete nel client prima di qualunque richiesta', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadCatalog(new AbortController().signal, {
      VITE_CATALOG_SOURCE: 'supabase', VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test',
    })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('un errore di rete Supabase non attiva un ripiego locale', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadCatalog(new AbortController().signal, {
      VITE_CATALOG_SOURCE: 'supabase', VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    })).rejects.toThrow('Non riusciamo');
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith('https://example.supabase.co/rest/v1/rpc/get_pricing_catalog'))).toBe(true);
  });
  it('rifiuta un file mancante o con dati non validi', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadCatalog(new AbortController().signal, { VITE_CATALOG_SOURCE: 'local' })).rejects.toThrow('non è disponibile');
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(loadCatalog(new AbortController().signal, { VITE_CATALOG_SOURCE: 'local' })).rejects.toThrow('non validi');
  });
  it('riconosce solo le modalità previste', () => {
    expect(getCatalogMode({})).toBe('local');
    expect(getCatalogMode({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).toBe('supabase');
    expect(() => getCatalogMode({ VITE_CATALOG_SOURCE: 'unknown' })).toThrow();
  });
});
