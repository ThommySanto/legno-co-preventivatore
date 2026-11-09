/** Display geometry only. Prices and validation remain in quote.ts. Units are normalized cm. */
export type FurnitureVariant = 'cabinet' | 'table' | 'bed' | 'seat';
export type FurnitureModel = { width: number; height: number; depth: number; thickness: number; shelves: number; color: string; finish: string; variant?: FurnitureVariant };
export type ModelView = 'perspective' | 'front' | 'back';
export type Panel = { id: string; size: [number, number, number]; position: [number, number, number]; offset: [number, number, number] };

export function furniturePanels(model: FurnitureModel) {
  const scale = 2.4 / Math.max(model.width, model.height, model.depth);
  const w = model.width * scale, h = model.height * scale, d = model.depth * scale, t = model.thickness * scale;
  const opening = (h - 2 * t - model.shelves * t) / (model.shelves + 1);
  const panels: Panel[] = [
    { id: 'left', size: [t, h, d], position: [-(w - t) / 2, 0, 0], offset: [-.2, 0, 0] },
    { id: 'right', size: [t, h, d], position: [(w - t) / 2, 0, 0], offset: [.2, 0, 0] },
    { id: 'top', size: [w - 2 * t, t, d], position: [0, (h - t) / 2, 0], offset: [0, .22, 0] },
    { id: 'bottom', size: [w - 2 * t, t, d], position: [0, -(h - t) / 2, 0], offset: [0, -.16, 0] },
    { id: 'back', size: [w - 2 * t, h - 2 * t, t], position: [0, 0, -(d - t) / 2], offset: [0, 0, -.28] },
    ...Array.from({ length: model.shelves }, (_, index): Panel => ({
      id: `shelf-${index}`, size: [w - 2 * t, t, d - t],
      position: [0, -h / 2 + t + (index + 1) * opening + index * t + t / 2, t / 2],
      offset: [0, 0, .18 + index / Math.max(1, model.shelves - 1) * .12],
    })),
  ];
  if (model.variant === 'table') {
    const top = { id: 'tabletop', size: [w, t * 1.25, d], position: [0, h / 2 - t * .7, 0], offset: [0, .22, 0] } as Panel;
    const legH = Math.max(t, h - t * 1.8), legW = Math.max(t * 1.4, w * .08), legD = Math.max(t * 1.4, d * .08);
    return { panels: [top, ...[-1, 1].flatMap(x => [-1, 1].map(z => ({ id: `leg-${x}-${z}`, size: [legW, legH, legD], position: [x * (w - legW) / 2, -t / 2, z * (d - legD) / 2], offset: [x * .12, -.16, z * .08] } as Panel)))], width: w, height: h, depth: d, thickness: t };
  }
  if (model.variant === 'bed') {
    const base = { id: 'bed-base', size: [w, t * 2, d], position: [0, -h / 2 + t * 2, 0], offset: [0, -.12, 0] } as Panel;
    const head = { id: 'headboard', size: [w, h * .72, t], position: [0, h * .12, -(d - t) / 2], offset: [0, .18, -.2] } as Panel;
    const legW = Math.max(t * 1.5, w * .06), legD = Math.max(t * 1.5, d * .06);
    return { panels: [base, head, ...[-1, 1].flatMap(x => [-1, 1].map(z => ({ id: `bed-leg-${x}-${z}`, size: [legW, t * 2, legD], position: [x * (w - legW) / 2, -h / 2, z * (d - legD) / 2], offset: [x * .08, -.14, z * .08] } as Panel)))], width: w, height: h, depth: d, thickness: t };
  }
  if (model.variant === 'seat') {
    const seat = { id: 'seat', size: [w, t * 1.5, d], position: [0, -h * .08, 0], offset: [0, .15, 0] } as Panel;
    const back = { id: 'seat-back', size: [w, h * .72, t], position: [0, h * .26, -(d - t) / 2], offset: [0, .18, -.18] } as Panel;
    const legW = Math.max(t, w * .07), legD = Math.max(t, d * .07);
    return { panels: [seat, back, ...[-1, 1].flatMap(x => [-1, 1].map(z => ({ id: `seat-leg-${x}-${z}`, size: [legW, h * .42, legD], position: [x * (w - legW) / 2, -h * .3, z * (d - legD) / 2], offset: [x * .08, -.12, z * .08] } as Panel)))], width: w, height: h, depth: d, thickness: t };
  }
  return { panels, width: w, height: h, depth: d, thickness: t };
}

export function productVariant(category?: string, name?: string): FurnitureVariant {
  const text = `${category ?? ''} ${name ?? ''}`.toLowerCase();
  if (/tavol|scrivania|bancone|desk|ufficio/.test(text)) return 'table';
  if (/letto|culla|camera/.test(text)) return 'bed';
  if (/sedia|sedut|poltrona|sgabello|panca/.test(text)) return 'seat';
  return 'cabinet';
}
