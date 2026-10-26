import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import rawCatalog from '../public/data/catalog.json';
import { parseCatalog } from '../src/lib/catalog';
import { loadCatalog } from '../src/lib/loadCatalog';
import App from '../src/App';
import { downloadQuote } from '../src/lib/downloadQuote';

vi.mock('../src/lib/loadCatalog', () => ({ loadCatalog: vi.fn(), getCatalogMode: () => 'supabase' }));
vi.mock('../src/lib/downloadQuote', () => ({ downloadQuote: vi.fn() }));
beforeEach(() => { vi.mocked(loadCatalog).mockReset().mockResolvedValue(parseCatalog(rawCatalog)); });
beforeEach(() => { vi.mocked(downloadQuote).mockReset().mockResolvedValue(undefined); });

describe('Configuratore cliente', () => {
  it('scarica una copia del preventivo e impedisce doppi clic durante la creazione', async () => {
    let finish!: () => void;
    vi.mocked(downloadQuote).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByTestId('total');
    fireEvent.change(screen.getByLabelText('Larghezza'), { target: { value: '150' } });
    await user.click(screen.getByRole('button', { name: 'Scarica il preventivo' }));
    expect(screen.getByRole('button', { name: 'Creo il PDF…' })).toBeDisabled();
    expect(downloadQuote).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Larghezza'), { target: { value: '180' } });
    expect(vi.mocked(downloadQuote).mock.calls[0][0].width).toBe('150');
    expect(vi.mocked(downloadQuote).mock.calls[0][1]).toEqual(parseCatalog(rawCatalog));
    await act(async () => finish());
    expect(screen.getByRole('button', { name: 'Scarica il preventivo' })).toBeEnabled();
  });
  it('mostra un errore recuperabile se il PDF non può essere creato', async () => {
    vi.mocked(downloadQuote).mockRejectedValueOnce(new Error('Font non disponibile'));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByTestId('total');
    await user.click(screen.getByRole('button', { name: 'Scarica il preventivo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Non riusciamo a creare il PDF');
    expect(screen.getByTestId('total')).toHaveTextContent('897,72');
    await user.click(screen.getByRole('button', { name: 'Scarica il preventivo' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('cambia tema conservando misure e totale e salva solo la preferenza di aspetto', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    render(<App />);
    await screen.findByTestId('total');
    fireEvent.change(screen.getByLabelText('Larghezza'), { target: { value: '150' } });
    const total = screen.getByTestId('total').textContent;
    await user.click(screen.getByRole('button', { name: 'Tema scuro' }));
    expect(screen.getByLabelText('Larghezza')).toHaveValue('150');
    expect(screen.getByTestId('total').textContent).toBe(total);
    expect(Object.keys(localStorage)).toEqual(['legno-co:theme:v1']);
    expect(loadCatalog).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Tema chiaro' }));
    localStorage.clear();
  });
  it('mostra C1 e aggiorna il totale selezionando un altro legno', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByTestId('total')).toHaveTextContent('897,72');
    await user.click(screen.getByRole('radio', { name: /Abete/ }));
    expect(screen.getByTestId('total')).toHaveTextContent('489,76');
  });
  it('nasconde il prezzo per misure errate e lo ripristina dopo la correzione', async () => {
    render(<App />);
    await screen.findByTestId('total');
    fireEvent.change(screen.getByLabelText('Larghezza'), { target: { value: '20' } });
    expect(screen.queryByTestId('total')).not.toBeInTheDocument();
    expect(screen.queryByTestId('print-document')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Larghezza')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('La misura deve essere tra 30 e 300 cm.')).toBeVisible();
    expect(screen.getByRole('button', { name: /Stampa/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Larghezza'), { target: { value: '120,25' } });
    expect(screen.getByTestId('total')).toBeVisible();
  });
  it('aggiorna finitura e consegna e permette di ricominciare', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByTestId('total');
    await user.click(screen.getByRole('radio', { name: /Grezzo/ }));
    await user.click(screen.getByRole('radio', { name: /Ritiro in sede/ }));
    expect(screen.getByTestId('total')).toHaveTextContent('772,99');
    await user.click(screen.getByRole('button', { name: /Ricomincia/ }));
    expect(screen.getByTestId('total')).toHaveTextContent('897,72');
  });
  it('mostra errore e consente di riprovare senza mostrare un vecchio totale', async () => {
    vi.mocked(loadCatalog).mockRejectedValueOnce(new Error('Listino temporaneamente non disponibile'));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Listino temporaneamente non disponibile');
    expect(screen.queryByTestId('total')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByTestId('total')).toHaveTextContent('897,72');
  });
  it('al cambio di prezzo conserva le misure ma nasconde il totale durante il caricamento', async () => {
    render(<App />);
    await screen.findByTestId('total');
    fireEvent.change(screen.getByLabelText('Larghezza'), { target: { value: '150' } });
    let resolve!: (value: ReturnType<typeof parseCatalog>) => void;
    vi.mocked(loadCatalog).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna il listino' }));
    expect(screen.queryByTestId('total')).not.toBeVisible();
    const updated = structuredClone(rawCatalog);
    updated.woods.find(w => w.id === 'rovere')!.pricePerM2 = 200;
    await act(async () => resolve(parseCatalog(updated)));
    await waitFor(() => expect(screen.getByLabelText('Larghezza')).toHaveValue('150'));
    expect(screen.getByTestId('total')).toHaveTextContent('1.169,83');
  });
});
