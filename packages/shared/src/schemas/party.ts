import { z } from "zod";
import { SourceLinkSchema } from "./common.js";

export const PartySchema = z.object({
  id: z.string(),
  external_id: z.string(),
  external_source: z.string(),
  name_he: z.string(),
  name_en: z.string().nullable(),
  abbreviation: z.string().nullable(),
  knesset_number: z.number().int().nullable(),
  seat_count: z.number().int().nullable(),
  is_active: z.boolean(),
  source_url: z.string().url().nullable(),
  last_seen_at: z.string().datetime().nullable(),
  last_changed_at: z.string().datetime().nullable(),
  sources: z.array(SourceLinkSchema),
});

export const PartyDetailSchema = PartySchema.extend({
  mk_count: z.number().int(),
  bill_count: z.number().int(),
  activity_summary: z.object({
    bills_initiated: z.number().int(),
    bills_passed: z.number().int(),
    committee_meetings: z.number().int().nullable(),
  }),
});

export type Party = z.infer<typeof PartySchema>;
export type PartyDetail = z.infer<typeof PartyDetailSchema>;
