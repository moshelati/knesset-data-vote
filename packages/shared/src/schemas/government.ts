/**
 * Shared Zod schemas + TypeScript types for Government Roles feature.
 * Used by API (response validation) and Web (type safety).
 */

import { z } from "zod";
import { SourceLinkSchema } from "./common.js";
import { MKSchema } from "./mk.js";
import { MKCommitteeListItemSchema } from "./mk.js";

// ─────────────────────────────────────────────
// Government Role (single minister/deputy position)
// ─────────────────────────────────────────────
export const GovernmentRoleSchema = z.object({
  id: z.string(),
  mk_id: z.string(),
  position_id: z.number().int(),
  position_label: z.string(),
  gov_ministry_id: z.number().int().nullable(),
  ministry_name: z.string().nullable(),
  duty_desc: z.string().nullable(),
  government_num: z.number().int().nullable(),
  knesset_num: z.number().int().nullable(),
  start_date: z.string().datetime().nullable(),
  end_date: z.string().datetime().nullable(),
  is_current: z.boolean(),
  source_url: z.string().nullable(),
});

export type GovernmentRole = z.infer<typeof GovernmentRoleSchema>;

// ─────────────────────────────────────────────
// Related bill highlight (ministry-topic filtered)
// ─────────────────────────────────────────────
export const GovernmentRelatedBillSchema = z.object({
  id: z.string(),
  title_he: z.string(),
  status: z.string().nullable(),
  topic: z.string().nullable(),
  submitted_date: z.string().datetime().nullable(),
  source_url: z.string().nullable(),
});

export type GovernmentRelatedBill = z.infer<typeof GovernmentRelatedBillSchema>;

// ─────────────────────────────────────────────
// Minister list item (for /government page grid)
// ─────────────────────────────────────────────
export const GovernmentMinisterSchema = z.object({
  mk: MKSchema,
  role: GovernmentRoleSchema,
  related_bills: z.array(GovernmentRelatedBillSchema),
  sources: z.array(SourceLinkSchema),
});

export type GovernmentMinister = z.infer<typeof GovernmentMinisterSchema>;

// ─────────────────────────────────────────────
// Minister detail (for /government/[id] page)
// ─────────────────────────────────────────────
export const GovernmentMinisterDetailSchema = GovernmentMinisterSchema.extend({
  committee_roles: z.array(MKCommitteeListItemSchema),
});

export type GovernmentMinisterDetail = z.infer<typeof GovernmentMinisterDetailSchema>;
