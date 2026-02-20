/**
 * Knesset OData → Prisma Committee mapper
 *
 * Entity set confirmed: KNS_Committee
 * Real fields: CommitteeID, Name, CategoryDesc, CommitteeTypeDesc,
 *              KnessetNum, StartDate, FinishDate, IsCurrent, LastUpdatedDate
 *
 * Committee members come via KNS_PersonToPosition (CommitteeID field),
 * not a dedicated committee-member entity set.
 */

import type { Prisma } from "@knesset-vote/db";
import { KNESSET_ODATA_BASE } from "@knesset-vote/shared";

export const COMMITTEE_ENTITY_SET_CANDIDATES = [
  "KNS_Committee",
  "KnssCommittee",
  "Committee",
  "KnessetCommittee",
];

/**
 * Committee memberships come from KNS_PersonToPosition WHERE CommitteeID ne null.
 * There is no dedicated KNS_PersonToCommittee entity set in OData v4.
 * The sync-committees.ts uses a filtered fetch for this.
 */
export const COMMITTEE_MEMBER_ENTITY_SET_CANDIDATES = [
  "KNS_PersonToPosition", // correct v4 entity — filter CommitteeID ne null applied in sync
  "KNS_PersonToCommittee",
  "KnssCommitteeMember",
  "CommitteeMember",
  "PersonCommittee",
];

export interface RawCommittee {
  CommitteeID?: number;
  ID?: number;
  Id?: number;
  Name?: string;
  CommitteeName?: string;
  CategoryID?: number;
  CategoryDesc?: string | null;
  CommitteeTypeID?: number;
  CommitteeTypeDesc?: string | null;
  AdditionalTypeDesc?: string | null;
  KnessetNum?: number;
  StartDate?: string | null;
  FinishDate?: string | null;
  IsCurrent?: boolean;
  LastUpdatedDate?: string | null;
  [key: string]: unknown;
}

export interface RawCommitteeMember {
  CommitteeID?: number;
  PersonID?: number;
  MemberID?: number;
  RoleID?: number;
  RoleDesc?: string | null;
  StartDate?: string | null;
  EndDate?: string | null;
  FinishDate?: string | null;
  IsCurrent?: boolean;
  [key: string]: unknown;
}

export function mapCommittee(raw: RawCommittee): Prisma.CommitteeCreateInput {
  const id = raw.CommitteeID ?? raw.ID ?? raw.Id;
  const name = raw.Name ?? raw.CommitteeName ?? "Unknown";

  if (!id) {
    throw new Error(`Committee record missing ID: ${JSON.stringify(raw)}`);
  }

  return {
    external_id: String(id),
    external_source: "knesset_odata",
    name_he: String(name),
    name_en: null,
    knesset_number: raw.KnessetNum ? Number(raw.KnessetNum) : null,
    is_active: raw.IsCurrent !== undefined ? Boolean(raw.IsCurrent) : !(raw.FinishDate),
    source_url: `${KNESSET_ODATA_BASE}/KNS_Committee(${id})`,
    last_seen_at: new Date(),
  };
}
