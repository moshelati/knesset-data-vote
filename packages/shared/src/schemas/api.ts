import { z } from "zod";

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number().int(),
  requestId: z.string().optional(),
});

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  version: z.string(),
  timestamp: z.string().datetime(),
  services: z.object({
    database: z.enum(["ok", "error"]),
    redis: z.enum(["ok", "error", "unavailable"]),
  }),
});

export const MetaResponseSchema = z.object({
  data_sources: z.array(
    z.object({
      name: z.string(),
      base_url: z.string(),
      type: z.string(),
      last_successful_sync: z.string().datetime().nullable(),
      entity_sets_discovered: z.array(z.string()),
    }),
  ),
  last_updated: z.string().datetime().nullable(),
  etl_summary: z
    .object({
      last_run_id: z.string(),
      started_at: z.string().datetime(),
      completed_at: z.string().datetime().nullable(),
      status: z.enum(["running", "completed", "failed", "partial"]),
      counts: z.record(z.string(), z.number()),
      errors: z.array(z.string()),
    })
    .nullable(),
  methodology_url: z.string(),
});

export const SearchResultSchema = z.object({
  type: z.enum(["mk", "party", "bill"]),
  id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  url: z.string(),
  source_url: z.string().url().nullable(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type MetaResponse = z.infer<typeof MetaResponseSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
