import pLimit from "p-limit";
import { db } from "@knesset-vote/db";
import type { ODataMetadata } from "@knesset-vote/shared";
import { ETL_CONCURRENCY } from "@knesset-vote/shared";
import { ODataClient } from "../client/odata-client.js";
import {
  FACTION_ENTITY_SET_CANDIDATES,
  mapFactionToParty,
  type RawFaction,
} from "../mappers/party-mapper.js";
import { findEntitySet } from "../client/odata-metadata.js";
import { saveSnapshot } from "./snapshot.js";
import type { ETLRunTracker } from "./run-tracker.js";
import { logger } from "../logger.js";

export async function syncParties(
  metadata: ODataMetadata,
  tracker: ETLRunTracker,
): Promise<Map<string, string>> {
  // external_id → db id
  const partyIdMap = new Map<string, string>();

  const entitySet = findEntitySet(metadata, FACTION_ENTITY_SET_CANDIDATES);
  if (!entitySet) {
    logger.warn(
      { candidates: FACTION_ENTITY_SET_CANDIDATES },
      "No Faction entity set found in OData metadata - skipping party sync",
    );
    tracker.addError(
      `No Faction entity set found. Tried: ${FACTION_ENTITY_SET_CANDIDATES.join(", ")}`,
    );
    return partyIdMap;
  }

  logger.info({ entitySet: entitySet.name }, "Syncing parties");
  tracker.initEntity("party");

  const client = new ODataClient(metadata);
  const limit = pLimit(ETL_CONCURRENCY);

  for await (const page of client.fetchAllPages<RawFaction>(entitySet.name)) {
    await Promise.all(
      page.map((raw) =>
        limit(async () => {
          tracker.increment("party", "fetched");
          try {
            const data = mapFactionToParty(raw);
            const existing = await db.party.findUnique({
              where: {
                external_id_external_source: {
                  external_id: data.external_id!,
                  external_source: data.external_source!,
                },
              },
            });

            const party = await db.party.upsert({
              where: {
                external_id_external_source: {
                  external_id: data.external_id!,
                  external_source: data.external_source!,
                },
              },
              create: data,
              update: {
                name_he: data.name_he,
                abbreviation: data.abbreviation,
                seat_count: data.seat_count,
                is_active: data.is_active,
                last_seen_at: new Date(),
                last_changed_at: data.last_changed_at,
              },
            });

            partyIdMap.set(data.external_id, party.id);

            await saveSnapshot({
              entityType: "party",
              entityId: party.id,
              externalSource: "knesset_odata",
              externalId: data.external_id,
              etlRunId: tracker.getRunId(),
              payload: raw,
            });

            // Create provenance source link
            await db.sourceLink.upsert({
              where: {
                // Use compound index workaround
                id: `party-${party.id}-odata`,
              },
              create: {
                id: `party-${party.id}-odata`,
                entity_type: "party",
                entity_id: party.id,
                label: "Knesset OData",
                url: data.source_url ?? `https://knesset.gov.il`,
                external_source: "knesset_odata",
                external_id: data.external_id,
              },
              update: {},
            });

            if (existing) {
              tracker.increment("party", "updated");
            } else {
              tracker.increment("party", "created");
            }
          } catch (err) {
            tracker.increment("party", "failed");
            logger.error({ raw, err }, "Failed to sync party");
            tracker.addError(
              `Party sync failed for ID ${String((raw as Record<string, unknown>)["FactionID"] ?? "unknown")}: ${String(err)}`,
            );
          }
        }),
      ),
    );
  }

  logger.info(
    { count: partyIdMap.size, ...tracker.getSummary().counts["party"] },
    "Party sync complete",
  );
  return partyIdMap;
}
