import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rawCatalog from '../public/data/catalog.json';
import { parseCatalog } from '../src/lib/catalog';
import { createQuotePdf } from '../src/lib/quotePdf';

vi.mock('../src/lib/quotePdf', () => ({ createQuotePdf: vi.fn() }));
const input = { width: '120', height: '80', depth: '40', woodId: 'rovere', finishId: 'cera-naturale', deliveryId: 'entro-50-km' };
const catalog = parseCatalog(rawCatalog);
const NativeURL = URL;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-26T23:30:00Z'));
  vi.mocked(createQuotePdf).mockReset().mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Download locale', () => {
  it('scarica un file PDF con data italiana e non trasmette i dati del preventivo', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    const createObjectURL = vi.fn().mockReturnValue('blob:quote-example');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', class extends NativeURL { static createObjectURL = createObjectURL; static revokeObjectURL = revokeObjectURL; });
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      filename = this.download;
      expect(this.getAttribute('href')).toBe('blob:quote-example');
    });
    const { downloadQuote } = await import('../src/lib/downloadQuote');
    await downloadQuote(input, catalog);
    expect(filename).toBe('preventivo-legno-co-2026-10-27.pdf');
    expect(createObjectURL.mock.calls[0][0].type).toBe('application/pdf');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(String(url)).toMatch(/\.woff/);
      expect(options).not.toHaveProperty('body');
    }
    expect(document.querySelector('a[download]')).toBeNull();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:quote-example');
  });
  it('permette un nuovo tentativo dopo un errore di caricamento dei caratteri', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    const { downloadQuote } = await import('../src/lib/downloadQuote');
    await expect(downloadQuote(input, catalog)).rejects.toThrow('Controlla la connessione');
    expect(createQuotePdf).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    vi.stubGlobal('URL', class extends NativeURL { static createObjectURL = () => 'blob:retry'; static revokeObjectURL = vi.fn(); });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(downloadQuote(input, catalog)).resolves.toBeUndefined();
    expect(createQuotePdf).toHaveBeenCalledTimes(1);
  });
});
