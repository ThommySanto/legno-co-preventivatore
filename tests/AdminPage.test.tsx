import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import rawCatalog from '../public/data/catalog.json';
import { parseCatalog } from '../src/lib/catalog';
import { CatalogEditor } from '../src/components/AdminPage';
import { fetchAdminCatalog, saveAdminCatalog } from '../src/lib/admin';
vi.mock('../src/lib/admin', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/lib/admin')>();
  return { ...actual, fetchAdminCatalog: vi.fn(), saveAdminCatalog: vi.fn() };
});
const catalog = parseCatalog(rawCatalog);
beforeEach(() => {
  vi.mocked(saveAdminCatalog).mockReset(); vi.mocked(fetchAdminCatalog).mockReset();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
describe('Editor listino amministratore', () => {
  it('richiede la revisione delle modifiche e pubblica tutti i valori insieme', async () => {
    const user = userEvent.setup();
    const updated = structuredClone(catalog);
    updated.woods.find(item => item.id === 'rovere')!.pricePerM2 = 198.5;
    updated.revision = 1; updated.version = '20261026.1';
    vi.mocked(saveAdminCatalog).mockResolvedValue(updated);
    render(<CatalogEditor initialCatalog={catalog} signOut={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Rivedi e pubblica' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Rovere'), { target: { value: '198,50' } });
    await user.click(screen.getByRole('button', { name: 'Rivedi e pubblica' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('198,50');
    expect(saveAdminCatalog).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Pubblica listino' }));
    expect(saveAdminCatalog).toHaveBeenCalledWith(catalog, expect.objectContaining({ 'wood:rovere': '198,50' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Listino pubblicato');
    expect(screen.getByRole('button', { name: 'Rivedi e pubblica' })).toBeDisabled();
  });
  it('blocca prezzi invalidi e conserva la bozza se il salvataggio fallisce', async () => {
    const user = userEvent.setup();
    vi.mocked(saveAdminCatalog).mockRejectedValue(new Error('Listino aggiornato da un’altra scheda.'));
    render(<CatalogEditor initialCatalog={catalog} signOut={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Rovere'), { target: { value: '-1' } });
    expect(screen.getByRole('button', { name: 'Rivedi e pubblica' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Rovere'), { target: { value: '190' } });
    await user.click(screen.getByRole('button', { name: 'Rivedi e pubblica' }));
    await user.click(screen.getByRole('button', { name: 'Pubblica listino' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('altra scheda');
    expect(screen.getByLabelText('Rovere')).toHaveValue('190');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rivedi e pubblica' })).toBeEnabled());
  });
});
