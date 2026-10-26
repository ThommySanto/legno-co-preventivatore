import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Catalog } from '../lib/catalog';
import type { calculateQuote, Dimensions } from '../lib/quote';
import { formatCurrency, formatNumber, parseDimension } from '../lib/quote';
import FurniturePreview from './FurniturePreview';

export default function QuotePrintView({ dimensions, quote, catalog }: {
  dimensions: Dimensions;
  quote: NonNullable<ReturnType<typeof calculateQuote>>;
  catalog: Catalog;
}) {
  const [printedAt, setPrintedAt] = useState(() => new Date());
  useEffect(() => {
    const beforePrint = () => flushSync(() => setPrintedAt(new Date()));
    window.addEventListener('beforeprint', beforePrint);
    return () => window.removeEventListener('beforeprint', beforePrint);
  }, []);
  const date = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }).format(printedAt);

  return <article className="quote-print" aria-hidden="true" data-testid="print-document">
    <header className="quote-print-header">
      <div className="quote-print-brand"><span className="brand-mark"><span /><i /><i /><i /></span><div><strong>legno&co.</strong><small>FALEGNAMERIA SU MISURA</small></div></div>
      <div className="quote-print-date"><strong>PREVENTIVO INDICATIVO</strong><span>{date}</span></div>
    </header>
    <div className="quote-print-intro"><h1>Il tuo mobile,</h1><p>messo nero su bianco.</p><span>Le tue scelte, tutti i dettagli, un prezzo chiaro.</span></div>
    <section className="quote-print-config">
      <figure><FurniturePreview dimensions={dimensions} color={quote.wood.color} name={quote.wood.name} valid /><figcaption>ANTEPRIMA INDICATIVA</figcaption></figure>
      <dl><div><dt>LEGNO</dt><dd>{quote.wood.name}</dd></div><div><dt>FINITURA</dt><dd>{quote.finish.name}</dd></div><div><dt>CONSEGNA</dt><dd>{quote.delivery.name}</dd></div></dl>
    </section>
    <dl className="quote-print-measures">
      <div><dt>LARGHEZZA</dt><dd>{formatNumber(parseDimension(dimensions.width)!.toNumber(), 6)} cm</dd></div>
      <div><dt>ALTEZZA</dt><dd>{formatNumber(parseDimension(dimensions.height)!.toNumber(), 6)} cm</dd></div>
      <div><dt>PROFONDITÀ</dt><dd>{formatNumber(parseDimension(dimensions.depth)!.toNumber(), 6)} cm</dd></div>
      <div><dt>SUPERFICIE</dt><dd>{formatNumber(quote.area, 4)} m²</dd></div>
    </dl>
    <section className="quote-print-prices"><h2>IL PREZZO, VOCE PER VOCE</h2><table><thead><tr><th>Descrizione</th><th>Quantità</th><th>Importo</th></tr></thead><tbody>
      <tr><td><strong>Mobile in {quote.wood.name}</strong><span>Finitura {quote.finish.name} · {formatCurrency(quote.wood.pricePerM2 + quote.finish.pricePerM2)}/m²</span></td><td>{formatNumber(quote.area, 4)} m²</td><td><strong>{formatCurrency(quote.furniture)}</strong></td></tr>
      <tr><td><strong>{quote.delivery.name}</strong><span>Costo fisso di consegna</span></td><td>1</td><td><strong>{formatCurrency(quote.delivery.price)}</strong></td></tr>
    </tbody></table></section>
    <section className="quote-print-summary"><dl><div><dt>Imponibile</dt><dd>{formatCurrency(quote.net)}</dd></div><div><dt>IVA ({formatNumber(catalog.settings.vatRate * 100, 4)}%)</dt><dd>{formatCurrency(quote.vat)}</dd></div></dl>
      <div className="quote-print-total"><span><strong>IL TUO TOTALE</strong><small>IVA inclusa</small></span><strong data-testid="print-total">{formatCurrency(quote.total)}</strong></div>
      <p>Superficie comprensiva di tutti i sei lati. Importi arrotondati al centesimo.</p><p>Preventivo indicativo: non costituisce un ordine né un’offerta commerciale vincolante.</p>
    </section>
    <footer className="quote-print-footer"><span>Progetto didattico · Azienda e dati inventati</span><span>Listino {catalog.version}</span></footer>
  </article>;
}
