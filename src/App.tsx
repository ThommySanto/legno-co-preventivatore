import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Leaf, LoaderCircle, LockKeyhole, PackageCheck, Printer, RefreshCw, RotateCcw, Ruler, ShieldCheck, Sparkles, Truck, X } from 'lucide-react';
import FurniturePreview from './components/FurniturePreview';
import ThemeSwitcher from './components/ThemeSwitcher';
import { useCatalog } from './hooks/useCatalog';
import type { Catalog } from './lib/catalog';
import { getCatalogMode } from './lib/loadCatalog';
import { calculateQuote, dimensionLabels, formatCurrency, formatNumber, validateDimensions } from './lib/quote';
import type { DimensionKey, Dimensions, Selection } from './lib/quote';

const initialDimensions: Dimensions = { width: '120', height: '80', depth: '40' };
const defaultSelection: Selection = { woodId: 'rovere', finishId: 'cera-naturale', deliveryId: 'entro-50-km' };

function SectionHeading({ number, title, children }: { number: string; title: string; children?: ReactNode }) {
  return <div className="section-heading"><span className="step-number">{number}</span><h2>{title}</h2>{children}</div>;
}

function Configurator({ catalog, refresh }: { catalog: Catalog; refresh: () => void }) {
  const [dimensions, setDimensions] = useState<Dimensions>(initialDimensions);
  const [selection, setSelection] = useState<Selection>(defaultSelection);
  const [showFormula, setShowFormula] = useState(false);
  // Preserve valid user choices when the owner changes the listino; replace removed options.
  const resolvedSelection: Selection = {
    woodId: catalog.woods.some(i => i.id === selection.woodId) ? selection.woodId : catalog.woods[0].id,
    finishId: catalog.finishes.some(i => i.id === selection.finishId) ? selection.finishId : catalog.finishes[0].id,
    deliveryId: catalog.deliveries.some(i => i.id === selection.deliveryId) ? selection.deliveryId : catalog.deliveries[0].id,
  };
  const quote = calculateQuote({ ...dimensions, ...resolvedSelection }, catalog);
  const errors = validateDimensions(dimensions, catalog);
  const wood = catalog.woods.find(i => i.id === resolvedSelection.woodId)!;
  const finish = catalog.finishes.find(i => i.id === resolvedSelection.finishId)!;
  const delivery = catalog.deliveries.find(i => i.id === resolvedSelection.deliveryId)!;
  const select = (field: keyof Selection, id: string) => setSelection(current => ({ ...current, [field]: id }));
  const reset = () => { setDimensions(initialDimensions); setSelection(defaultSelection); };

  return <div className="configurator-layout" id="configuratore">
    <div className="configuration">
      <div className="config-intro"><span className="eyebrow">IL TUO PROGETTO, PASSO DOPO PASSO</span><button className="text-button reset-button" onClick={reset}><RotateCcw size={14} /> Ricomincia</button></div>
      <section className="config-section dimensions-section" aria-labelledby="dimensions-heading">
        <div className="section-heading"><span className="step-number">01</span><h2 id="dimensions-heading">Partiamo dalle misure</h2><Ruler className="heading-icon" size={20} /></div>
        <p className="section-description">Trova il posto giusto. Al resto pensiamo noi.</p>
        <div className="dimension-inputs">
          {(Object.keys(dimensionLabels) as DimensionKey[]).map(key => <div className="dimension-field" key={key}>
            <label htmlFor={key}>{dimensionLabels[key]}</label>
            <div className={`input-shell ${errors[key] ? 'invalid' : ''}`}>
              <input id={key} name={key} inputMode="decimal" type="text" autoComplete="off" spellCheck={false}
                value={dimensions[key]} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error measure-help` : 'measure-help'}
                onChange={e => setDimensions(current => ({ ...current, [key]: e.target.value }))} />
              <span>cm</span>
            </div>
            {errors[key] && <p className="field-error" id={`${key}-error`}>{errors[key]}</p>}
          </div>)}
        </div>
        <p className="field-hint" id="measure-help"><CircleHelp size={13} /> Ogni misura può andare da {formatNumber(catalog.settings.minDimensionCm)} a {formatNumber(catalog.settings.maxDimensionCm)} cm.</p>
      </section>

      <section className="config-section">
        <SectionHeading number="02" title="Scegli il tuo legno" />
        <p className="section-description">Ogni essenza ha una storia. Qual è la tua?</p>
        <fieldset className="wood-options"><legend className="sr-only">Tipo di legno</legend>
          {catalog.woods.map(item => <label className={`wood-option ${resolvedSelection.woodId === item.id ? 'selected' : ''}`} key={item.id}>
            <input type="radio" name="wood" value={item.id} checked={resolvedSelection.woodId === item.id} onChange={() => select('woodId', item.id)} />
            <span className={`wood-swatch swatch-${item.id}`} style={{ '--swatch': item.color } as CSSProperties} aria-hidden="true">
              {resolvedSelection.woodId === item.id && <span className="swatch-check"><Check size={13} strokeWidth={3} /></span>}
            </span><span className="wood-name">{item.name}</span><span className="wood-price">{formatCurrency(item.pricePerM2)}<small>/m²</small></span>
          </label>)}
        </fieldset>
        <div className="material-note"><Leaf size={15} /><span><strong>{wood.name}.</strong> {wood.description}.</span><span className="net-price-note">Prezzi IVA esclusa</span></div>
      </section>

      <section className="config-section">
        <SectionHeading number="03" title="Il tocco finale" />
        <p className="section-description">La finitura che valorizza il tuo mobile.</p>
        <fieldset className="finish-options"><legend className="sr-only">Finitura</legend>
          {catalog.finishes.map(item => <label className={`finish-option ${resolvedSelection.finishId === item.id ? 'selected' : ''}`} key={item.id}>
            <input type="radio" name="finish" value={item.id} checked={resolvedSelection.finishId === item.id} onChange={() => select('finishId', item.id)} />
            <span className="radio-indicator" aria-hidden="true" /><span><strong>{item.name}</strong><small>{item.description}</small></span>
            <span className="option-price">{item.pricePerM2 === 0 ? 'Incluso' : `+ ${formatCurrency(item.pricePerM2)}`}<small>{item.pricePerM2 === 0 ? 'nessun supplemento' : 'al m² · IVA esclusa'}</small></span>
          </label>)}
        </fieldset>
      </section>

      <section className="config-section delivery-section">
        <SectionHeading number="04" title="Come arriva da te?" />
        <p className="section-description">Scegli il ritiro o la consegna più adatta.</p>
        <fieldset className="delivery-options"><legend className="sr-only">Consegna</legend>
          {catalog.deliveries.map((item, index) => <label className={`delivery-option ${resolvedSelection.deliveryId === item.id ? 'selected' : ''}`} key={item.id}>
            <input type="radio" name="delivery" value={item.id} checked={resolvedSelection.deliveryId === item.id} onChange={() => select('deliveryId', item.id)} />
            {index === 0 ? <PackageCheck size={22} strokeWidth={1.5} /> : <Truck size={22} strokeWidth={1.5} />}
            <strong>{item.name}</strong><span>{item.price === 0 ? 'Gratuito' : `${formatCurrency(item.price)}`}</span><small>IVA esclusa</small>
            {resolvedSelection.deliveryId === item.id && <Check className="delivery-check" size={13} />}
          </label>)}
        </fieldset>
      </section>
      <p className="privacy-note"><LockKeyhole size={15} /> Le tue misure restano qui: non vengono salvate né inviate.</p>
    </div>

    <aside className="project-sidebar" aria-label="Anteprima e preventivo">
      <div className="preview-panel">
        <div className="preview-topline"><span className="eyebrow">PRENDE FORMA, LA TUA IDEA</span><span className="preview-label"><span /> Anteprima</span></div>
        <FurniturePreview dimensions={dimensions} color={wood.color} name={wood.name} valid={Boolean(quote)} />
        <div className="preview-caption"><span><i style={{ backgroundColor: wood.color }} />{wood.name}<span className="caption-divider">/</span>{finish.name}</span><small>Illustrazione indicativa</small></div>
      </div>

      <section className="quote-panel" id="riepilogo" aria-labelledby="quote-heading">
        <div className="quote-title"><h2 id="quote-heading">Il tuo preventivo</h2><span><span className="live-dot" /> In tempo reale</span></div>
        <div aria-live="polite" aria-atomic="true" data-testid="quote-result">
          {quote ? <>
            <div className="quote-details"><div><span>Superficie totale <button className="inline-info" aria-label="Come si calcola la superficie" aria-expanded={showFormula} onClick={() => setShowFormula(v => !v)}><CircleHelp size={13} /></button></span><strong>{formatNumber(quote.area, 4)} m²</strong></div>
              {showFormula && <p className="formula-note">Tutti i sei lati inclusi: 2 × (larghezza × altezza + larghezza × profondità + altezza × profondità) ÷ 10.000.</p>}
              <div><span>Mobile e finitura</span><strong>{formatCurrency(quote.furniture)}</strong></div>
              <div><span>{delivery.name}</span><strong>{formatCurrency(delivery.price)}</strong></div>
            </div>
            <div className="quote-subtotals"><div><span>Imponibile</span><strong>{formatCurrency(quote.net)}</strong></div><div><span>IVA ({formatNumber(catalog.settings.vatRate * 100)}%)</span><strong>{formatCurrency(quote.vat)}</strong></div></div>
            <div className="quote-total"><div><span>Il tuo totale</span><small>IVA inclusa</small></div><strong data-testid="total">{formatCurrency(quote.total)}</strong></div>
          </> : <div className="quote-invalid"><Ruler size={28} strokeWidth={1.3} /><h3>Un piccolo controllo alle misure</h3><p>Correggi i campi indicati per visualizzare il tuo preventivo.</p></div>}
        </div>
        <button className="print-button" disabled={!quote} onClick={() => window.print()}><Printer size={16} /> Stampa il preventivo <ArrowRight size={16} /></button>
        <p className="quote-footnote">Un primo passo verso il tuo mobile.<br />Il preventivo è indicativo e non costituisce un ordine.</p>
      </section>
      <div className="sidebar-trust"><ShieldCheck size={17} /><span>Nessuna registrazione. Nessun impegno.</span></div>
      <button className="text-button refresh-button" onClick={refresh}><RefreshCw size={12} /> Aggiorna il listino</button>
      <div className="print-only"><h2>Configurazione del mobile</h2><p>Larghezza: {dimensions.width} cm · Altezza: {dimensions.height} cm · Profondità: {dimensions.depth} cm</p><p>Legno: {wood.name} · Finitura: {finish.name} · Consegna: {delivery.name}</p><p>Listino {catalog.version} · {new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome' }).format(new Date())}</p></div>
    </aside>
    {quote && <a className="mobile-total" href="#riepilogo"><span><small>Il tuo totale · IVA inclusa</small><strong>{formatCurrency(quote.total)}</strong></span><span>Vedi dettagli <ArrowDown size={15} /></span></a>}
  </div>;
}

export default function App() {
  const state = useCatalog();
  const dialog = useRef<HTMLDialogElement>(null);
  // Keep the form mounted across refreshes, but hide it immediately until current prices are valid.
  const [lastCatalog, setLastCatalog] = useState<Catalog | null>(null);
  useEffect(() => { if (state.catalog) setLastCatalog(state.catalog); }, [state.catalog]);
  const catalog = state.catalog ?? lastCatalog;
  let isLocal = false;
  try { isLocal = getCatalogMode() === 'local'; } catch { /* Loader presents configuration errors. */ }

  return <>
    <a href="#configuratore" className="skip-link">Vai al configuratore</a>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="#" aria-label="Legno e Co. Inizio"><span className="brand-mark" aria-hidden="true"><span /><i /><i /><i /></span><span>legno<span className="brand-amp">&</span>co<span className="brand-dot">.</span><small>FALEGNAMERIA SU MISURA</small></span></a>
      <nav aria-label="Navigazione principale"><button className="how-it-works" aria-label="Come funziona" onClick={() => dialog.current?.showModal()}><span>Come funziona</span><ChevronDown className="how-chevron" size={14} /><CircleHelp className="how-mobile-icon" size={18} /></button><span className="nav-divider" /><span className="header-note"><Leaf size={17} strokeWidth={1.5} /> Fatto di legno. Pensato per te.</span><ThemeSwitcher /></nav>
    </div></header>

    <main className="page-container">
      <section className="hero"><div><p className="eyebrow"><span className="eyebrow-line" /> SPAZIO ALLE TUE IDEE</p><h1>Il tuo mobile.<br /><em>Esattamente come lo vuoi.</em></h1><p className="hero-description">Le tue misure, il tuo legno, il tuo stile.<br className="mobile-break" /> Dai forma alla tua idea e scopri subito il prezzo.</p></div>
        <div className="hero-seal" aria-hidden="true"><svg viewBox="0 0 120 120"><defs><path id="seal-circle" d="M60 60m-45 0a45 45 0 1 1 90 0a45 45 0 1 1-90 0" /></defs><text><textPath href="#seal-circle" textLength="275">OGNI MISURA, UNA POSSIBILITÀ · </textPath></text><path d="M47 79V43h12m-7 13h24M68 42v36m-24-8h34" fill="none" stroke="currentColor" strokeWidth="1.2" /><circle cx="60" cy="60" r="32" fill="none" stroke="currentColor" strokeWidth=".5" /></svg></div>
      </section>
      <div className="intro-bar"><span><Sparkles size={15} /> Dal primo centimetro all’ultimo dettaglio.</span><a href="#configuratore">Inizia a creare <ArrowDown size={14} /></a></div>
      {isLocal && <p className="demo-notice">Anteprima con il listino del progetto didattico. Il collegamento al database sarà attivo dopo la configurazione.</p>}
      {state.status !== 'ready' && <div className="catalog-state" role={state.status === 'error' ? 'alert' : 'status'}>
        {state.status === 'loading' ? <><LoaderCircle className="spin" size={27} /><h2>Prepariamo il tuo spazio creativo</h2><p>Stiamo aggiornando il listino.</p></> : <><CircleHelp size={28} /><h2>Il listino si fa attendere</h2><p>{state.error}</p><button className="primary-button" onClick={state.refresh}><RefreshCw size={15} /> Riprova</button></>}
      </div>}
      <div hidden={state.status !== 'ready'}>{catalog && <Configurator catalog={catalog} refresh={state.refresh} />}</div>
      <section className="closing-note"><span className="closing-icon"><Leaf size={27} strokeWidth={1} /></span><div><h2>Le cose belle iniziano da un’idea.</h2><p>Un legno da scegliere. Uno spazio da immaginare. Un mobile che parla di te.</p></div><span className="closing-lines" aria-hidden="true">///</span></section>
    </main>
    <footer className="site-footer"><span>legno&co. <span>Il legno incontra le tue idee.</span></span><small>Progetto didattico · Azienda e dati inventati</small><button onClick={() => dialog.current?.showModal()}><CircleHelp size={14} /> Informazioni</button></footer>
    <dialog ref={dialog} className="info-dialog" onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <button className="dialog-close" aria-label="Chiudi informazioni" onClick={() => dialog.current?.close()}><X size={22} /></button>
      <span className="eyebrow">POCHE SCELTE, TUTTO CHIARO</span><h2>Dal tuo spazio<br />al tuo preventivo.</h2><ol><li><strong>Prendi le misure.</strong> Inserisci larghezza, altezza e profondità in centimetri.</li><li><strong>Scegli i dettagli.</strong> Seleziona legno, finitura e modalità di consegna.</li><li><strong>Scopri il prezzo.</strong> Superficie e importi si aggiornano subito, con IVA separata.</li></ol>
      <p>La superficie comprende tutti i sei lati del mobile. Il prezzo si ottiene moltiplicandola per il prezzo al m² del legno più il supplemento della finitura. Si aggiungono la consegna e l’IVA del listino.</p><p>Imponibile e IVA sono arrotondati al centesimo. L’illustrazione è indicativa e non rappresenta un progetto esecutivo.</p><p className="dialog-privacy"><LockKeyhole size={18} /> Misure e scelte restano nel browser. Nessun account, nessun dato cliente salvato o inviato.</p><p className="educational-note">Legno & Co. è un’azienda inventata per un progetto didattico. Il preventivo non costituisce un’offerta commerciale.</p><button className="primary-button" onClick={() => dialog.current?.close()}><ArrowLeft size={15} /> Torna al tuo progetto</button>
    </dialog>
  </>;
}
