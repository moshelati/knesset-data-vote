import { z } from "zod";

export const SourceLinkSchema = z.object({
  label: z.string(),
  url: z.string().url(),
  external_source: z.string(),
  external_id: z.string().optional(),
});

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    pages: z.number().int().nonnegative(),
  });

export const ConfidenceLevel = z.enum(["high", "medium", "low", "unavailable"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

export const DataStatus = z.enum([
  "matched",
  "partial_match",
  "no_match",
  "unavailable",
  "pending",
]);
export type DataStatus = z.infer<typeof DataStatus>;

// Human-readable labels per non-negotiable principle 3
export const DATA_STATUS_LABELS: Record<DataStatus, string> = {
  matched: "Matched parliamentary activity found",
  partial_match: "Partial match",
  no_match: "No matching parliamentary activity found",
  unavailable: "Not available from source",
  pending: "Pending verification",
};

export type SourceLink = z.infer<typeof SourceLinkSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
