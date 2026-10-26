import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import rawCatalog from '../public/data/catalog.json';
import { parseCatalog } from '../src/lib/catalog';
import { calculateQuote } from '../src/lib/quote';
import QuotePrintView from '../src/components/QuotePrintView';

const catalog = parseCatalog(rawCatalog);
const input = { width: '120', height: '80', depth: '40', woodId: 'rovere', finishId: 'cera-naturale', deliveryId: 'entro-50-km' };
const quote = calculateQuote(input, catalog)!;
afterEach(() => vi.useRealTimers());

describe('Modello di stampa', () => {
  it('usa intestazione, configurazione e dettagli del nuovo preventivo', () => {
    render(<QuotePrintView dimensions={input} quote={quote} catalog={catalog} />);
    const document = screen.getByTestId('print-document');
    expect(document).toHaveTextContent('messo nero su bianco.');
    expect(document).toHaveTextContent('Mobile in Rovere');
    expect(document).toHaveTextContent('Finitura Cera naturale');
    expect(document).toHaveTextContent('735,84');
    expect(document).toHaveTextContent('161,88');
    expect(screen.getByTestId('print-total')).toHaveTextContent('897,72');
    expect(document).toHaveTextContent('120 cm');
  });
  it('aggiorna la data all’apertura della stampa anche da tastiera', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));
    render(<QuotePrintView dimensions={input} quote={quote} catalog={catalog} />);
    expect(screen.getByTestId('print-document')).toHaveTextContent('26 ottobre 2026');
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'));
    fireEvent(window, new Event('beforeprint'));
    expect(screen.getByTestId('print-document')).toHaveTextContent('27 ottobre 2026');
  });
});
