import { describe, expect, it } from 'vitest';
import rawCatalog from '../public/data/catalog.json';
import { parseCatalog } from '../src/lib/catalog';
import { calculateQuote, validateDimensions } from '../src/lib/quote';

const catalog = parseCatalog(rawCatalog);
const base = { width: '120', height: '80', depth: '40', woodId: 'rovere', finishId: 'cera-naturale', deliveryId: 'entro-50-km' };

describe('Casi di accettazione del foglio Excel', () => {
  it.each([
    ['C1', base, 3.52, 735.84, 161.88, 897.72],
    ['C2', { ...base, width: '200', height: '100', depth: '50', woodId: 'abete', finishId: 'grezzo', deliveryId: 'ritiro' }, 7, 595, 130.9, 725.9],
    ['C3', { ...base, width: '90', height: '180', depth: '35', woodId: 'noce', finishId: 'laccato', deliveryId: 'oltre-50-km' }, 5.13, 1530.75, 336.77, 1867.52],
    ['C4', { ...base, width: '150', height: '75', depth: '60', woodId: 'castagno', finishId: 'verniciato-opaco' }, 4.95, 941.1, 207.04, 1148.14],
  ])('%s: sei lati, consegna e IVA corretti', (_id, input, area, net, vat, total) => {
    expect(calculateQuote(input, catalog)).toMatchObject({ area, net, vat, total });
  });
  it('C5: rifiuta la larghezza 20 cm, anche se il prodotto costa meno', () => {
    expect(calculateQuote({ ...base, width: '20', woodId: 'pino', deliveryId: 'ritiro' }, catalog)).toBeNull();
  });
});

describe('Validazione e precisione', () => {
  it.each(['', '0', '-1', '20', '300.01', '2000', 'NaN', 'Infinity', '1e2', 'abc', '120cm', '1,2.3'])('nessun preventivo con larghezza %j', width => {
    expect(calculateQuote({ ...base, width }, catalog)).toBeNull();
  });
  it.each(['30', '300'])('accetta il limite incluso %s', value => {
    expect(calculateQuote({ ...base, width: value, height: value, depth: value }, catalog)).not.toBeNull();
  });
  it('accetta la virgola italiana e non arrotonda la superficie prima del prezzo', () => {
    const a = calculateQuote({ ...base, width: '120,25', height: '80,5', depth: '40,75' }, catalog)!;
    const b = calculateQuote({ ...base, width: '120.25', height: '80.5', depth: '40.75' }, catalog)!;
    expect(a).toEqual(b);
    expect(a.area).toBe(3.5721375);
    expect(a.net).toBe(745.85);
    expect(a.vat).toBe(164.09);
    expect(a.total).toBe(909.94);
  });
  it('applica arrotondamento commerciale a mezzo centesimo', () => {
    const updated = structuredClone(catalog);
    updated.woods.find(w => w.id === 'abete')!.pricePerM2 = 0.25;
    const q = calculateQuote({ ...base, width: '100', height: '100', depth: '101', woodId: 'abete', finishId: 'grezzo', deliveryId: 'ritiro' }, updated)!;
    expect(q.area).toBe(6.04);
    expect(q.net).toBe(1.51);
    expect(q.vat).toBe(0.33);
    expect(q.total).toBe(1.84);
    // 6.02 × 0.25 = 1.505 -> 1.51, then tax is rounded on that taxable subtotal.
    const half = calculateQuote({ ...base, width: '100', height: '100', depth: '100.5', woodId: 'abete', finishId: 'grezzo', deliveryId: 'ritiro' }, updated)!;
    expect(half.net).toBe(1.51);
  });
  it('legge prezzi, aliquota e limiti dai dati senza cambiare il calcolo', () => {
    const updated = structuredClone(catalog);
    updated.woods.find(w => w.id === 'rovere')!.pricePerM2 = 200;
    expect(calculateQuote(base, updated)?.total).toBe(983.61);
    updated.settings.vatRate = 0;
    expect(calculateQuote(base, updated)?.total).toBe(806.24);
    updated.settings.minDimensionCm = 50;
    expect(validateDimensions(base, updated).depth).toContain('50');
    expect(calculateQuote(base, updated)).toBeNull();
  });
  it('rifiuta opzioni eliminate o inesistenti', () => {
    expect(calculateQuote({ ...base, woodId: 'inesistente' }, catalog)).toBeNull();
  });
  it('non modifica gli input del visitatore né il listino', () => {
    const before = JSON.stringify({ base, catalog });
    calculateQuote(base, catalog);
    expect(JSON.stringify({ base, catalog })).toBe(before);
  });
});

describe('Dati del catalogo', () => {
  it('rifiuta listini vuoti, prezzi negativi, duplicati e limiti invertiti', () => {
    expect(() => parseCatalog({ ...rawCatalog, woods: [] })).toThrow();
    expect(() => parseCatalog({ ...rawCatalog, woods: [{ ...rawCatalog.woods[0], pricePerM2: -1 }] })).toThrow();
    expect(() => parseCatalog({ ...rawCatalog, woods: [rawCatalog.woods[0], rawCatalog.woods[0]] })).toThrow();
    expect(() => parseCatalog({ ...rawCatalog, settings: { ...rawCatalog.settings, minDimensionCm: 400 } })).toThrow();
  });
});
