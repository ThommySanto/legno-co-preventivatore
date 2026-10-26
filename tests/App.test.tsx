import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import rawCatalog from '../public/data/catalog.json';
import { parseCatalog } from '../src/lib/catalog';
import { loadCatalog } from '../src/lib/loadCatalog';
import App from '../src/App';

vi.mock('../src/lib/loadCatalog', () => ({ loadCatalog: vi.fn(), getCatalogMode: () => 'supabase' }));
beforeEach(() => vi.mocked(loadCatalog).mockReset().mockResolvedValue(parseCatalog(rawCatalog)));

describe('Configuratore cliente', () => {
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
