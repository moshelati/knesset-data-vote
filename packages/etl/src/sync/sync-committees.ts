import pLimit from "p-limit";
import { db } from "@knesset-vote/db";
import type { ODataMetadata } from "@knesset-vote/shared";
import { ETL_CONCURRENCY } from "@knesset-vote/shared";
import { ODataClient } from "../client/odata-client.js";
import {
  COMMITTEE_ENTITY_SET_CANDIDATES,
  COMMITTEE_MEMBER_ENTITY_SET_CANDIDATES,
  mapCommittee,
  type RawCommittee,
  type RawCommitteeMember,
} from "../mappers/committee-mapper.js";
import { findEntitySet } from "../client/odata-metadata.js";
import { saveSnapshot } from "./snapshot.js";
import type { ETLRunTracker } from "./run-tracker.js";
import { logger } from "../logger.js";

export async function syncCommittees(
  metadata: ODataMetadata,
  tracker: ETLRunTracker,
  mkIdMap: Map<string, string>,
): Promise<Map<string, string>> {
  const committeeIdMap = new Map<string, string>();

  const entitySet = findEntitySet(metadata, COMMITTEE_ENTITY_SET_CANDIDATES);
  if (!entitySet) {
    logger.info("No Committee entity set found in OData metadata - skipping");
    return committeeIdMap;
  }

  logger.info({ entitySet: entitySet.name }, "Syncing committees");
  tracker.initEntity("committee");

  const client = new ODataClient(metadata);
  const limit = pLimit(ETL_CONCURRENCY);

  for await (const page of client.fetchAllPages<RawCommittee>(entitySet.name)) {
    await Promise.all(
      page.map((raw) =>
        limit(async () => {
          tracker.increment("committee", "fetched");
          try {
            const data = mapCommittee(raw);

            const committee = await db.committee.upsert({
              where: {
                external_id_external_source: {
                  external_id: data.external_id,
                  external_source: data.external_source,
                },
              },
              create: data,
              update: {
                name_he: data.name_he,
                is_active: data.is_active,
                last_seen_at: new Date(),
              },
            });

            committeeIdMap.set(data.external_id, committee.id);

            await saveSnapshot({
              entityType: "committee",
              entityId: committee.id,
              externalSource: "knesset_odata",
              externalId: data.external_id,
              etlRunId: tracker.getRunId(),
              payload: raw,
            });

            tracker.increment("committee", "created");
          } catch (err) {
            tracker.increment("committee", "failed");
            logger.error({ raw, err }, "Failed to sync committee");
          }
        }),
      ),
    );
  }

  // Sync committee memberships via KNS_PersonToPosition (CommitteeID ne null)
  await syncCommitteeMembers(metadata, tracker, committeeIdMap, mkIdMap, client);

  return committeeIdMap;
}

async function syncCommitteeMembers(
  metadata: ODataMetadata,
  tracker: ETLRunTracker,
  committeeIdMap: Map<string, string>,
  mkIdMap: Map<string, string>,
  client: ODataClient,
): Promise<void> {
  const entitySet = findEntitySet(metadata, COMMITTEE_MEMBER_ENTITY_SET_CANDIDATES);
  if (!entitySet) {
    logger.info("No committee member entity set found - skipping");
    return;
  }

  logger.info(
    { entitySet: entitySet.name },
    "Syncing committee members via KNS_PersonToPosition (CommitteeID ne null)",
  );
  tracker.initEntity("committee_member");

  const limit = pLimit(ETL_CONCURRENCY);

  // KNS_PersonToPosition covers all roles; filter to rows that have a CommitteeID
  const fetchOptions =
    entitySet.name === "KNS_PersonToPosition" ? { $filter: "CommitteeID ne null" } : {};

  for await (const page of client.fetchAllPages<RawCommitteeMember>(entitySet.name, fetchOptions)) {
    await Promise.all(
      page.map((raw) =>
        limit(async () => {
          tracker.increment("committee_member", "fetched");
          try {
            const committeeExtId = String(raw.CommitteeID ?? "");
            const mkExtId = String(raw.PersonID ?? raw.MemberID ?? "");

            const committeeDbId = committeeIdMap.get(committeeExtId);
            const mkDbId = mkIdMap.get(mkExtId);

            if (!committeeDbId || !mkDbId) return;

            await db.committeeMembership.upsert({
              where: {
                mk_id_committee_id: {
                  mk_id: mkDbId,
                  committee_id: committeeDbId,
                },
              },
              create: {
                mk_id: mkDbId,
                committee_id: committeeDbId,
                external_source: "knesset_odata",
                role: raw.RoleDesc ? String(raw.RoleDesc) : null,
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

            tracker.increment("committee_member", "created");
          } catch (err) {
            tracker.increment("committee_member", "failed");
            logger.error({ raw, err }, "Failed to sync committee member");
          }
        }),
      ),
    );
  }
}
