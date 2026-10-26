import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelViewer from '../src/components/ModelViewer';
import rawCatalog from '../public/data/catalog.json';
const engine = vi.hoisted(() => ({
  update: vi.fn(), view: vi.fn(), zoom: vi.fn(), rotate: vi.fn(), autoRotate: vi.fn(),
  explode: vi.fn(), measurements: vi.fn(), active: vi.fn(), motion: vi.fn(), dispose: vi.fn(),
}));
vi.mock('../src/lib/furnitureScene', () => ({ createFurnitureScene: vi.fn(() => engine) }));
const props = { dimensions: { width: '120', height: '80', depth: '40' }, wood: rawCatalog.woods[3], finish: rawCatalog.finishes[1], shelfCount: 2, thicknessCm: 2, valid: true };
beforeEach(() => {
  vi.stubGlobal('WebGL2RenderingContext', class {});
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Object.values(engine).forEach(fn => fn.mockClear());
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
});
afterEach(() => vi.unstubAllGlobals());
describe('Studio interattivo, indipendente dal preventivo', () => {
  it('permette viste, zoom da tastiera, struttura e dettagli senza modificare la configurazione', async () => {
    const user = userEvent.setup();
    const before = JSON.stringify(props);
    const { unmount } = render(<ModelViewer {...props} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Frontale' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Frontale' }));
    expect(engine.view).toHaveBeenCalledWith('front');
    fireEvent.keyDown(screen.getByRole('group', { name: /Modello 3D/ }), { key: '+' });
    expect(engine.zoom).toHaveBeenCalledWith(.82);
    await user.click(screen.getByRole('button', { name: 'Esplora struttura' }));
    expect(engine.explode).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Mostra misure' }));
    expect(screen.getByLabelText('Misure del modello')).toHaveTextContent('120');
    await user.click(screen.getByRole('button', { name: 'Dettagli' }));
    expect(screen.getByText(/Spessore pannelli e ripiani:/)).toHaveTextContent('2 cm');
    expect(JSON.stringify(props)).toBe(before);
    unmount(); expect(engine.dispose).toHaveBeenCalled();
  });
  it('apre una vista ingrandita accessibile e torna ai comandi originali alla chiusura', async () => {
    const user = userEvent.setup();
    render(<ModelViewer {...props} />);
    await user.click(screen.getByRole('button', { name: 'Ingrandisci anteprima 3D' }));
    const dialog = screen.getByRole('dialog', { name: 'Esplora il tuo mobile in 3D' });
    expect(dialog).toHaveTextContent('Ogni dettaglio, il tuo stile.');
    await user.click(within(dialog).getByRole('button', { name: 'Chiudi anteprima ingrandita' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('mostra una vista illustrata se il dispositivo non supporta il 3D', async () => {
    vi.stubGlobal('WebGL2RenderingContext', undefined);
    render(<ModelViewer {...props} />);
    expect(await screen.findByText(/il 3D non è disponibile/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Frontale' })).toBeDisabled();
    expect(screen.getByRole('img', { name: /Anteprima indicativa in/ })).toBeInTheDocument();
  });
});

