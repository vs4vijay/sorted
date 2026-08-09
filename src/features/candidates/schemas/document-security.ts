import { z } from 'zod';

export const MalwareScanStatusSchema = z.enum([
  'pending',
  'clean_simulated',
  'clean',
  'quarantined',
  'scan_failed',
]);

export const MalwareScanResultSchema = z.discriminatedUnion('verdict', [
  z.object({
    verdict: z.literal('clean'),
    provider: z.string().min(1),
    engineVersion: z.string().min(1),
    simulated: z.boolean(),
    requestId: z.string().optional(),
  }),
  z.object({
    verdict: z.literal('infected'),
    provider: z.string().min(1),
    engineVersion: z.string().min(1),
    simulated: z.boolean(),
    threatName: z.string().min(1),
    requestId: z.string().optional(),
  }),
  z.object({
    verdict: z.literal('error'),
    provider: z.string().min(1),
    engineVersion: z.string().min(1),
    simulated: z.boolean(),
    normalizedError: z.string().min(1),
    requestId: z.string().optional(),
  }),
]);

export type MalwareScanResult = z.infer<typeof MalwareScanResultSchema>;
