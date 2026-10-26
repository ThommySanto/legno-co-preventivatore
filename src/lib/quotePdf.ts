import { PDFDocument, rgb } from 'pdf-lib';
import type { PDFFont, PDFPage, RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Catalog } from './catalog';
import { calculateQuote, formatCurrency, formatNumber, parseDimension } from './quote.ts';
import type { QuoteInput } from './quote';

export type QuotePdfFonts = { regular: Uint8Array; semibold: Uint8Array; italic: Uint8Array };
const hex = (value: string): RGB => rgb(
  parseInt(value.slice(1, 3), 16) / 255,
  parseInt(value.slice(3, 5), 16) / 255,
  parseInt(value.slice(5, 7), 16) / 255,
);
const ink = hex('#253b30');
const muted = hex('#65705f');
const pale = hex('#f0f3e9');
const line = hex('#dce3d1');
const clean = (value: string) => value.replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();

function wrap(value: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of clean(value).split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) { current = candidate; continue; }
    if (current) { lines.push(current); current = ''; }
    for (const letter of Array.from(word)) {
      if (font.widthOfTextAtSize(current + letter, size) > width && current) { lines.push(current); current = ''; }
      current += letter;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function drawFurniture(page: PDFPage, x: number, top: number, input: QuoteInput, woodColor: string) {
  const height = page.getHeight();
  const l = parseDimension(input.width)!.toNumber();
  const h = parseDimension(input.height)!.toNumber();
  const p = parseDimension(input.depth)!.toNumber();
  const scale = Math.min(147 / l, 106 / h);
  const w = l * scale;
  const tall = h * scale;
  const d = Math.min(32, p * scale * .5);
  const left = x + (190 - w - d) / 2;
  const frontTop = top + (118 - tall) / 2 + d / 3;
  const wood = hex(woodColor);
  const side = rgb(wood.red * .76, wood.green * .76, wood.blue * .76);
  const inside = rgb(wood.red * .8, wood.green * .8, wood.blue * .8);
  page.drawEllipse({ x: left + w / 2 + d / 2, y: height - frontTop - tall - 5, xScale: w / 2 + d / 2, yScale: 4, color: ink, opacity: .06 });
  page.drawSvgPath(`M0 0 L${d} ${-d / 2} L${d} ${tall - d / 2} L0 ${tall} Z`, { x: left + w, y: height - frontTop, color: side });
  page.drawSvgPath(`M0 0 L${d} ${-d / 2} L${w + d} ${-d / 2} L${w} 0 Z`, { x: left, y: height - frontTop, color: rgb(Math.min(1, wood.red * 1.13), Math.min(1, wood.green * 1.13), Math.min(1, wood.blue * 1.13)) });
  page.drawRectangle({ x: left, y: height - frontTop - tall, width: w, height: tall, color: wood });
  const edge = Math.min(6, w * .08);
  page.drawRectangle({ x: left + edge, y: height - frontTop - tall + edge, width: w - edge * 2, height: tall - edge * 2, color: inside });
  for (const ratio of [1 / 3, 2 / 3]) page.drawRectangle({ x: left + edge, y: height - frontTop - tall * ratio, width: w - edge * 2, height: edge * .6, color: wood });
  for (let i = 1; i < Math.min(30, Math.floor(w / 7)); i++) page.drawLine({ start: { x: left + i * 7, y: height - frontTop }, end: { x: left + i * 7 + 1, y: height - frontTop - tall }, thickness: .45, color: side, opacity: .13 });
}

/** A fresh, independent PDF snapshot. No browser storage, network or theme dependency. */
export async function createQuotePdf(input: QuoteInput, catalog: Catalog, fontBytes: QuotePdfFonts, now = new Date()): Promise<Uint8Array> {
  const quote = calculateQuote(input, catalog);
  if (!quote) throw new Error('Correggi le misure prima di scaricare il preventivo.');
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle('Il tuo preventivo - Legno & Co.');
  pdf.setAuthor('Legno & Co. - Progetto didattico');
  pdf.setSubject('Configurazione e preventivo indicativo per un mobile su misura');
  pdf.setCreator('Legno & Co. Preventivatore');
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
  pdf.setLanguage('it-IT');
  const [regular, semibold, italic] = await Promise.all([
    pdf.embedFont(fontBytes.regular, { subset: true }),
    pdf.embedFont(fontBytes.semibold, { subset: true }),
    pdf.embedFont(fontBytes.italic, { subset: true }),
  ]);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;
  const right = pageWidth - margin;
  const contentWidth = right - margin;
  let page: PDFPage;
  let cursor = 104;

  const text = (value: string, x: number, top: number, size = 10, font = regular, color = ink) => {
    page.drawText(clean(value), { x, y: pageHeight - top - size, size, font, color });
  };
  const rightText = (value: string, x: number, top: number, size = 10, font = regular, color = ink, maxWidth = 180) => {
    const str = clean(value);
    const fitted = Math.min(size, maxWidth / Math.max(1, font.widthOfTextAtSize(str, 1)));
    text(str, x - font.widthOfTextAtSize(str, fitted), top, fitted, font, color);
  };
  const paragraph = (value: string, x: number, top: number, width: number, size = 10, font = regular, color = muted, leading = size * 1.5) => {
    const lines = wrap(value, font, size, width);
    lines.forEach((value, i) => text(value, x, top + i * leading, size, font, color));
    return top + lines.length * leading;
  };
  const rule = (top: number) => page.drawLine({ start: { x: margin, y: pageHeight - top }, end: { x: right, y: pageHeight - top }, color: line, thickness: .6 });
  const panel = (top: number, height: number, color: RGB) => {
    const w = contentWidth;
    const r = 10;
    page.drawSvgPath(`M${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${height - r} Q${w} ${height} ${w - r} ${height} H${r} Q0 ${height} 0 ${height - r} V${r} Q0 0 ${r} 0 Z`, { x: margin, y: pageHeight - top, color });
  };
  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: margin, y: pageHeight - 60, width: 4, height: 27, color: ink });
    page.drawRectangle({ x: margin, y: pageHeight - 60, width: 18, height: 4, color: ink });
    for (let i = 0; i < 3; i++) page.drawRectangle({ x: margin + 11, y: pageHeight - 36 - i * 8, width: 12, height: 3, color: ink });
    text('legno&co.', margin + 34, 31, 23, semibold);
    text('FALEGNAMERIA SU MISURA', margin + 35, 62, 7.2, semibold, muted);
    rightText('PREVENTIVO INDICATIVO', right, 34, 8, semibold, muted, 180);
    rightText(new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }).format(now), right, 51, 10, regular);
    rule(83);
    cursor = 104;
  };
  const ensureSpace = (required: number) => { if (cursor + required > 790) addPage(); };
  addPage();

  text('Il tuo mobile,', margin, cursor, 30, semibold);
  text('messo nero su bianco.', margin, cursor + 39, 27, italic, hex('#738265'));
  text('Le tue scelte, tutti i dettagli, un prezzo chiaro.', margin, cursor + 81, 10.5, regular, muted);
  cursor = 215;

  const details = [
    { label: 'LEGNO', value: quote.wood.name },
    { label: 'FINITURA', value: quote.finish.name },
    { label: 'CONSEGNA', value: quote.delivery.name },
  ];
  const detailWidth = contentWidth - 257;
  const detailHeight = details.reduce((height, item) => height + 24 + wrap(item.value, semibold, 10.5, detailWidth).length * 14, 0);
  const configHeight = Math.max(160, detailHeight + 24);
  panel(cursor, configHeight, pale);
  drawFurniture(page!, margin + 8, cursor + 14, input, quote.wood.color);
  text('ANTEPRIMA INDICATIVA', margin + 34, cursor + configHeight - 22, 7.5, regular, muted);
  let detailTop = cursor + 14;
  for (const item of details) {
    text(item.label, margin + 235, detailTop, 7.5, semibold, muted);
    detailTop = paragraph(item.value, margin + 235, detailTop + 14, detailWidth, 10.5, semibold, ink, 14) + 10;
  }
  cursor += configHeight + 17;
  const measures = [
    ['LARGHEZZA', `${formatNumber(parseDimension(input.width)!.toNumber(), 6)} cm`],
    ['ALTEZZA', `${formatNumber(parseDimension(input.height)!.toNumber(), 6)} cm`],
    ['PROFONDITÀ', `${formatNumber(parseDimension(input.depth)!.toNumber(), 6)} cm`],
    ['SUPERFICIE', `${formatNumber(quote.area, 4)} m²`],
  ];
  measures.forEach(([label, value], index) => {
    const x = margin + index * contentWidth / 4;
    text(label, x, cursor, 7.5, semibold, muted);
    text(value, x, cursor + 16, 13.5, semibold);
  });
  cursor += 62;

  const rows = [
    { title: `Mobile in ${quote.wood.name}`, subtitle: `Finitura ${quote.finish.name} · ${formatCurrency(quote.wood.pricePerM2 + quote.finish.pricePerM2)}/m²`, quantity: `${formatNumber(quote.area, 4)} m²`, amount: quote.furniture },
    { title: quote.delivery.name, subtitle: 'Costo fisso di consegna', quantity: '1', amount: quote.delivery.price },
  ];
  const rowData = rows.map(row => ({ ...row, titleLines: wrap(row.title, semibold, 10.5, 280), subLines: wrap(row.subtitle, regular, 9, 280) }));
  const rowHeights = rowData.map(row => row.titleLines.length * 15 + row.subLines.length * 13 + 22);
  ensureSpace(53 + rowHeights.reduce((a, b) => a + b, 0));
  text('IL PREZZO, VOCE PER VOCE', margin, cursor, 8.5, semibold, muted);
  cursor += 26;
  text('Descrizione', margin, cursor, 8.5, semibold, muted);
  rightText('Quantità', right - 111, cursor, 8.5, semibold, muted);
  rightText('Importo', right, cursor, 8.5, semibold, muted);
  rule(cursor + 19);
  cursor += 31;
  rowData.forEach((row, index) => {
    paragraph(row.title, margin, cursor, 280, 10.5, semibold, ink, 15);
    paragraph(row.subtitle, margin, cursor + row.titleLines.length * 15 + 3, 280, 9, regular, muted, 13);
    rightText(row.quantity, right - 111, cursor + 1, 10, regular, muted, 77);
    rightText(formatCurrency(row.amount), right, cursor, 11, semibold, ink, 100);
    cursor += rowHeights[index];
    rule(cursor - 8);
  });

  // Keep tax, total and terms together; long catalog names can add a second page.
  ensureSpace(175);
  cursor += 9;
  text('Imponibile', right - 195, cursor, 10, regular, muted);
  rightText(formatCurrency(quote.net), right, cursor, 11, semibold);
  cursor += 23;
  text(`IVA (${formatNumber(catalog.settings.vatRate * 100, 4)}%)`, right - 195, cursor, 10, regular, muted);
  rightText(formatCurrency(quote.vat), right, cursor, 11, semibold);
  cursor += 33;
  panel(cursor, 65, ink);
  text('IL TUO TOTALE', margin + 20, cursor + 15, 10, semibold, hex('#e1e9d8'));
  text('IVA inclusa', margin + 20, cursor + 34, 9, regular, hex('#c1cfb3'));
  rightText(formatCurrency(quote.total), right - 20, cursor + 10, 31, italic, hex('#f1f5e8'), 290);
  cursor += 81;
  cursor = paragraph('Superficie comprensiva di tutti i sei lati. Importi arrotondati al centesimo.', margin, cursor, contentWidth, 8.3, regular, muted, 12);
  cursor = paragraph('Preventivo indicativo: non costituisce un ordine né un’offerta commerciale vincolante.', margin, cursor + 2, contentWidth, 8.3, regular, muted, 12);

  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawLine({ start: { x: margin, y: 36 }, end: { x: right, y: 36 }, color: line, thickness: .6 });
    p.drawText('Progetto didattico · Azienda e dati inventati', { x: margin, y: 20, size: 7, font: regular, color: muted });
    const footer = `Listino ${catalog.version} · ${index + 1}/${pages.length}`;
    const fitted = Math.min(7, 220 / Math.max(1, regular.widthOfTextAtSize(clean(footer), 1)));
    p.drawText(clean(footer), { x: right - regular.widthOfTextAtSize(clean(footer), fitted), y: 20, size: fitted, font: regular, color: muted });
  });
  return pdf.save();
}
