/**
 * Sync GovernmentRoles from KNS_PersonToPosition (Knesset OData v4)
 *
 * Fetches all minister records (PositionID in minister set),
 * upserts GovernmentRole, saves RawSnapshot, and upserts SourceLink.
 *
 * NOTE: The Knesset OData API caps complex OR-filter queries at ~200 records and also
 * stops returning @odata.nextLink after 200 records. We bypass this by:
 * 1. Fetching each PositionID individually (no OR filter cap)
 * 2. Using explicit $skip-based pagination when nextLink is absent but page is full
 */

import pLimit from "p-limit";
import { db } from "@knesset-vote/db";
import { ETL_CONCURRENCY, KNESSET_ODATA_BASE, KNESSET_ODATA_V2_BASE } from "@knesset-vote/shared";
import {
  MINISTER_POSITION_IDS,
  getPersonToPositionId,
  mapPersonToPositionToGovernmentRole,
  type RawPersonToPosition,
} from "../mappers/government-role-mapper.js";
import { saveSnapshot } from "./snapshot.js";
import type { ETLRunTracker } from "./run-tracker.js";
import { logger } from "../logger.js";

const ODATA_V4_BASE =
  process.env["KNESSET_ODATA_BASE_URL"] ?? KNESSET_ODATA_BASE;

const PAGE_SIZE = 100;

/**
 * Fetch all KNS_PersonToPosition records for a single PositionID (fully paginated, OData v4).
 * Uses $skip-based pagination as the Knesset API stops returning @odata.nextLink after 200 records.
 */
async function fetchPositionRecords(positionId: number): Promise<RawPersonToPosition[]> {
  const filter = encodeURIComponent(`PositionID eq ${positionId}`);
  const all: RawPersonToPosition[] = [];
  let skip = 0;
  let pageNum = 0;

  while (true) {
    pageNum++;
    const url = `${ODATA_V4_BASE}/KNS_PersonToPosition?$filter=${filter}&$top=${PAGE_SIZE}&$skip=${skip}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`OData request failed: ${res.status} ${res.statusText} — ${url}`);
    }

    const json = (await res.json()) as {
      value?: RawPersonToPosition[];
      "@odata.nextLink"?: string;
    };

    const page = json.value ?? [];
    all.push(...page);
    logger.debug(
      { positionId, page: pageNum, skip, pageCount: page.length, total: all.length },
      "Fetched minister position page",
    );

    // Stop if we got a partial page (means we've reached the end)
    if (page.length < PAGE_SIZE) {
      break;
    }

    skip += PAGE_SIZE;
  }

  return all;
}

/** Fetch all KNS_PersonToPosition minister records (one request-set per position, deduplicated) */
async function fetchAllMinisterPositions(): Promise<RawPersonToPosition[]> {
  const allById = new Map<number, RawPersonToPosition>();

  for (const positionId of MINISTER_POSITION_IDS) {
    const records = await fetchPositionRecords(positionId);
    logger.info({ positionId, count: records.length }, "Fetched minister position records");
    for (const r of records) {
      const id = getPersonToPositionId(r);
      if (id) {
        allById.set(id, r);
      }
    }
  }

  return Array.from(allById.values());
}

export async function syncGovernmentRoles(
  tracker: ETLRunTracker,
  mkIdMap: Map<string, string>, // external PersonID (string) → db MK id
): Promise<void> {
  logger.info({ positionIds: MINISTER_POSITION_IDS }, "Syncing GovernmentRoles");
  tracker.initEntity("government_role");

  let records: RawPersonToPosition[];
  try {
    records = await fetchAllMinisterPositions();
    logger.info({ count: records.length }, "Fetched PersonToPosition records for ministers");
  } catch (err) {
    const msg = `Failed to fetch KNS_PersonToPosition: ${String(err)}`;
    logger.error({ err }, msg);
    tracker.addError(msg);
    return;
  }

  const limit = pLimit(ETL_CONCURRENCY);

  await Promise.all(
    records.map((raw) =>
      limit(async () => {
        tracker.increment("government_role", "fetched");

        const mkDbId = mkIdMap.get(String(raw.PersonID));
        if (!mkDbId) {
          logger.warn(
            { personId: raw.PersonID, positionId: raw.PositionID },
            "PersonID not in mkIdMap — skipping GovernmentRole",
          );
          tracker.increment("government_role", "failed");
          return;
        }

        try {
          const data = mapPersonToPositionToGovernmentRole(raw, mkDbId);

          const role = await db.governmentRole.upsert({
            where: {
              external_id_external_source: {
                external_id: data.external_id!,
                external_source: data.external_source!,
              },
            },
            create: data,
            update: {
              position_label: data.position_label,
              ministry_name: data.ministry_name,
              duty_desc: data.duty_desc,
              is_current: data.is_current,
              end_date: data.end_date,
              last_seen_at: new Date(),
            },
          });

          // Determine if created or updated
          const isNew = role.created_at.getTime() === role.updated_at.getTime();
          if (isNew) {
            tracker.increment("government_role", "created");
          } else {
            tracker.increment("government_role", "updated");
          }

          await saveSnapshot({
            entityType: "government_role",
            entityId: role.id,
            externalSource: "knesset_odata",
            externalId: data.external_id!,
            etlRunId: tracker.getRunId(),
            payload: raw,
          });

          await db.sourceLink.upsert({
            where: { id: `gov-role-${role.id}-odata` },
            create: {
              id: `gov-role-${role.id}-odata`,
              entity_type: "government_role",
              entity_id: role.id,
              label: "Knesset OData — KNS_PersonToPosition",
              url: data.source_url ?? KNESSET_ODATA_V2_BASE,
              external_source: "knesset_odata",
              external_id: data.external_id,
            },
            update: {},
          });
        } catch (err) {
          logger.error(
            { err, personId: raw.PersonID, positionId: raw.PositionID },
            "Failed to upsert GovernmentRole",
          );
          tracker.increment("government_role", "failed");
        }
      }),
    ),
  );

  const { counts } = tracker.getSummary();
  logger.info(counts["government_role"] ?? {}, "GovernmentRoles sync complete");
}
