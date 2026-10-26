import { describe, expect, it } from 'vitest';
import rawCatalog from '../public/data/catalog.json';
import { parseCatalog } from '../src/lib/catalog';
import { createPriceDraft, readPriceDraft } from '../src/lib/admin';
const catalog = parseCatalog(rawCatalog);
describe('Validazione listino admin', () => {
  it('accetta prezzi con virgola e IVA percentuale senza cambiare i dati originali', () => {
    const draft = { ...createPriceDraft(catalog), 'wood:rovere': '198,50', vatRate: '10,5' };
    const result = readPriceDraft(catalog, draft);
    expect(result.errors).toEqual({});
    expect(result.changes.woods.find(item => item.id === 'rovere')?.price).toBe(198.5);
    expect(result.changes.settings.vatRate).toBe(0.105);
    expect(catalog.woods.find(item => item.id === 'rovere')?.pricePerM2).toBe(180);
  });
  it.each(['', '-1', '1e2', '1.234', 'Infinity', 'abc', '1000001', '1.200,00'])('rifiuta il prezzo %j', value => {
    expect(readPriceDraft(catalog, { ...createPriceDraft(catalog), 'wood:rovere': value }).errors['wood:rovere']).toBeTruthy();
  });
  it('rifiuta limiti incoerenti, ripiani frazionari e IVA oltre 100%', () => {
    const result = readPriceDraft(catalog, { ...createPriceDraft(catalog), maxDimensionCm: '20', shelfThicknessCm: '15', maxShelves: '1.5', vatRate: '101' });
    expect(Object.keys(result.errors).sort()).toEqual(['maxDimensionCm', 'maxShelves', 'shelfThicknessCm', 'vatRate']);
  });
});
