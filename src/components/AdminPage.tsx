import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, Check, LoaderCircle, LockKeyhole, LogOut, RefreshCw, Save, ShieldCheck, X } from 'lucide-react';
import ThemeSwitcher from './ThemeSwitcher';
import type { Catalog } from '../lib/catalog';
import { createPriceDraft, fetchAdminCatalog, getAdminClient, readPriceDraft, saveAdminCatalog, settingsFields, type PriceDraft } from '../lib/admin';
import { formatCurrency } from '../lib/quote';

type AuthMode = 'login' | 'activate' | 'reset' | 'password';
function AccessForm({ mode, setMode, onPasswordUpdated }: { mode: AuthMode; setMode: (mode: AuthMode) => void; onPasswordUpdated: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const changeMode = (next: AuthMode) => { setMode(next); setPassword(''); setRepeat(''); setMessage(''); setError(''); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    if ((mode === 'activate' || mode === 'password') && password !== repeat) { setError('Le due password non coincidono.'); return; }
    setBusy(true);
    try {
      const supabase = getAdminClient();
      const redirectTo = `${window.location.origin}/admin`;
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.code === 'email_not_confirmed' ? 'Conferma prima la tua email tramite il link ricevuto.' : 'Accesso non riuscito. Verifica email e password.');
      } else if (mode === 'activate') {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } });
        if (error) throw new Error(error.code === 'over_email_send_rate_limit' ? 'Troppe richieste email. Attendi qualche minuto prima di riprovare.' : 'Attivazione non riuscita. Verifica i dati o usa “Password dimenticata”.');
        setMessage('Controlla la tua email e conferma l’indirizzo tramite il link ricevuto. Poi torna qui e accedi. Solo l’email autorizzata può gestire il listino.');
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw new Error('Invio non riuscito. Attendi qualche minuto e riprova.');
        setMessage('Se l’indirizzo è registrato, riceverai il link per scegliere una nuova password. Controlla anche lo spam.');
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error('Non riusciamo a cambiare la password. Richiedi un nuovo link e riprova.');
        onPasswordUpdated();
      }
      setPassword(''); setRepeat('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Connessione non disponibile. Riprova.'); }
    finally { setBusy(false); }
  };
  return <section className="admin-access admin-card"><span className="admin-symbol"><LockKeyhole size={27} /></span>
    <h1>{mode === 'login' ? 'Bentornato in bottega.' : mode === 'activate' ? 'Il tuo primo accesso.' : mode === 'reset' ? 'Ripartiamo da qui.' : 'Una nuova password.'}</h1>
    <p>{mode === 'login' ? 'Accedi per curare prezzi e impostazioni del tuo listino.' : mode === 'activate' ? 'Scegli una password e conferma la tua email. L’area è riservata all’amministratore autorizzato.' : mode === 'reset' ? 'Ti invieremo un link per scegliere una nuova password.' : 'Scegli almeno 12 caratteri e conserva la password in un luogo sicuro.'}</p>
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        {mode !== 'password' && <label>Email<input type="email" required autoComplete="username" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>}
        {mode !== 'reset' && <label>Password<input type="password" required minLength={mode === 'login' ? 1 : 12} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} /></label>}
        {(mode === 'activate' || mode === 'password') && <label>Conferma password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={repeat} onChange={event => setRepeat(event.target.value)} /></label>}
        {error && <p className="admin-error" role="alert">{error}</p>}{message && <p className="admin-success" role="status">{message}</p>}
        <button className="admin-primary" type="submit">{busy ? <LoaderCircle size={18} className="spin" /> : <LockKeyhole size={17} />}{mode === 'login' ? 'Accedi' : mode === 'activate' ? 'Attiva il mio accesso' : mode === 'reset' ? 'Invia link di recupero' : 'Salva la nuova password'}</button>
      </fieldset>
    </form>
    <div className="admin-access-links">{mode === 'login' ? <><button disabled={busy} onClick={() => changeMode('activate')}>Primo accesso</button><button disabled={busy} onClick={() => changeMode('reset')}>Password dimenticata</button></> : mode !== 'password' && <button disabled={busy} onClick={() => changeMode('login')}>Torna all’accesso</button>}</div>
    <small>La sessione admin termina chiudendo questa scheda. I clienti continuano a usare il preventivatore senza account.</small>
  </section>;
}

export function CatalogEditor({ initialCatalog, signOut }: { initialCatalog: Catalog; signOut: () => void }) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [draft, setDraft] = useState<PriceDraft>(() => createPriceDraft(initialCatalog));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const confirm = useRef<HTMLDialogElement>(null);
  const original = createPriceDraft(catalog);
  const { errors } = readPriceDraft(catalog, draft);
  const changed = Object.keys(draft).filter(key => Number(draft[key].replace(',', '.')) !== Number(original[key].replace(',', '.')) || !draft[key].trim());
  const dirty = changed.length > 0;
  const valid = Object.keys(errors).length === 0;
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  const accept = (next: Catalog) => { setCatalog(next); setDraft(createPriceDraft(next)); };
  const edit = (key: string, value: string) => { setDraft(current => ({ ...current, [key]: value })); setSuccess(''); setError(''); };
  const reload = async () => {
    if (dirty && !window.confirm('Ricaricare il listino e scartare le modifiche non salvate?')) return;
    setBusy(true); setError(''); setSuccess('');
    try { accept(await fetchAdminCatalog()); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  const save = async () => {
    if (busy || !valid || !dirty) return;
    setBusy(true); setError(''); setSuccess(''); confirm.current?.close();
    try { accept(await saveAdminCatalog(catalog, draft)); setSuccess('Listino pubblicato. I nuovi prezzi sono già disponibili nel preventivatore.'); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  const labels = Object.fromEntries([
    ...catalog.woods.map(item => [`wood:${item.id}`, item.name]),
    ...catalog.finishes.map(item => [`finish:${item.id}`, item.name]),
    ...catalog.deliveries.map(item => [`delivery:${item.id}`, item.name]),
    ...settingsFields.map(field => [field.key, field.label]),
  ]);
  const field = (key: string, label: string, unit: string) => <label className="admin-field" key={key}><span id={`admin-label-${key}`}>{label}</span><span className="admin-input"><input aria-labelledby={`admin-label-${key}`} type="text" inputMode={key === 'maxShelves' ? 'numeric' : 'decimal'} autoComplete="off" value={draft[key]} aria-invalid={Boolean(errors[key])} aria-describedby={`admin-unit-${key}${errors[key] ? ` error-${key}` : ''}`} onChange={event => edit(key, event.target.value)} /><span id={`admin-unit-${key}`}>{unit}</span></span>{errors[key] && <small className="admin-error" id={`error-${key}`}>{errors[key]}</small>}</label>;
  const formatted = (key: string, value: string) => /^(wood|finish|delivery):/.test(key) ? formatCurrency(Number(value.replace(',', '.'))) : `${value} ${settingsFields.find(field => field.key === key)?.unit ?? ''}`;
  return <>
    <div className="admin-title"><div><p className="eyebrow">LA TUA BOTTEGA, SOTTO CONTROLLO</p><h1>Il listino, nelle tue mani.</h1><p>Prezzi chiari, dettagli curati. Ogni modifica aggiorna il preventivatore.</p></div><span className="admin-badge"><ShieldCheck size={18} /> Accesso amministratore</span></div>
    <div className="admin-status"><span>Listino {catalog.version}{catalog.updatedAt && <> · aggiornato il {new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(catalog.updatedAt))}</>}</span><button disabled={busy} onClick={reload}><RefreshCw size={16} /> Ricarica listino</button></div>
    {error && <p className="admin-error admin-notice" role="alert">{error}</p>}{success && <p className="admin-success admin-notice" role="status"><Check size={18} />{success}</p>}
    <form onSubmit={event => { event.preventDefault(); if (valid && dirty && !busy) confirm.current?.showModal(); }}>
      <fieldset disabled={busy} className="admin-grid">
        <section className="admin-card"><h2>01 <span>Essenze di legno</span></h2><p>Prezzo al m² · IVA esclusa</p>{catalog.woods.map(item => field(`wood:${item.id}`, item.name, '€/m²'))}</section>
        <section className="admin-card"><h2>02 <span>Finiture</span></h2><p>Supplemento al m² · IVA esclusa</p>{catalog.finishes.map(item => field(`finish:${item.id}`, item.name, '€/m²'))}</section>
        <section className="admin-card"><h2>03 <span>Consegna</span></h2><p>Costo fisso · IVA esclusa</p>{catalog.deliveries.map(item => field(`delivery:${item.id}`, item.name, '€'))}</section>
        <section className="admin-card"><h2>04 <span>Misure, ripiani e IVA</span></h2><p>I ripiani usano il prezzo di legno e finitura selezionati, con facce e bordi inclusi.</p>{settingsFields.map(item => field(item.key, item.label, item.unit))}</section>
      </fieldset>
      <div className="admin-savebar"><div><strong>{dirty ? `${changed.length} ${changed.length === 1 ? 'modifica da pubblicare' : 'modifiche da pubblicare'}` : 'Tutto aggiornato'}</strong><span>{valid ? 'Controlla il riepilogo prima di pubblicare.' : 'Correggi i campi indicati per continuare.'}</span></div><div><button type="button" className="admin-secondary" disabled={busy || !dirty} onClick={() => { if (window.confirm('Scartare le modifiche non salvate?')) { setDraft(original); setError(''); } }}>Annulla modifiche</button><button className="admin-primary" type="submit" disabled={busy || !dirty || !valid}>{busy ? <LoaderCircle size={18} className="spin" /> : <Save size={18} />} {busy ? 'Salvataggio…' : 'Rivedi e pubblica'}</button></div></div>
    </form>
    <p className="admin-exit-note">Le configurazioni dei clienti non vengono salvate. I preventivi già scaricati conservano i prezzi originari.</p>
    <button className="admin-logout" disabled={busy} onClick={() => { if (!dirty || window.confirm('Uscire e scartare le modifiche non salvate?')) signOut(); }}><LogOut size={17} /> Esci dall’area admin</button>
    <dialog ref={confirm} className="admin-confirm" aria-labelledby="publish-heading" onClick={event => { if (event.target === event.currentTarget) confirm.current?.close(); }}><button type="button" className="dialog-close" aria-label="Chiudi riepilogo" onClick={() => confirm.current?.close()}><X size={22} /></button><p className="eyebrow">UN ULTIMO SGUARDO</p><h2 id="publish-heading">Pubblicare il nuovo listino?</h2><p>Queste modifiche saranno disponibili a chi usa il preventivatore.</p><ul>{changed.map(key => <li key={key}><strong>{labels[key]}</strong><span>{formatted(key, original[key])} <span aria-label="diventa">→</span> {formatted(key, draft[key])}</span></li>)}</ul><div className="admin-confirm-actions"><button className="admin-secondary" type="button" onClick={() => confirm.current?.close()}>Torna a modificare</button><button className="admin-primary" type="button" onClick={save}><Check size={18} /> Pubblica listino</button></div></dialog>
  </>;
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [mode, setMode] = useState<AuthMode>(() => new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery' ? 'password' : 'login');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState(() => new URLSearchParams(window.location.hash.slice(1)).has('error') ? 'Il link di accesso è scaduto o non è valido. Richiedi un nuovo link da “Primo accesso” o “Password dimenticata”.' : '');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    document.title = 'La tua bottega · Area admin · Legno & Co.';
    let live = true;
    try {
      const supabase = getAdminClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
        if (!live) return;
        setSession(next); setInitializing(false);
        if (event === 'PASSWORD_RECOVERY') setMode('password');
      });
      void supabase.auth.getSession().then(({ data, error }) => { if (live) { setSession(data.session); setInitializing(false); if (error) setError('Sessione non disponibile. Accedi nuovamente.'); } }).catch(() => { if (live) { setInitializing(false); setError('Connessione non disponibile. Ricarica la pagina.'); } });
      return () => { live = false; subscription.unsubscribe(); };
    } catch (cause) { setInitializing(false); setError((cause as Error).message); }
  }, []);
  const userId = session?.user.id;
  useEffect(() => {
    setCatalog(null);
    if (!userId) return;
    setError('');
    let live = true;
    void fetchAdminCatalog().then(next => { if (live) setCatalog(next); }).catch(cause => { if (live) setError(cause.message); });
    return () => { live = false; };
  }, [userId, retry]);
  const signOut = async () => { const { error } = await getAdminClient().auth.signOut({ scope: 'local' }); if (error) setError('Non riusciamo a chiudere la sessione. Riprova.'); else { setSession(null); setCatalog(null); setMode('login'); } };
  return <div className="admin-page"><header className="admin-header"><a href="/" className="admin-brand">legno&co<span>.</span><small>LA TUA BOTTEGA</small></a><div><a href="/" className="admin-back" aria-label="Torna al preventivatore"><ArrowLeft size={17} /><span>Torna al preventivatore</span></a><ThemeSwitcher /></div></header><main className="admin-main">
    {initializing ? <p className="admin-loading" role="status"><LoaderCircle className="spin" size={25} /> Verifichiamo il tuo accesso…</p> : mode === 'password' && session ? <AccessForm mode={mode} setMode={setMode} onPasswordUpdated={() => setMode('login')} /> : !session ? <><AccessForm mode={mode} setMode={setMode} onPasswordUpdated={() => setMode('login')} />{error && <p role="alert" className="admin-error">{error}</p>}</> : catalog ? <CatalogEditor initialCatalog={catalog} signOut={signOut} /> : error ? <section className="admin-card admin-access"><ShieldCheck size={30} /><h1>Controlliamo l’accesso.</h1><p role="alert">{error}</p><button className="admin-primary" onClick={() => setRetry(value => value + 1)}>Riprova</button><button className="admin-logout" onClick={signOut}>Esci</button></section> : <p className="admin-loading" role="status"><LoaderCircle className="spin" size={25} /> Apriamo il listino…</p>}
  </main><footer className="admin-footer">Legno & Co. · Progetto didattico · Area riservata</footer></div>;
}
