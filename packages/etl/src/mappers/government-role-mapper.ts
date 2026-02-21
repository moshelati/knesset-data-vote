/**
 * Knesset OData → Prisma GovernmentRole mapper
 *
 * Entity set: KNS_PersonToPosition
 * Filtered to minister position IDs only.
 *
 * Note: OData v1 returns the ID field as "PersonToPositionID";
 * OData v4 returns it as "Id". Both are handled here.
 */

import type { Prisma } from "@knesset-vote/db";
import { KNESSET_ODATA_V2_BASE } from "@knesset-vote/shared";

/** OData PositionIDs that correspond to ministerial roles */
export const MINISTER_POSITION_IDS = [39, 57, 45, 31, 50, 40, 59, 51, 285079] as const;

/** Human-readable Hebrew labels for minister position IDs */
export const MINISTER_POSITION_LABELS: Record<number, string> = {
  39: "שר",
  57: "שרה",
  45: "ראש הממשלה",
  31: "משנה לראש הממשלה",
  50: "סגן ראש הממשלה",
  40: "סגן שר",
  59: "סגנית שר",
  51: 'מ"מ ראש הממשלה',
  285079: "סגן שרה",
};

export const GOVERNMENT_ROLE_ENTITY_SET = "KNS_PersonToPosition";

/** Raw OData record from KNS_PersonToPosition (handles both v1 and v4 field names) */
export interface RawPersonToPosition {
  /** OData v1 field name */
  PersonToPositionID?: number;
  /** OData v4 field name (same value as PersonToPositionID) */
  Id?: number;
  PersonID: number;
  PositionID: number;
  KnessetNum: number | null;
  StartDate: string | null;
  FinishDate: string | null;
  GovMinistryID: number | null;
  GovMinistryName: string | null;
  DutyDesc: string | null;
  FactionID: number | null;
  FactionName: string | null;
  GovernmentNum: number | null;
  CommitteeID: number | null;
  CommitteeName: string | null;
  IsCurrent: boolean;
  LastUpdatedDate: string | null;
  [key: string]: unknown;
}

/** Get the record's unique ID regardless of OData version (v1: PersonToPositionID, v4: Id) */
export function getPersonToPositionId(raw: RawPersonToPosition): number {
  return raw.PersonToPositionID ?? raw.Id ?? 0;
}

/**
 * Maps a raw KNS_PersonToPosition OData record to a GovernmentRole Prisma create input.
 * @param raw    - Raw OData record
 * @param mkDbId - Internal DB id of the MK (from mkIdMap)
 */
export function mapPersonToPositionToGovernmentRole(
  raw: RawPersonToPosition,
  mkDbId: string,
): Prisma.GovernmentRoleUncheckedCreateInput {
  const id = getPersonToPositionId(raw);
  const externalId = String(id);
  const positionLabel =
    MINISTER_POSITION_LABELS[raw.PositionID] ?? `תפקיד ${raw.PositionID}`;

  const sourceUrl = `${KNESSET_ODATA_V2_BASE}/KNS_PersonToPosition(${externalId})`;

  return {
    external_id: externalId,
    external_source: "knesset_odata",
    source_url: sourceUrl,

    mk_id: mkDbId,
    position_id: raw.PositionID,
    position_label: positionLabel,
    gov_ministry_id: raw.GovMinistryID ?? null,
    ministry_name: raw.GovMinistryName ?? null,
    duty_desc: raw.DutyDesc ?? null,
    government_num: raw.GovernmentNum ?? null,
    knesset_num: raw.KnessetNum ?? null,

    start_date: raw.StartDate ? new Date(raw.StartDate) : null,
    end_date: raw.FinishDate ? new Date(raw.FinishDate) : null,
    is_current: raw.IsCurrent ?? false,

    last_seen_at: new Date(),
  };
}
