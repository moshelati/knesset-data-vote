/**
 * Knesset OData → Prisma Party mapper
 *
 * NOTE: Field names are discovered from the OData metadata.
 * Known entity set candidates: "KnssFaction", "KnessetFaction", "Faction"
 * Actual names TBD from metadata - see TODO below.
 *
 * TODO: After running `pnpm etl:sync` for the first time, check the logged
 * entity set names and update FACTION_ENTITY_SET_CANDIDATES accordingly.
 */

import type { Prisma } from "@knesset-vote/db";
import { KNESSET_ODATA_BASE } from "@knesset-vote/shared";

// Candidate entity set names to try (in priority order)
export const FACTION_ENTITY_SET_CANDIDATES = [
  "KNS_Faction",
  "KnssFaction",
  "Faction",
  "FactionMember",
  "ParliamentFaction",
];

export interface RawFaction {
  FactionID?: number;
  ID?: number;
  Id?: number;
  FactionName?: string;
  Name?: string;
  ShortName?: string;
  KnessetNum?: number;
  CountOfMembers?: number;
  IsCurrent?: boolean;
  StartDate?: string;
  EndDate?: string | null;
  FinishDate?: string | null;
  LastUpdatedDate?: string | null;
  [key: string]: unknown;
}

export function mapFactionToParty(raw: RawFaction): Prisma.PartyCreateInput {
  const id = raw.FactionID ?? raw.ID ?? raw.Id;
  const name = raw.FactionName ?? raw.Name ?? "Unknown";

  if (!id) {
    throw new Error(`Faction record missing ID: ${JSON.stringify(raw)}`);
  }

  return {
    external_id: String(id),
    external_source: "knesset_odata",
    name_he: String(name),
    name_en: null,
    abbreviation: raw.ShortName ? String(raw.ShortName) : null,
    knesset_number: raw.KnessetNum ? Number(raw.KnessetNum) : null,
    seat_count: raw.CountOfMembers ? Number(raw.CountOfMembers) : null,
    is_active: raw.IsCurrent !== undefined ? Boolean(raw.IsCurrent) : true,
    is_demo: false,
    source_url: `${KNESSET_ODATA_BASE}/KNS_Faction(${id})`,
    last_seen_at: new Date(),
    last_changed_at: raw.LastUpdatedDate
      ? new Date(raw.LastUpdatedDate)
      : raw.StartDate
        ? new Date(raw.StartDate)
        : null,
  };
}
