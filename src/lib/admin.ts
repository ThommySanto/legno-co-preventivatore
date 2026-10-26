import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Catalog } from './catalog';
import { parseCatalog } from './catalog';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let client: SupabaseClient | undefined;
export function getAdminClient() {
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !key?.startsWith('sb_publishable_')) throw new Error('Accesso admin non configurato.');
  if (!client) {
    let storage: Storage | undefined;
    try { storage = window.sessionStorage; } catch { /* Use an in-memory session when storage is blocked. */ }
    client = createClient(url, key, {
      auth: { storage, storageKey: 'legno-co:admin-auth:v1', persistSession: Boolean(storage), autoRefreshToken: true, detectSessionInUrl: true },
      global: { fetch: (input, options) => fetch(input, { ...options, signal: AbortSignal.any([...(options?.signal ? [options.signal] : []), AbortSignal.timeout(15_000)]) }) },
    });
  }
  return client;
}

export type PriceDraft = Record<string, string>;
export const settingsFields = [
  { key: 'vatRate', label: 'IVA', unit: '%', decimals: 4 },
  { key: 'minDimensionCm', label: 'Misura minima', unit: 'cm', decimals: 4 },
  { key: 'maxDimensionCm', label: 'Misura massima', unit: 'cm', decimals: 4 },
  { key: 'shelfThicknessCm', label: 'Spessore dei pannelli e ripiani', unit: 'cm', decimals: 4 },
  { key: 'maxShelves', label: 'Numero massimo di ripiani', unit: 'ripiani', decimals: 0 },
] as const;
export function createPriceDraft(catalog: Catalog): PriceDraft {
  return Object.fromEntries([
    ...catalog.woods.map(item => [`wood:${item.id}`, item.pricePerM2.toFixed(2).replace('.', ',')]),
    ...catalog.finishes.map(item => [`finish:${item.id}`, item.pricePerM2.toFixed(2).replace('.', ',')]),
    ...catalog.deliveries.map(item => [`delivery:${item.id}`, item.price.toFixed(2).replace('.', ',')]),
    ...settingsFields.map(field => [field.key, String(field.key === 'vatRate' ? Number((catalog.settings.vatRate * 100).toFixed(4)) : catalog.settings[field.key]).replace('.', ',')]),
  ]);
}
export function readPriceDraft(catalog: Catalog, draft: PriceDraft) {
  const errors: Record<string, string> = {};
  const number = (key: string, decimals: number) => {
    const raw = draft[key]?.trim().replace(',', '.') ?? '';
    if (!new RegExp(`^\\d+${decimals ? `(?:\\.\\d{1,${decimals}})?` : ''}$`).test(raw) || !Number.isFinite(Number(raw))) {
      errors[key] = decimals ? `Usa un numero positivo, con massimo ${decimals} decimali.` : 'Usa un numero intero positivo o zero.';
      return NaN;
    }
    return Number(raw);
  };
  const prices = (items: { id: string }[], prefix: string) => items.map(item => {
    const amount = number(`${prefix}:${item.id}`, 2);
    if (amount > 1_000_000) errors[`${prefix}:${item.id}`] = 'Il prezzo massimo è 1.000.000 €.';
    return { id: item.id, price: amount };
  });
  const woods = prices(catalog.woods, 'wood');
  const finishes = prices(catalog.finishes, 'finish');
  const deliveries = prices(catalog.deliveries, 'delivery');
  const settings = Object.fromEntries(settingsFields.map(field => [field.key, number(field.key, field.decimals)])) as Catalog['settings'];
  settings.vatRate = Number((settings.vatRate / 100).toFixed(6));
  if (settings.vatRate > 1) errors.vatRate = 'L’IVA deve essere tra 0 e 100%.';
  if (settings.minDimensionCm <= 0) errors.minDimensionCm = 'La misura deve essere maggiore di zero.';
  if (settings.maxDimensionCm > 100_000 || settings.maxDimensionCm < settings.minDimensionCm) errors.maxDimensionCm = 'La misura massima deve essere almeno pari alla minima e non oltre 100.000 cm.';
  if (settings.shelfThicknessCm < 0.1 || settings.shelfThicknessCm > 10 || settings.shelfThicknessCm * 2 >= settings.minDimensionCm) errors.shelfThicknessCm = 'Usa uno spessore da 0,1 a 10 cm, inferiore alla metà della misura minima.';
  if (settings.maxShelves > 24) errors.maxShelves = 'Puoi consentire da 0 a 24 ripiani.';
  return { errors, changes: { woods, finishes, deliveries, settings } };
}

export async function fetchAdminCatalog() {
  const supabase = getAdminClient();
  const { data: allowed, error: permissionError } = await supabase.rpc('is_catalog_admin');
  if (permissionError) throw new Error('Non riusciamo a verificare l’accesso. Riprova.');
  if (allowed !== true) throw new Error('Questa email non è autorizzata come amministratore.');
  const { data, error } = await supabase.rpc('get_pricing_catalog');
  if (error) throw new Error('Non riusciamo a caricare il listino. Riprova.');
  return parseCatalog(data);
}
export async function saveAdminCatalog(catalog: Catalog, draft: PriceDraft) {
  const { errors, changes } = readPriceDraft(catalog, draft);
  if (Object.keys(errors).length) throw new Error('Correggi i campi indicati prima di salvare.');
  const { data, error } = await getAdminClient().rpc('save_pricing_catalog', { expected_revision: catalog.revision, changes });
  if (error?.code === '40001') throw new Error('Il listino è stato aggiornato da un’altra scheda. Usa “Ricarica listino”, poi reinserisci le tue modifiche.');
  if (error?.code === '42501' || error?.code === 'PGRST301' || error?.code === 'PGRST303') throw new Error('Accesso scaduto o non autorizzato. Esci e accedi nuovamente.');
  if (error) throw new Error('Salvataggio non riuscito. Le modifiche restano qui: ricarica il listino per verificarne lo stato prima di riprovare.');
  return parseCatalog(data);
}
