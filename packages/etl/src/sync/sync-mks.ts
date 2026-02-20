import pLimit from "p-limit";
import { db } from "@knesset-vote/db";
import type { ODataMetadata } from "@knesset-vote/shared";
import { ETL_CONCURRENCY } from "@knesset-vote/shared";
import { ODataClient } from "../client/odata-client.js";
import {
  MK_ENTITY_SET_CANDIDATES,
  MK_FACTION_ENTITY_SET_CANDIDATES,
  mapMemberToMK,
  mapMemberFactionToMembership,
  type RawMember,
  type RawMemberFaction,
} from "../mappers/mk-mapper.js";
import { findEntitySet } from "../client/odata-metadata.js";
import { saveSnapshot } from "./snapshot.js";
import type { ETLRunTracker } from "./run-tracker.js";
import { logger } from "../logger.js";

export async function syncMKs(
  metadata: ODataMetadata,
  tracker: ETLRunTracker,
  partyIdMap: Map<string, string>,
): Promise<Map<string, string>> {
  // external_id → db id
  const mkIdMap = new Map<string, string>();

  const entitySet = findEntitySet(metadata, MK_ENTITY_SET_CANDIDATES);
  if (!entitySet) {
    logger.warn(
      { candidates: MK_ENTITY_SET_CANDIDATES },
      "No MK entity set found in OData metadata - skipping MK sync",
    );
    tracker.addError(`No MK entity set found. Tried: ${MK_ENTITY_SET_CANDIDATES.join(", ")}`);
    return mkIdMap;
  }

  logger.info({ entitySet: entitySet.name }, "Syncing MKs");
  tracker.initEntity("mk");

  const client = new ODataClient(metadata);
  const limit = pLimit(ETL_CONCURRENCY);

  for await (const page of client.fetchAllPages<RawMember>(entitySet.name)) {
    await Promise.all(
      page.map((raw) =>
        limit(async () => {
          tracker.increment("mk", "fetched");
          try {
            const data = mapMemberToMK(raw);
            const existing = await db.mK.findUnique({
              where: {
                external_id_external_source: {
                  external_id: data.external_id,
                  external_source: data.external_source,
                },
              },
            });

            const mk = await db.mK.upsert({
              where: {
                external_id_external_source: {
                  external_id: data.external_id,
                  external_source: data.external_source,
                },
              },
              create: data,
              update: {
                name_he: data.name_he,
                name_first_he: data.name_first_he,
                name_last_he: data.name_last_he,
                gender: data.gender,
                is_current: data.is_current,
                last_seen_at: new Date(),
              },
            });

            mkIdMap.set(data.external_id, mk.id);

            await saveSnapshot({
              entityType: "mk",
              entityId: mk.id,
              externalSource: "knesset_odata",
              externalId: data.external_id,
              etlRunId: tracker.getRunId(),
              payload: raw,
            });

            await db.sourceLink.upsert({
              where: { id: `mk-${mk.id}-odata` },
              create: {
                id: `mk-${mk.id}-odata`,
                entity_type: "mk",
                entity_id: mk.id,
                label: "Knesset OData",
                url: data.source_url ?? "https://knesset.gov.il",
                external_source: "knesset_odata",
                external_id: data.external_id,
              },
              update: {},
            });

            // Inline faction reference if present
            const factionId = raw.FactionID ? String(raw.FactionID) : null;
            if (factionId && partyIdMap.has(factionId)) {
              const partyDbId = partyIdMap.get(factionId)!;
              await db.partyMembership.upsert({
                where: {
                  mk_id_party_id_knesset_number: {
                    mk_id: mk.id,
                    party_id: partyDbId,
                    knesset_number: -1, // Will be refined in syncMemberships
                  },
                },
                create: {
                  mk_id: mk.id,
                  party_id: partyDbId,
                  external_source: "knesset_odata",
                  knesset_number: -1,
                  is_current: Boolean(raw.IsCurrent),
                },
                update: {
                  is_current: Boolean(raw.IsCurrent),
                },
              });
            }

            if (existing) {
              tracker.increment("mk", "updated");
            } else {
              tracker.increment("mk", "created");
            }
          } catch (err) {
            tracker.increment("mk", "failed");
            logger.error({ raw, err }, "Failed to sync MK");
            tracker.addError(
              `MK sync failed for ID ${String((raw as Record<string, unknown>)["PersonID"] ?? "unknown")}: ${String(err)}`,
            );
          }
        }),
      ),
    );
  }

  // Now sync detailed faction memberships if available
  await syncMKMemberships(metadata, tracker, mkIdMap, partyIdMap, client);

  logger.info({ count: mkIdMap.size, ...tracker.getSummary().counts["mk"] }, "MK sync complete");
  return mkIdMap;
}

async function syncMKMemberships(
  metadata: ODataMetadata,
  tracker: ETLRunTracker,
  mkIdMap: Map<string, string>,
  partyIdMap: Map<string, string>,
  client: ODataClient,
): Promise<void> {
  const entitySet = findEntitySet(metadata, MK_FACTION_ENTITY_SET_CANDIDATES);
  if (!entitySet) {
    logger.info("No MK faction membership entity set found - skipping detailed memberships");
    return;
  }

  logger.info({ entitySet: entitySet.name }, "Syncing MK faction memberships");
  tracker.initEntity("membership");

  const limit = pLimit(ETL_CONCURRENCY);

  for await (const page of client.fetchAllPages<RawMemberFaction>(entitySet.name)) {
    await Promise.all(
      page.map((raw) =>
        limit(async () => {
          tracker.increment("membership", "fetched");
          try {
            const mkExtId = String(raw.PersonID ?? raw.MemberID ?? "");
            const partyExtId = String(raw.FactionID ?? "");

            const mkDbId = mkIdMap.get(mkExtId);
            const partyDbId = partyIdMap.get(partyExtId);

            if (!mkDbId || !partyDbId) {
              logger.debug(
                { mkExtId, partyExtId, mkFound: !!mkDbId, partyFound: !!partyDbId },
                "Skipping membership - MK or party not found",
              );
              return;
            }

            const knessetNum = raw.KnessetNum ? Number(raw.KnessetNum) : -1;

            await db.partyMembership.upsert({
              where: {
                mk_id_party_id_knesset_number: {
                  mk_id: mkDbId,
                  party_id: partyDbId,
                  knesset_number: knessetNum,
                },
              },
              create: {
                mk_id: mkDbId,
                party_id: partyDbId,
                external_source: "knesset_odata",
                knesset_number: knessetNum,
                start_date: raw.StartDate ? new Date(raw.StartDate) : null,
                end_date: raw.EndDate
                  ? new Date(raw.EndDate)
                  : raw.FinishDate
                    ? new Date(raw.FinishDate)
                    : null,
                is_current:
                  raw.IsCurrent !== undefined
                    ? Boolean(raw.IsCurrent)
                    : !(raw.EndDate ?? raw.FinishDate),
              },
              update: {
                end_date: raw.EndDate
                  ? new Date(raw.EndDate)
                  : raw.FinishDate
                    ? new Date(raw.FinishDate)
                    : null,
                is_current:
                  raw.IsCurrent !== undefined
                    ? Boolean(raw.IsCurrent)
                    : !(raw.EndDate ?? raw.FinishDate),
              },
            });

            tracker.increment("membership", "created");
          } catch (err) {
            tracker.increment("membership", "failed");
            logger.error({ raw, err }, "Failed to sync membership");
          }
        }),
      ),
    );
  }
}
