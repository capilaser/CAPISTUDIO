import { z } from 'zod';

// Zod validation schemas for seed data integrity checks.
// Used in seedDatabase() to catch data errors before insertion.

export const MachineSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const OperationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  defaultColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const FontSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  family: z.string().min(1),
  source: z.enum(['local', 'google']),
  file: z.string().nullable(),
});

export const SlotTypeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  isText: z.boolean(),
  defaultMaxWidthMm: z.number().nullable(),
  defaultMaxHeightMm: z.number().nullable(),
});

export const MaterialFamilySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  brushed: z.boolean(),
});

export const MaterialSchema = z.object({
  id: z.string().min(1),
  familyId: z.string().min(1),
  label: z.string().min(1),
  swatch: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  pngPath: z.string().min(1),
  fallbackStops: z.array(
    z.object({ offset: z.string(), color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/) })
  ),
});

export const ProductConstraintsSchema = z.object({
  sizeLocked: z.boolean(),
  minGapMm: z.number(),
});

export const SettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: z.string().min(1),
  color: z.string().nullable(),
});
