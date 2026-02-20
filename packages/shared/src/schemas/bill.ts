import { z } from "zod";
import { SourceLinkSchema } from "./common.js";

export const BillTopicSchema = z.enum([
  "economy",
  "security_defense",
  "social_welfare",
  "healthcare",
  "education",
  "environment",
  "justice_law",
  "foreign_affairs",
  "housing",
  "infrastructure",
  "religion_state",
  "immigration",
  "civil_rights",
  "local_government",
  "other",
]);

export type BillTopic = z.infer<typeof BillTopicSchema>;

export const BILL_TOPIC_LABELS: Record<BillTopic, string> = {
  economy: "Economy & Finance",
  security_defense: "Security & Defense",
  social_welfare: "Social Welfare",
  healthcare: "Healthcare",
  education: "Education",
  environment: "Environment",
  justice_law: "Justice & Law",
  foreign_affairs: "Foreign Affairs",
  housing: "Housing",
  infrastructure: "Infrastructure",
  religion_state: "Religion & State",
  immigration: "Immigration",
  civil_rights: "Civil Rights",
  local_government: "Local Government",
  other: "Other",
};

export const BillStatusSchema = z.enum([
  "draft",
  "submitted",
  "committee_review",
  "first_reading",
  "second_reading",
  "third_reading",
  "passed",
  "rejected",
  "withdrawn",
  "expired",
  "unknown",
]);

export type BillStatus = z.infer<typeof BillStatusSchema>;

export const BillSchema = z.object({
  id: z.string(),
  external_id: z.string(),
  external_source: z.string(),
  title_he: z.string(),
  title_en: z.string().nullable(),
  description_he: z.string().nullable(),
  description_en: z.string().nullable(),
  status: BillStatusSchema,
  topic: BillTopicSchema.nullable(),
  knesset_number: z.number().int().nullable(),
  submitted_date: z.string().datetime().nullable(),
  last_status_date: z.string().datetime().nullable(),
  source_url: z.string().url().nullable(),
  sources: z.array(SourceLinkSchema),
});

export const BillSponsorSchema = z.object({
  mk_id: z.string(),
  mk_name_he: z.string(),
  mk_name_en: z.string().nullable(),
  role: z.enum(["initiator", "cosponsor", "committee", "other"]),
  sources: z.array(SourceLinkSchema),
});

export const BillStageSchema = z.object({
  id: z.string(),
  stage_name_he: z.string(),
  stage_name_en: z.string().nullable(),
  status: z.string().nullable(),
  date: z.string().datetime().nullable(),
  committee_id: z.string().nullable(),
  committee_name: z.string().nullable(),
  notes: z.string().nullable(),
  sources: z.array(SourceLinkSchema),
});

export const BillDetailSchema = BillSchema.extend({
  sponsors: z.array(BillSponsorSchema),
  stage_history: z.array(BillStageSchema),
  ai_summary: z
    .object({
      text: z.string(),
      model: z.string(),
      generated_at: z.string().datetime(),
      source_fields: z.array(z.string()),
      warning: z.string().default("AI-generated summary; verify with official sources below."),
    })
    .nullable(),
});

export type Bill = z.infer<typeof BillSchema>;
export type BillSponsor = z.infer<typeof BillSponsorSchema>;
export type BillStage = z.infer<typeof BillStageSchema>;
export type BillDetail = z.infer<typeof BillDetailSchema>;
