import { describe, expect, it } from 'vitest';
import rawCatalog from '../public/data/catalog.json';
import { parseCatalog } from '../src/lib/catalog';
import { calculateQuote, getShelfLayout } from '../src/lib/quote';

const catalog = parseCatalog(rawCatalog);
const base = { width: '120', height: '80', depth: '40', woodId: 'rovere', finishId: 'cera-naturale', deliveryId: 'entro-50-km' };
describe('Ripiani interni e preventivo', () => {
  it('mantiene il preventivo originale senza ripiani', () => {
    expect(calculateQuote({ ...base, shelfCount: 0 }, catalog)).toMatchObject({ total: 897.72, shelves: { area: 0, amount: 0 } });
  });
  it('calcola due facce e quattro bordi sulle misure interne, con la stessa finitura', () => {
    // (120 - 4) × (40 - 2) × 2 cm -> 0.9432 m² per ripiano.
    // 2 ripiani × 0.9432 × (180 + 12) = 362.1888; imponibile 1098.03, IVA 241.57.
    expect(calculateQuote({ ...base, shelfCount: 2 }, catalog)).toMatchObject({
      shelves: { count: 2, width: 116, depth: 38, thickness: 2, area: 1.8864, amount: 362.19 },
      totalArea: 5.4064, net: 1098.03, vat: 241.57, total: 1339.6,
    });
  });
  it.each([-1, 1.5, NaN, Infinity, 13])('rifiuta quantità non valide %s', shelfCount => {
    expect(calculateQuote({ ...base, shelfCount }, catalog)).toBeNull();
  });
  it('rispetta il limite fisico oltre al limite del listino', () => {
    const updated = structuredClone(catalog);
    updated.settings.shelfThicknessCm = 10;
    expect(getShelfLayout({ ...base, height: '30' }, updated)?.maxCount).toBe(0);
    expect(calculateQuote({ ...base, height: '30', shelfCount: 1 }, updated)).toBeNull();
  });
  it('ricalcola costo e ingombro con prezzi e spessore modificati dall’admin', () => {
    const updated = structuredClone(catalog);
    updated.settings.shelfThicknessCm = 3;
    updated.settings.maxShelves = 1;
    updated.woods.find(item => item.id === 'rovere')!.pricePerM2 = 200;
    const quote = calculateQuote({ ...base, shelfCount: 1 }, updated)!;
    expect(quote.shelves).toMatchObject({ width: 114, depth: 37, thickness: 3, maxCount: 1, amount: 198.05 });
    expect(calculateQuote({ ...base, shelfCount: 2 }, updated)).toBeNull();
  });
  it('mantiene la somma delle righe coerente col totale anche con frazioni di centesimo', () => {
    for (const width of ['120.25', '80.1234', '199.99']) {
      const quote = calculateQuote({ ...base, width, shelfCount: 3 }, catalog)!;
      expect(quote.furniture + quote.shelves.amount + quote.delivery.price + quote.roundingAdjustment).toBeCloseTo(quote.net, 8);
      expect(quote.net + quote.vat).toBeCloseTo(quote.total, 8);
    }
  });
});
