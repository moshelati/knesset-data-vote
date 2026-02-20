import { z } from "zod";
import { SourceLinkSchema } from "./common.js";

export const VoteSchema = z.object({
  id: z.string(),
  external_id: z.string(),
  external_source: z.string(),
  title_he: z.string(),
  title_en: z.string().nullable(),
  vote_date: z.string().datetime().nullable(),
  knesset_number: z.number().int().nullable(),
  bill_id: z.string().nullable(),
  topic: z.string().nullable(),
  yes_count: z.number().int().nullable(),
  no_count: z.number().int().nullable(),
  abstain_count: z.number().int().nullable(),
  result: z.enum(["passed", "rejected", "unknown"]).nullable(),
  source_url: z.string().url().nullable(),
  sources: z.array(SourceLinkSchema),
});

export const VoteRecordSchema = z.object({
  id: z.string(),
  vote_id: z.string(),
  mk_id: z.string(),
  mk_name_he: z.string(),
  position: z.enum(["yes", "no", "abstain", "absent", "did_not_vote"]),
  sources: z.array(SourceLinkSchema),
});

export type Vote = z.infer<typeof VoteSchema>;
export type VoteRecord = z.infer<typeof VoteRecordSchema>;
