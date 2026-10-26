import { useCallback, useEffect, useState } from 'react';
import type { Catalog } from '../lib/catalog';
import { loadCatalog } from '../lib/loadCatalog';

export type CatalogState =
  | { status: 'loading'; catalog: null; error: null }
  | { status: 'ready'; catalog: Catalog; error: null }
  | { status: 'error'; catalog: null; error: string };

export function useCatalog() {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<CatalogState>({ status: 'loading', catalog: null, error: null });
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    let active = true;
    setState({ status: 'loading', catalog: null, error: null });
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
      if (active) setState({ status: 'error', catalog: null, error: 'Il listino impiega troppo tempo a rispondere. Riprova.' });
    }, 12_000);
    loadCatalog(controller.signal).then(catalog => {
      if (active && !timedOut) setState({ status: 'ready', catalog, error: null });
    }).catch(error => {
      if (active && !controller.signal.aborted) setState({
        status: 'error', catalog: null,
        error: error instanceof Error ? error.message : 'Il listino non è disponibile. Riprova.',
      });
    }).finally(() => window.clearTimeout(timer));
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [revision]);
  useEffect(() => {
    // A new visit, tab focus or return online fetches current owner-managed prices.
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [refresh]);
  return { ...state, refresh };
}
