/** Display geometry only. Prices and validation remain in quote.ts. Units are normalized cm. */
export type FurnitureModel = { width: number; height: number; depth: number; thickness: number; shelves: number; color: string; finish: string };
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
  return { panels, width: w, height: h, depth: d, thickness: t };
}
