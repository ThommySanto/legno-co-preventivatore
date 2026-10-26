import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import rawCatalog from '../public/data/catalog.json';
import { parseCatalog } from '../src/lib/catalog';
import { createQuotePdf } from '../src/lib/quotePdf';

const fonts = {
  regular: Uint8Array.from(fs.readFileSync('node_modules/@fontsource/inter/files/inter-latin-400-normal.woff')),
  semibold: Uint8Array.from(fs.readFileSync('node_modules/@fontsource/inter/files/inter-latin-600-normal.woff')),
  italic: Uint8Array.from(fs.readFileSync('node_modules/@fontsource/lora/files/lora-latin-400-italic.woff')),
};
const catalog = parseCatalog(rawCatalog);
const input = { width: '120', height: '80', depth: '40', woodId: 'rovere', finishId: 'cera-naturale', deliveryId: 'entro-50-km' };

describe('Documento PDF', () => {
  it('mantiene una pagina A4 anche con i ripiani aggiuntivi', async () => {
    const pdf = await PDFDocument.load(await createQuotePdf({ ...input, shelfCount: 2 }, catalog, fonts));
    expect(pdf.getPageCount()).toBe(1);
  });
  it('genera un A4 valido di una pagina con i caratteri incorporati', async () => {
    const now = new Date('2026-10-26T12:00:00Z');
    const bytes = await createQuotePdf(input, catalog, fonts, now);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89, 1);
    expect(pdf.getTitle()).toBe('Il tuo preventivo - Legno & Co.');
    expect(pdf.getCreationDate()).toEqual(now);
    expect(pdf.getPage(0).node.Resources()?.toString()).toContain('Font');
  });
  it('manda a capo i nomi lunghi e aggiunge una pagina quando serve', async () => {
    const updated = structuredClone(catalog);
    updated.woods.find(i => i.id === 'rovere')!.name = 'Rovere europeo con una descrizione molto lunga del materiale '.repeat(2);
    updated.finishes.find(i => i.id === 'cera-naturale')!.name = 'Cera naturale con una descrizione molto lunga della finitura '.repeat(2);
    updated.deliveries.find(i => i.id === 'entro-50-km')!.name = 'Consegna entro 50 km con una descrizione molto lunga del trasporto '.repeat(2);
    const pdf = await PDFDocument.load(await createQuotePdf(input, updated, fonts));
    expect(pdf.getPageCount()).toBe(2);
  });
  it('rifiuta misure non valide prima di generare un documento', async () => {
    await expect(createQuotePdf({ ...input, width: '20' }, catalog, fonts)).rejects.toThrow('Correggi le misure');
  });
  it('conserva i dati originali e supporta virgola, accenti ed euro', async () => {
    const decimalInput = { ...input, width: '120,25' };
    const before = JSON.stringify({ decimalInput, catalog });
    const bytes = await createQuotePdf(decimalInput, catalog, fonts);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(JSON.stringify({ decimalInput, catalog })).toBe(before);
  });
});
