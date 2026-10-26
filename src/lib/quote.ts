import Decimal from 'decimal.js';
import type { Catalog } from './catalog';

export type DimensionKey = 'width' | 'height' | 'depth';
export type Dimensions = Record<DimensionKey, string>;
export type Selection = { woodId: string; finishId: string; deliveryId: string };
export type QuoteInput = Dimensions & Selection & { shelfCount?: number };
export type DimensionErrors = Partial<Record<DimensionKey, string>>;
export const dimensionLabels: Record<DimensionKey, string> = {
  width: 'Larghezza', height: 'Altezza', depth: 'Profondità',
};

export function parseDimension(value: string): Decimal | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = new Decimal(normalized);
  return number.isFinite() ? number : null;
}

export function validateDimensions(input: Dimensions, catalog: Catalog): DimensionErrors {
  const errors: DimensionErrors = {};
  for (const key of Object.keys(dimensionLabels) as DimensionKey[]) {
    const value = parseDimension(input[key]);
    if (!input[key].trim()) errors[key] = 'Inserisci questa misura.';
    else if (!value || value.lte(0)) errors[key] = 'Inserisci un numero maggiore di zero.';
    else if (value.lt(catalog.settings.minDimensionCm) || value.gt(catalog.settings.maxDimensionCm)) {
      errors[key] = `La misura deve essere tra ${catalog.settings.minDimensionCm} e ${catalog.settings.maxDimensionCm} cm.`;
    }
  }
  return errors;
}

export function getShelfLayout(input: Dimensions, catalog: Catalog, count = 0) {
  if (Object.keys(validateDimensions(input, catalog)).length) return null;
  const thickness = new Decimal(catalog.settings.shelfThicknessCm);
  const width = parseDimension(input.width)!.sub(thickness.mul(2));
  const depth = parseDimension(input.depth)!.sub(thickness);
  const innerHeight = parseDimension(input.height)!.sub(thickness.mul(2));
  const maxCount = Math.max(0, Math.min(catalog.settings.maxShelves, innerHeight.div(thickness).ceil().sub(1).toNumber()));
  if (width.lte(0) || depth.lte(0) || !Number.isInteger(count) || count < 0 || count > maxCount) return null;
  const unitArea = width.mul(depth).add(width.mul(thickness)).add(depth.mul(thickness)).mul(2).div(10_000);
  return { count, maxCount, thickness: thickness.toNumber(), width: width.toNumber(), depth: depth.toNumber(),
    openingHeight: innerHeight.sub(thickness.mul(count)).div(count + 1).toNumber(), unitArea: unitArea.toNumber(), area: unitArea.mul(count).toNumber() };
}

export function calculateQuote(input: QuoteInput, catalog: Catalog) {
  if (Object.keys(validateDimensions(input, catalog)).length) return null;
  const shelves = getShelfLayout(input, catalog, input.shelfCount ?? 0);
  if (!shelves) return null;
  const wood = catalog.woods.find(item => item.id === input.woodId);
  const finish = catalog.finishes.find(item => item.id === input.finishId);
  const delivery = catalog.deliveries.find(item => item.id === input.deliveryId);
  if (!wood || !finish || !delivery) return null;
  const l = parseDimension(input.width)!;
  const h = parseDimension(input.height)!;
  const p = parseDimension(input.depth)!;
  const area = l.mul(h).add(l.mul(p)).add(h.mul(p)).mul(2).div(10_000);
  const rate = new Decimal(wood.pricePerM2).add(finish.pricePerM2);
  const rawFurniture = area.mul(rate);
  // Use decimal operands throughout: never round a panel area or a unit price first.
  const t = new Decimal(shelves.thickness);
  const sw = l.sub(t.mul(2));
  const sp = p.sub(t);
  const shelfArea = sw.mul(sp).add(sw.mul(t)).add(sp.mul(t)).mul(2).div(10_000).mul(shelves.count);
  const rawShelves = shelfArea.mul(rate);
  const net = rawFurniture.add(rawShelves).add(delivery.price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vat = net.mul(catalog.settings.vatRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return {
    area: area.toNumber(),
    furniture: rawFurniture.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    shelves: { ...shelves, area: shelfArea.toNumber(), amount: rawShelves.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() },
    totalArea: area.add(shelfArea).toNumber(),
    net: net.toNumber(),
    vat: vat.toNumber(),
    total: net.add(vat).toNumber(),
    roundingAdjustment: net.sub(rawFurniture.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)).sub(rawShelves.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)).sub(delivery.price).toNumber(),
    wood, finish, delivery,
  };
}

const currencyFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
export const formatCurrency = (value: number) => currencyFormatter.format(value);
export const formatNumber = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat('it-IT', { maximumFractionDigits }).format(value);
