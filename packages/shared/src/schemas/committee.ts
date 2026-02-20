import { z } from "zod";
import { SourceLinkSchema } from "./common.js";

export const CommitteeSchema = z.object({
  id: z.string(),
  external_id: z.string(),
  external_source: z.string(),
  name_he: z.string(),
  name_en: z.string().nullable(),
  knesset_number: z.number().int().nullable(),
  is_active: z.boolean(),
  source_url: z.string().url().nullable(),
  sources: z.array(SourceLinkSchema),
});

export const CommitteeMembershipSchema = z.object({
  id: z.string(),
  mk_id: z.string(),
  mk_name_he: z.string(),
  committee_id: z.string(),
  committee_name_he: z.string(),
  role: z.string().nullable(),
  start_date: z.string().datetime().nullable(),
  end_date: z.string().datetime().nullable(),
  is_current: z.boolean(),
  sources: z.array(SourceLinkSchema),
});

export type Committee = z.infer<typeof CommitteeSchema>;
export type CommitteeMembership = z.infer<typeof CommitteeMembershipSchema>;
