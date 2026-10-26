import regularUrl from '@fontsource/inter/files/inter-latin-400-normal.woff?url';
import semiboldUrl from '@fontsource/inter/files/inter-latin-600-normal.woff?url';
import italicUrl from '@fontsource/lora/files/lora-latin-400-italic.woff?url';
import type { Catalog } from './catalog';
import type { QuoteInput } from './quote';
import { createQuotePdf } from './quotePdf';
import type { QuotePdfFonts } from './quotePdf';

let fontRequest: Promise<QuotePdfFonts> | undefined;
function loadFonts() {
  if (!fontRequest) fontRequest = Promise.all([regularUrl, semiboldUrl, italicUrl].map(async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('Non riusciamo a preparare il PDF. Controlla la connessione e riprova.');
    return new Uint8Array(await response.arrayBuffer());
  })).then(([regular, semibold, italic]) => ({ regular, semibold, italic })).catch(error => {
    fontRequest = undefined;
    throw error;
  });
  return fontRequest;
}

export async function downloadQuote(input: QuoteInput, catalog: Catalog): Promise<void> {
  const now = new Date();
  const bytes = await createQuotePdf(input, catalog, await loadFonts(), now);
  const blob = new Blob([Uint8Array.from(bytes).buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(now);
  anchor.href = url;
  anchor.download = `preventivo-legno-co-${day}.pdf`;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Allow mobile browsers to consume the blob before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
