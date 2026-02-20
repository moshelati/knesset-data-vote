import { z } from "zod";
import { SourceLinkSchema, ConfidenceLevel } from "./common.js";

// Re-export for convenience
export { ConfidenceLevel };

// ──────────────────────────────────────────
// Request schema
// ──────────────────────────────────────────

export const RecommendationTopicWeightSchema = z.object({
  id: z.string().min(1),
  weight: z.number().int().min(1).max(5),
});

export const RecommendationRequestSchema = z.object({
  topics: z
    .array(RecommendationTopicWeightSchema)
    .min(1, "At least one topic required")
    .max(10, "Maximum 10 topics"),
  free_text: z.string().max(500).optional(),
  /**
   * GUARDRAIL 1: ideological_preference is accepted in the request body and
   * stored in the response meta for transparency, but it is NEVER used in
   * scoring. Parties are ranked solely by legislative activity.
   */
  ideological_preference: z
    .enum(["right", "center", "left", "none"])
    .optional(),
});

export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;
export type RecommendationTopicWeight = z.infer<
  typeof RecommendationTopicWeightSchema
>;

// ──────────────────────────────────────────
// Response schema
// ──────────────────────────────────────────

export const RecommendationPartySchema = z.object({
  id: z.string(),
  name_he: z.string(),
  name_en: z.string().nullable(),
  abbreviation: z.string().nullable(),
  seat_count: z.number().nullable(),
  sources: z.array(SourceLinkSchema),
});

export const TopicBreakdownSchema = z.object({
  ui_topic_id: z.string(),
  label_he: z.string(),
  weight: z.number().int().min(1).max(5),
  normalized_score: z.number().min(0).max(1),
  bill_count: z.number().int().nonnegative(),
});

export const HighlightBillSchema = z.object({
  bill_id: z.string(),
  title_he: z.string(),
  status: z.string(),
  topic: z.string(),
  role: z.string(),
  sources: z.array(SourceLinkSchema),
});

export const RecommendationResultSchema = z.object({
  rank: z.number().int().min(1),
  party: RecommendationPartySchema,
  personal_score: z.number().min(0).max(100),
  confidence: ConfidenceLevel,
  topic_breakdown: z.array(TopicBreakdownSchema),
  highlights: z.array(HighlightBillSchema),
});

export const FreeTextSuggestionSchema = z.object({
  matched_keyword: z.string(),
  suggested_topic_id: z.string(),
  label_he: z.string(),
});

export const RecommendationMetaSchema = z.object({
  parties_evaluated: z.number().int().nonnegative(),
  topics_requested: z.number().int().positive(),
  data_as_of: z.string().datetime().nullable(),
  methodology_url: z.string(),
  warning: z.string(),
});

export const RecommendationResponseSchema = z.object({
  results: z.array(RecommendationResultSchema),
  free_text_suggestions: z.array(FreeTextSuggestionSchema).optional(),
  meta: RecommendationMetaSchema,
});

export type RecommendationParty = z.infer<typeof RecommendationPartySchema>;
export type TopicBreakdown = z.infer<typeof TopicBreakdownSchema>;
export type HighlightBill = z.infer<typeof HighlightBillSchema>;
export type RecommendationResult = z.infer<typeof RecommendationResultSchema>;
export type FreeTextSuggestion = z.infer<typeof FreeTextSuggestionSchema>;
export type RecommendationMeta = z.infer<typeof RecommendationMetaSchema>;
export type RecommendationResponse = z.infer<
  typeof RecommendationResponseSchema
>;
