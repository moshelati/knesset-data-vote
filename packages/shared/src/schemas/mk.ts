import { z } from "zod";
import { SourceLinkSchema } from "./common.js";

export const MKSchema = z.object({
  id: z.string(),
  external_id: z.string(),
  external_source: z.string(),
  name_he: z.string(),
  name_en: z.string().nullable(),
  name_first_he: z.string().nullable(),
  name_last_he: z.string().nullable(),
  gender: z.enum(["male", "female", "other", "unknown"]).default("unknown"),
  is_current: z.boolean(),
  current_party_id: z.string().nullable(),
  current_party_name: z.string().nullable(),
  source_url: z.string().url().nullable(),
  image_url: z.string().url().nullable(),
  last_seen_at: z.string().datetime().nullable(),
  last_changed_at: z.string().datetime().nullable(),
  sources: z.array(SourceLinkSchema),
});

export const MKMembershipSchema = z.object({
  id: z.string(),
  party_id: z.string(),
  party_name_he: z.string(),
  party_name_en: z.string().nullable(),
  start_date: z.string().datetime().nullable(),
  end_date: z.string().datetime().nullable(),
  is_current: z.boolean(),
  knesset_number: z.number().int().nullable(),
  sources: z.array(SourceLinkSchema),
});

export const MKActivityMetricsSchema = z.object({
  bills_initiated: z.number().int(),
  bills_cosponsored: z.number().int(),
  bills_passed: z.number().int(),
  committee_memberships: z.number().int().nullable(),
  votes_participated: z.number().int().nullable(),
  data_as_of: z.string().datetime().nullable(),
  confidence: z.enum(["high", "medium", "low", "unavailable"]),
  notes: z.array(z.string()),
});

export const MKTopicBreakdownItemSchema = z.object({
  topic: z.string(),
  label_he: z.string(),
  bill_count: z.number().int(),
  bills_passed: z.number().int(),
});

export const MKCommitteeListItemSchema = z.object({
  committee_id: z.string(),
  name_he: z.string(),
  role: z.string().nullable(),
  knesset_number: z.number().int().nullable(),
  is_current: z.boolean(),
  start_date: z.string().datetime().nullable(),
  end_date: z.string().datetime().nullable(),
});

export const MKProfileSchema = z.object({
  gender: z.enum(["male", "female", "other", "unknown"]),
  gender_label_he: z.string(),
  knesset_terms: z.array(z.number().int()),
  first_elected: z.string().datetime().nullable(),
});

export const MKDetailSchema = MKSchema.extend({
  memberships: z.array(MKMembershipSchema),
  activity_metrics: MKActivityMetricsSchema,
  recent_bills: z.array(
    z.object({
      id: z.string(),
      title_he: z.string(),
      title_en: z.string().nullable(),
      status: z.string().nullable(),
      submitted_date: z.string().datetime().nullable(),
      role: z.string(),
      source_url: z.string().url().nullable(),
    }),
  ),
  topic_breakdown: z.array(MKTopicBreakdownItemSchema),
  committee_list: z.array(MKCommitteeListItemSchema),
  profile: MKProfileSchema,
});

export type MK = z.infer<typeof MKSchema>;
export type MKMembership = z.infer<typeof MKMembershipSchema>;
export type MKActivityMetrics = z.infer<typeof MKActivityMetricsSchema>;
export type MKTopicBreakdownItem = z.infer<typeof MKTopicBreakdownItemSchema>;
export type MKCommitteeListItem = z.infer<typeof MKCommitteeListItemSchema>;
export type MKProfile = z.infer<typeof MKProfileSchema>;
export type MKDetail = z.infer<typeof MKDetailSchema>;
