import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeSwitcher from '../src/components/ThemeSwitcher';
import { THEME_STORAGE_KEY } from '../src/hooks/useTheme';

beforeEach(() => {
  localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('style');
});

describe('Preferenza del tema', () => {
  it('parte dal tema chiaro e ricorda lo scuro dopo una nuova apertura', async () => {
    const user = userEvent.setup();
    const first = render(<ThemeSwitcher />);
    expect(screen.getByRole('button', { name: 'Tema chiaro' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Tema scuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    first.unmount();
    render(<ThemeSwitcher />);
    expect(screen.getByRole('button', { name: 'Tema scuro' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Tema chiaro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
  it('si usa da tastiera e aggiorna il colore dell’interfaccia del browser', async () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(meta.content).toBe('#111715');
    meta.remove();
  });
  it('funziona anche quando il browser impedisce di leggere o scrivere la preferenza', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.click(screen.getByRole('button', { name: 'Tema scuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Tema chiaro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
  it('sincronizza le schede e ignora altre preferenze', () => {
    render(<ThemeSwitcher />);
    fireEvent(window, new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent(window, new StorageEvent('storage', { key: 'unrelated', newValue: 'light' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent(window, new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: null }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
  it('ignora una preferenza salvata non valida', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'unexpected');
    render(<ThemeSwitcher />);
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
