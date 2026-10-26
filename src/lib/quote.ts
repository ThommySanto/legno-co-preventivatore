import Decimal from 'decimal.js';
import type { Catalog } from './catalog';

export type DimensionKey = 'width' | 'height' | 'depth';
export type Dimensions = Record<DimensionKey, string>;
export type Selection = { woodId: string; finishId: string; deliveryId: string };
export type QuoteInput = Dimensions & Selection;
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

export function calculateQuote(input: QuoteInput, catalog: Catalog) {
  if (Object.keys(validateDimensions(input, catalog)).length) return null;
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
  const net = rawFurniture.add(delivery.price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vat = net.mul(catalog.settings.vatRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return {
    area: area.toNumber(),
    furniture: rawFurniture.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    net: net.toNumber(),
    vat: vat.toNumber(),
    total: net.add(vat).toNumber(),
    wood, finish, delivery,
  };
}

const currencyFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
export const formatCurrency = (value: number) => currencyFormatter.format(value);
export const formatNumber = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat('it-IT', { maximumFractionDigits }).format(value);
