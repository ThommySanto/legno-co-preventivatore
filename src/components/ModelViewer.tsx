import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Box, Info, Layers, LoaderCircle, Maximize2, Minus, MoveHorizontal, Pause, Play, Plus, RotateCcw, Ruler, X } from 'lucide-react';
import FurniturePreview from './FurniturePreview';
import type { Wood, Finish } from '../lib/catalog';
import { formatNumber, parseDimension, type Dimensions } from '../lib/quote';
import type { FurnitureScene } from '../lib/furnitureScene';
import type { FurnitureModel, ModelView } from '../lib/furnitureGeometry';

type Props = { dimensions: Dimensions; wood: Wood; finish: Finish; shelfCount: number; thicknessCm: number; valid: boolean };
function ModelStudio({ dimensions, wood, finish, shelfCount, thicknessCm, valid, onExpand, active = true, large = false }: Props & { onExpand?: () => void; active?: boolean; large?: boolean }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<FurnitureScene | null>(null);
  const [seen, setSeen] = useState(false);
  const [eligible, setEligible] = useState(valid);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== 'hidden');
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [status, setStatus] = useState<'waiting' | 'loading' | 'ready' | 'fallback'>('waiting');
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<ModelView | 'custom'>('perspective');
  const [autoRotate, setAutoRotate] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [measures, setMeasures] = useState(false);
  const [details, setDetails] = useState(false);
  const model: FurnitureModel = {
    width: valid ? parseDimension(dimensions.width)!.toNumber() : 120,
    height: valid ? parseDimension(dimensions.height)!.toNumber() : 80,
    depth: valid ? parseDimension(dimensions.depth)!.toNumber() : 40,
    thickness: thicknessCm, shelves: valid ? shelfCount : 0, color: wood.color, finish: finish.id,
  };
  const latest = useRef(model);
  if (valid) latest.current = model;
  const ready = status === 'ready' && valid;
  useEffect(() => {
    if (valid) setEligible(true);
  }, [valid]);
  useEffect(() => {
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setSeen(true);
    }, { rootMargin: '150px' }) : null;
    if (observer && root.current) observer.observe(root.current); else setSeen(true);
    const visibility = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', visibility);
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const change = () => { setReduced(media?.matches ?? false); if (media?.matches) setAutoRotate(false); };
    media?.addEventListener('change', change);
    return () => media?.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!seen || !eligible || !host.current) return;
    if (typeof WebGL2RenderingContext === 'undefined') { setStatus('fallback'); return; }
    let stopped = false;
    let instance: FurnitureScene | null = null;
    setStatus('loading');
    void import('../lib/furnitureScene').then(({ createFurnitureScene }) => {
      if (stopped || !host.current) return;
      instance = createFurnitureScene(host.current, latest.current, {
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
        onInteract: () => { if (!stopped) setAutoRotate(false); },
        onOrbit: () => { if (!stopped) setView('custom'); },
        onFailure: () => { if (!stopped) { setStatus('fallback'); scene.current?.dispose(); scene.current = null; } },
      });
      scene.current = instance;
      instance.update(latest.current);
      setExploded(false); setMeasures(false); setAutoRotate(false); setView('perspective');
      setStatus('ready');
    }).catch(() => { if (!stopped) setStatus('fallback'); });
    return () => { stopped = true; instance?.dispose(); if (scene.current === instance) scene.current = null; };
  }, [seen, eligible, attempt]);
  useEffect(() => { if (valid) scene.current?.update(latest.current); }, [model.width, model.height, model.depth, model.thickness, model.shelves, model.color, model.finish, status, valid]);
  useEffect(() => { scene.current?.active(active && visible && pageVisible && valid); }, [active, visible, pageVisible, status, valid]);
  useEffect(() => { scene.current?.motion(reduced); }, [reduced, status]);
  useEffect(() => { scene.current?.autoRotate(autoRotate); }, [autoRotate, status]);
  const selectView = (next: ModelView) => { setView(next); setAutoRotate(false); scene.current?.view(next); };
  const reset = () => {
    setAutoRotate(false); setExploded(false); setView('perspective');
    scene.current?.explode(false); scene.current?.view('perspective');
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!ready) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); scene.current?.rotate(event.key === 'ArrowLeft' ? -.15 : .15); }
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); scene.current?.rotate(0, event.key === 'ArrowUp' ? -.1 : .1); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); scene.current?.zoom(.82); }
    else if (event.key === '-') { event.preventDefault(); scene.current?.zoom(1.22); }
    else if (event.key === 'Home') { event.preventDefault(); reset(); }
  };
  return <div ref={root} className={`model-studio${large ? ' model-studio-large' : ''}`} data-status={valid ? status : 'invalid'}>
    <div className="model-topbar"><span><Box size={14} />{ready ? 'IL TUO MOBILE, A 360°' : 'IL TUO MOBILE, DA VICINO'}</span>{onExpand && <button type="button" className="model-icon-button" disabled={!valid} onClick={onExpand} aria-label="Ingrandisci anteprima 3D" title="Ingrandisci anteprima"><Maximize2 size={17} /></button>}</div>
    <div className="model-stage" tabIndex={ready ? 0 : -1} role="group" aria-label={valid ? `Modello 3D di ${wood.name}, ${shelfCount} ripiani` : 'Anteprima del mobile: completa la configurazione'} aria-describedby={`${id}-help`} onKeyDown={keyboard}>
      <div ref={host} className="model-canvas" aria-hidden="true" />
      {!ready && <div className="model-fallback"><FurniturePreview dimensions={dimensions} color={wood.color} name={wood.name} valid={valid} shelfCount={valid ? shelfCount : 0} /></div>}
      {status === 'loading' && valid && <span className="model-loading" role="status"><LoaderCircle size={15} className="spin" /> Prepariamo la vista 3D…</span>}
      {!valid && <span className="model-loading">Completa misure e ripiani per esplorare il mobile.</span>}
      {ready && exploded && <span className="model-stage-label"><Layers size={13} /> Vista della struttura</span>}
      {ready && measures && <div className="model-measures" aria-label="Misure del modello"><span>L <strong>{formatNumber(model.width, 4)}</strong></span><span>H <strong>{formatNumber(model.height, 4)}</strong></span><span>P <strong>{formatNumber(model.depth, 4)}</strong></span><small>cm</small></div>}
    </div>
    {status === 'fallback' && valid && <p className="model-fallback-note">Vista illustrata: il 3D non è disponibile su questo dispositivo. <button type="button" onClick={() => setAttempt(value => value + 1)}>Riprova</button></p>}
    <div className="model-view-tabs" role="group" aria-label="Punto di vista">
      {([['perspective', 'Prospettiva'], ['front', 'Frontale'], ['back', 'Retro']] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={view === key} disabled={!ready} onClick={() => selectView(key)}>{label}</button>)}
    </div>
    <div className="model-toolbar"><div className="model-zoom" role="group" aria-label="Zoom"><button type="button" disabled={!ready} className="model-icon-button" aria-label="Riduci zoom" title="Riduci zoom" onClick={() => scene.current?.zoom(1.22)}><Minus size={17} /></button><button type="button" disabled={!ready} className="model-icon-button" aria-label="Aumenta zoom" title="Aumenta zoom" onClick={() => scene.current?.zoom(.82)}><Plus size={17} /></button></div><div className="model-tools">
      <button type="button" disabled={!ready} className="model-icon-button" aria-label="Rotazione automatica" title={autoRotate ? 'Ferma la rotazione' : 'Rotazione automatica'} aria-pressed={autoRotate} onClick={() => setAutoRotate(value => !value)}>{autoRotate ? <Pause size={16} /> : <Play size={16} />}</button>
      <button type="button" disabled={!ready} className="model-icon-button" aria-label="Mostra misure" title="Mostra misure" aria-pressed={measures} onClick={() => { setMeasures(value => !value); scene.current?.measurements(!measures); }}><Ruler size={17} /></button>
      <button type="button" disabled={!ready} className="model-icon-button" aria-label="Esplora struttura" title="Esplora la struttura" aria-pressed={exploded} onClick={() => { setExploded(value => !value); setAutoRotate(false); setView('perspective'); scene.current?.explode(!exploded); }}><Layers size={17} /></button>
      <button type="button" disabled={!ready} className="model-icon-button" aria-label="Ripristina vista" title="Ripristina vista" onClick={reset}><RotateCcw size={16} /></button>
    </div></div>
    <p className="model-instructions" id={`${id}-help`}><MoveHorizontal size={14} />{ready ? 'Trascina per ruotare · usa + e − per lo zoom' : 'Anteprima indicativa del tuo progetto'}<span className="sr-only">. Da tastiera: frecce per ruotare, più e meno per lo zoom, Home per ripristinare.</span></p>
    <div className="model-material"><span><i style={{ backgroundColor: wood.color }} /><strong>{wood.name}</strong><span>/</span>{finish.name}</span><button type="button" aria-expanded={details} aria-controls={`${id}-details`} onClick={() => setDetails(value => !value)}><Info size={15} /> Dettagli</button></div>
    {details && <div className="model-detail-card" id={`${id}-details`}><p><strong>{wood.name}.</strong> {wood.description}.</p><p>{finish.description}. Spessore pannelli e ripiani: {formatNumber(thicknessCm, 4)} cm.</p><small>Colori, venature e costruzione sono indicativi. Le viste 3D non modificano il preventivo.</small></div>}
    <p className="model-disclaimer">Anteprima indicativa · Le viste non modificano il prezzo</p>
  </div>;
}

export default function ModelViewer(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);
  const expand = () => { setExpanded(true); dialog.current?.showModal(); };
  return <>
    <ModelStudio {...props} onExpand={expand} active={!expanded} />
    <dialog ref={dialog} className="model-lightbox" aria-label="Esplora il tuo mobile in 3D" onClose={() => setExpanded(false)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="model-lightbox-header"><div><span className="eyebrow">GUARDALO DA UN’ALTRA PROSPETTIVA</span><h2>Ogni dettaglio, il tuo stile.</h2></div><button type="button" className="model-icon-button model-close" aria-label="Chiudi anteprima ingrandita" onClick={() => dialog.current?.close()}><X size={23} /></button></div>
      {expanded && <ModelStudio {...props} large />}
    </dialog>
  </>;
}
