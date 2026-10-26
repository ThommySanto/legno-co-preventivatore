import { z } from 'zod';

const money = z.number().finite().min(0).max(1_000_000).refine(
  value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
  'Gli importi devono avere al massimo due decimali.',
);
const identity = {
  id: z.string().regex(/^[a-z0-9-]+$/).max(80),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(200),
};
const uniqueIds = <T extends { id: string }>(items: T[]) =>
  new Set(items.map(item => item.id)).size === items.length;

export const catalogSchema = z.object({
  version: z.string().min(1),
  revision: z.number().int().min(0).default(0),
  updatedAt: z.string().datetime({ offset: true }).nullable().default(null),
  woods: z.array(z.object({
    ...identity,
    pricePerM2: money,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })).min(1).refine(uniqueIds, 'Legni duplicati.'),
  finishes: z.array(z.object({ ...identity, pricePerM2: money })).min(1).refine(uniqueIds, 'Finiture duplicate.'),
  deliveries: z.array(z.object({ ...identity, price: money })).min(1).refine(uniqueIds, 'Consegne duplicate.'),
  settings: z.object({
    vatRate: z.number().finite().min(0).max(1),
    minDimensionCm: z.number().finite().positive(),
    maxDimensionCm: z.number().finite().positive().max(100_000),
    shelfThicknessCm: z.number().finite().min(0.1).max(10).default(2),
    maxShelves: z.number().int().min(0).max(24).default(12),
  }).refine(s => s.minDimensionCm <= s.maxDimensionCm && s.minDimensionCm > 2 * s.shelfThicknessCm, 'Limiti delle misure incoerenti.'),
});

export type Catalog = z.infer<typeof catalogSchema>;
export type Wood = Catalog['woods'][number];
export type Finish = Catalog['finishes'][number];
export type Delivery = Catalog['deliveries'][number];

export function parseCatalog(input: unknown): Catalog {
  const result = catalogSchema.safeParse(input);
  if (!result.success) throw new Error('Il listino contiene dati incompleti o non validi. Riprova più tardi.');
  return result.data;
}
