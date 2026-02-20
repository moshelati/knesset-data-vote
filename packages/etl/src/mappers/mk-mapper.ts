/**
 * Knesset OData → Prisma MK mapper
 *
 * TODO: After running etl:sync for the first time, verify entity set names.
 * Known candidates: "KnssMember", "Member", "MK", "KnessetMember"
 */

import type { Prisma } from "@knesset-vote/db";
import { KNESSET_ODATA_BASE } from "@knesset-vote/shared";

export const MK_ENTITY_SET_CANDIDATES = [
  "KNS_Person",
  "KnssMember",
  "Person",
  "MK",
  "KnessetMember",
  "Member",
];

export const MK_FACTION_ENTITY_SET_CANDIDATES = [
  "KNS_PersonToPosition",
  "KnssMemberFaction",
  "MemberFaction",
  "FactionMember",
  "PersonToFaction",
];

export interface RawMember {
  PersonID?: number;
  MemberID?: number;
  ID?: number;
  Id?: number;
  FirstName?: string;
  LastName?: string;
  FullName?: string;
  GenderID?: number;
  GenderDesc?: string;
  IsCurrent?: boolean;
  IsActive?: boolean;
  FactionID?: number;
  FactionName?: string;
  Email?: string;
  LastUpdatedDate?: string | null;
  [key: string]: unknown;
}

export interface RawMemberFaction {
  // KNS_PersonToPosition fields
  PersonToPositionID?: number;
  PersonID?: number;
  MemberID?: number;
  FactionID?: number;
  FactionName?: string;
  KnessetNum?: number;
  StartDate?: string | null;
  EndDate?: string | null;
  FinishDate?: string | null;
  IsCurrent?: boolean;
  [key: string]: unknown;
}

function inferGender(raw: RawMember): string {
  if (raw.GenderID === 1 || raw.GenderDesc?.toLowerCase().includes("זכר")) return "male";
  if (raw.GenderID === 2 || raw.GenderDesc?.toLowerCase().includes("נקבה")) return "female";
  return "unknown";
}

export function mapMemberToMK(raw: RawMember): Prisma.MKCreateInput {
  const id = raw.PersonID ?? raw.MemberID ?? raw.ID ?? raw.Id;

  if (!id) {
    throw new Error(`Member record missing ID: ${JSON.stringify(raw)}`);
  }

  const firstName = raw.FirstName ? String(raw.FirstName).trim() : null;
  const lastName = raw.LastName ? String(raw.LastName).trim() : null;
  const fullName = raw.FullName
    ? String(raw.FullName).trim()
    : [firstName, lastName].filter(Boolean).join(" ");

  return {
    external_id: String(id),
    external_source: "knesset_odata",
    name_he: fullName || "Unknown",
    name_en: null,
    name_first_he: firstName,
    name_last_he: lastName,
    gender: inferGender(raw),
    is_current: raw.IsCurrent !== undefined ? Boolean(raw.IsCurrent) : Boolean(raw.IsActive),
    is_demo: false,
    source_url: `${KNESSET_ODATA_BASE}/KNS_Person(${id})`,
    last_seen_at: new Date(),
  };
}

export function mapMemberFactionToMembership(
  raw: RawMemberFaction,
  mkDbId: string,
  partyDbId: string,
): Prisma.PartyMembershipCreateInput {
  return {
    mk: { connect: { id: mkDbId } },
    party: { connect: { id: partyDbId } },
    external_source: "knesset_odata",
    knesset_number: raw.KnessetNum ? Number(raw.KnessetNum) : null,
    start_date: raw.StartDate ? new Date(raw.StartDate) : null,
    end_date: raw.EndDate ? new Date(raw.EndDate) : raw.FinishDate ? new Date(raw.FinishDate) : null,
    is_current: raw.IsCurrent !== undefined ? Boolean(raw.IsCurrent) : !(raw.EndDate ?? raw.FinishDate),
  };
}
