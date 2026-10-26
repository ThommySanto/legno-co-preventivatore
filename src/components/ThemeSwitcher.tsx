import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return <div className="theme-switcher" role="group" aria-label="Aspetto del sito">
    <button type="button" aria-label="Tema chiaro" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
      <Sun size={15} aria-hidden="true" /><span>Chiaro</span>
    </button>
    <button type="button" aria-label="Tema scuro" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
      <Moon size={15} aria-hidden="true" /><span>Scuro</span>
    </button>
  </div>;
}
