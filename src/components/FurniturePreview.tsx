import { useId } from 'react';
import type { CSSProperties } from 'react';
import type { Dimensions } from '../lib/quote';
import { formatNumber, parseDimension } from '../lib/quote';

export default function FurniturePreview({ dimensions, color, name, valid }: {
  dimensions: Dimensions; color: string; name: string; valid: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const l = valid ? parseDimension(dimensions.width)!.toNumber() : 120;
  const h = valid ? parseDimension(dimensions.height)!.toNumber() : 80;
  const p = valid ? parseDimension(dimensions.depth)!.toNumber() : 40;
  const scale = Math.min(230 / l, 215 / h);
  const width = l * scale;
  const height = h * scale;
  const depth = Math.min(72, p * scale * 0.6);
  const x = (430 - width - depth) / 2;
  const y = (310 - height + depth / 2) / 2;
  const edge = Math.min(12, Math.max(5, width * 0.05));
  const dimension = (key: keyof Dimensions) => valid ? `${formatNumber(parseDimension(dimensions[key])!.toNumber())} cm` : '—';

  return <svg viewBox="0 0 430 375" className="furniture-svg" role="img" aria-label={valid
    ? `Anteprima indicativa in ${name}: larghezza ${dimension('width')}, altezza ${dimension('height')}, profondità ${dimension('depth')}`
    : 'Anteprima indicativa del mobile. Inserisci misure valide per aggiornarla.'}
    style={{ '--wood-color': color } as CSSProperties}>
    <defs>
      <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="0"><stop stopColor={color} /><stop offset=".45" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity=".85" /></linearGradient>
      <linearGradient id={`${id}-inside`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#29221b" stopOpacity=".47" /><stop offset="1" stopColor="#29221b" stopOpacity=".11" /></linearGradient>
      <pattern id={`${id}-grain`} width="31" height="135" patternUnits="userSpaceOnUse"><path d="M3 0Q14 30 5 70T6 135M17 0Q9 38 19 82T17 135M28 0Q20 46 29 104" fill="none" stroke="#3e2919" strokeOpacity=".14" strokeWidth=".7" /></pattern>
      <filter id={`${id}-shadow`} x="-40%" y="-100%" width="180%" height="300%"><feGaussianBlur stdDeviation="10" /></filter>
      <marker id={`${id}-arrow`} markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto-start-reverse"><path d="M5 0 0 2.5 5 5" fill="none" stroke="var(--preview-line, #869084)" strokeWidth="1" /></marker>
    </defs>
    <ellipse cx="222" cy={y + height + 17} rx={width * .6 + depth / 2} ry="10" fill="#34352d" opacity=".13" filter={`url(#${id}-shadow)`} />
    <g className="cabinet-art">
      <path d={`M${x + width} ${y}l${depth} ${-depth / 2}v${height}l${-depth} ${depth / 2}Z`} fill={color} />
      <path d={`M${x + width} ${y}l${depth} ${-depth / 2}v${height}l${-depth} ${depth / 2}Z`} fill="#382b20" opacity=".23" />
      <path d={`M${x} ${y}l${depth} ${-depth / 2}h${width}l${-depth} ${depth / 2}Z`} fill={color} />
      <path d={`M${x} ${y}l${depth} ${-depth / 2}h${width}l${-depth} ${depth / 2}Z`} fill="#fff" opacity=".22" />
      <rect x={x} y={y} width={width} height={height} rx="1" fill={`url(#${id}-wood)`} />
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id}-grain)`} />
      <rect x={x + edge} y={y + edge} width={Math.max(1, width - edge * 2)} height={height - edge * 2} fill={color} />
      <rect x={x + edge} y={y + edge} width={Math.max(1, width - edge * 2)} height={height - edge * 2} fill={`url(#${id}-inside)`} />
      <rect x={x + edge} y={y + edge} width={Math.max(1, width - edge * 2)} height={height - edge * 2} fill={`url(#${id}-grain)`} />
      {[1, 2].map(level => <g key={level}>
        <path d={`M${x + edge} ${y + height * level / 3}l${Math.min(depth * .55, width / 4)} ${-Math.min(depth * .25, height / 10)}h${Math.max(1, width - edge * 2 - Math.min(depth * .55, width / 4))}v${Math.min(depth * .25, height / 10)}Z`} fill={color} />
        <path d={`M${x + edge} ${y + height * level / 3}h${Math.max(1, width - edge * 2)}v${edge * .55}h${-Math.max(1, width - edge * 2)}Z`} fill={color} />
        <path d={`M${x + edge} ${y + height * level / 3 + edge * .55}h${Math.max(1, width - edge * 2)}`} stroke="#3a2c20" strokeOpacity=".22" />
      </g>)}
      <path d={`M${x + edge} ${y + height}v8M${x + width - edge} ${y + height}v8`} stroke={color} strokeWidth={edge * .7} />
    </g>
    <g fill="none" stroke="var(--preview-line, #869084)" strokeWidth=".8" opacity=".8">
      <path d={`M${x} ${y + height + 24}v15m${width} -15v15`} />
      <path d={`M${x + 3} ${y + height + 34}H${x + width - 3}`} markerStart={`url(#${id}-arrow)`} markerEnd={`url(#${id}-arrow)`} />
      <path d={`M${x - 23} ${y}h-13m13 ${height}h-13`} />
      <path d={`M${x - 31} ${y + 3}v${height - 6}`} markerStart={`url(#${id}-arrow)`} markerEnd={`url(#${id}-arrow)`} />
    </g>
    <g fill="var(--preview-label, #60695d)" fontSize="13" fontFamily="Arial, sans-serif" textAnchor="middle">
      <text x={x + width / 2} y={y + height + 53}>{dimension('width')}</text>
      <text transform={`translate(${x - 43}, ${y + height / 2}) rotate(-90)`}>{dimension('height')}</text>
      <text x={x + width + depth + 8} y={y + height - depth / 4} textAnchor="start" fontSize="12">P {dimension('depth')}</text>
    </g>
  </svg>;
}
