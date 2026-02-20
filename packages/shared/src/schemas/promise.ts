import { z } from "zod";
import { SourceLinkSchema, ConfidenceLevel, DataStatus } from "./common.js";

// "Promise" is phrased as "Statement/Commitment" per legal guardrails
export const PromiseSchema = z.object({
  id: z.string(),
  text: z.string().max(2000),
  // Always "Statement" or "Commitment" in UI, never "Promise" per legal requirements
  category: z.enum(["statement", "commitment", "pledge"]),
  topic: z.string().nullable(),
  mk_id: z.string().nullable(),
  party_id: z.string().nullable(),
  stated_on: z.string().datetime().nullable(),
  source_url: z.string().url(),
  source_label: z.string(),
  created_at: z.string().datetime(),
  sources: z.array(SourceLinkSchema),
});

export const PromiseMatchSchema = z.object({
  id: z.string(),
  promise_id: z.string(),
  bill_id: z.string().nullable(),
  vote_id: z.string().nullable(),
  match_type: z.enum(["manual", "auto_keyword", "auto_semantic"]),
  confidence: ConfidenceLevel,
  status: DataStatus,
  status_date: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  // Never say "fulfilled/unfulfilled" - use status labels
  sources: z.array(SourceLinkSchema),
});

export type Promise_ = z.infer<typeof PromiseSchema>;
export type PromiseMatch = z.infer<typeof PromiseMatchSchema>;
