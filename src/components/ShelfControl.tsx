import { Layers, Minus, Plus } from 'lucide-react';
import type { Catalog } from '../lib/catalog';
import { formatNumber, getShelfLayout, type Dimensions } from '../lib/quote';

export default function ShelfControl({ dimensions, catalog, value, onChange }: {
  dimensions: Dimensions; catalog: Catalog; value: string; onChange: (value: string) => void;
}) {
  const count = /^\d+$/.test(value) ? Number(value) : NaN;
  const available = getShelfLayout(dimensions, catalog);
  const layout = getShelfLayout(dimensions, catalog, count);
  const invalid = !Number.isInteger(count) || count < 0 || (available !== null && count > available.maxCount);
  return <section className="config-section shelf-section" aria-labelledby="shelf-heading">
    <div className="section-heading"><span className="step-number">04</span><h2 id="shelf-heading">Spazio a ciò che ami</h2><Layers size={20} /></div>
    <p className="section-description">Aggiungi i ripiani interni. Stesso legno, stessa finitura, tutto al suo posto.</p>
    <div className="shelf-card"><div><label htmlFor="shelf-count">Numero di ripiani</label><p>Spessore {formatNumber(catalog.settings.shelfThicknessCm, 4)} cm · {available ? `da 0 a ${available.maxCount}` : 'inserisci misure valide'}</p></div>
      <div className="shelf-stepper"><button type="button" aria-label="Rimuovi un ripiano" disabled={!available || !Number.isInteger(count) || count <= 0} onClick={() => onChange(String(count - 1))}><Minus size={18} /></button>
        <input id="shelf-count" type="text" inputMode="numeric" autoComplete="off" value={value} aria-invalid={invalid} aria-describedby="shelf-help shelf-error" onChange={event => onChange(event.target.value)} />
        <button type="button" aria-label="Aggiungi un ripiano" disabled={!available || !Number.isInteger(count) || count >= available.maxCount} onClick={() => onChange(String(count + 1))}><Plus size={18} /></button>
      </div>
    </div>
    {invalid && <p className="field-error" id="shelf-error" role="alert">Inserisci un numero intero tra 0 e {available?.maxCount ?? catalog.settings.maxShelves}.</p>}
    <p className="field-hint" id="shelf-help">{layout && count > 0 ? `${formatNumber(layout.width, 4)} × ${formatNumber(layout.depth, 4)} cm per ripiano · vano libero indicativo ${formatNumber(layout.openingHeight)} cm. ` : 'Nessun ripiano incluso nella struttura di base. '}Il costo comprende entrambe le facce e i bordi.</p>
  </section>;
}
