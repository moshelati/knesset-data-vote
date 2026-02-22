/**
 * AI Assistant schemas — Gemini-powered "Ask + Verify" feature.
 *
 * These types are shared between the API (which generates answers)
 * and the web client (which renders them).
 *
 * The Gemini API key NEVER appears here — it is server-side only.
 */

import { z } from "zod";

/**
 * A single citation linking an AI claim to an official source.
 */
export const CitationSchema = z.object({
  /** Human-readable label, e.g. "ח\"כ בנימין נתניהו — כנסת OData" */
  label: z.string(),
  /** Knesset OData or platform URL for the cited entity */
  url: z.string(),
  /** Type of entity cited */
  entity_type: z.enum(["mk", "party", "bill", "vote", "minister"]).optional(),
  /** Internal DB id of the cited entity (for deep linking) */
  entity_id: z.string().optional(),
});

/**
 * A quick-link card for an MK, party, bill, or minister extracted from the answer.
 */
export const EntityCardSchema = z.object({
  type: z.enum(["mk", "party", "bill", "minister"]),
  /** Internal DB id */
  id: z.string(),
  /** Display name */
  label: z.string(),
  /** Route on this platform, e.g. "/mks/abc123" */
  url: z.string(),
  /** Short metadata string, e.g. "ליכוד • 32 מנדטים" */
  meta: z.string().optional(),
});

/**
 * Full AI answer returned by POST /api/ai/answer
 */
export const AiAnswerSchema = z.object({
  /** The original question (echoed for display) */
  question: z.string(),
  /** Gemini's markdown-formatted Hebrew answer */
  answer_md: z.string(),
  /** Source citations extracted from tool call results */
  citations: z.array(CitationSchema),
  /** Entity cards for quick navigation */
  entity_cards: z.array(EntityCardSchema),
  /** Names of DB tools that were called (transparency) */
  tool_calls_made: z.array(z.string()),
  /** Gemini model name */
  model: z.string(),
  /** Fixed disclaimer shown under every answer */
  disclaimer: z.string(),
});

export type Citation = z.infer<typeof CitationSchema>;
export type EntityCard = z.infer<typeof EntityCardSchema>;
export type AiAnswer = z.infer<typeof AiAnswerSchema>;
