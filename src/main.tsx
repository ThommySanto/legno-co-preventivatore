import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/latin-400-italic.css';
import './styles.css';
import './themes.css';
import './refinements.css';
import './print.css';
import './admin.css';

const AdminPage = lazy(() => import('./components/AdminPage'));
createRoot(document.getElementById('root')!).render(<StrictMode>{window.location.pathname.replace(/\/$/, '') === '/admin' ? <Suspense fallback={<p role="status" className="admin-loading">Apriamo la bottega…</p>}><AdminPage /></Suspense> : <App />}</StrictMode>);
