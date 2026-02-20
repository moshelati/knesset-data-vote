import pLimit from "p-limit";
import { db } from "@knesset-vote/db";
import type { ODataMetadata } from "@knesset-vote/shared";
import { ETL_CONCURRENCY } from "@knesset-vote/shared";
import { ODataClient } from "../client/odata-client.js";
import {
  BILL_ENTITY_SET_CANDIDATES,
  BILL_INITIATOR_ENTITY_SET_CANDIDATES,
  BILL_STAGE_ENTITY_SET_CANDIDATES,
  mapBillToBill,
  type RawBill,
  type RawBillInitiator,
  type RawBillStage,
} from "../mappers/bill-mapper.js";
import { findEntitySet } from "../client/odata-metadata.js";
import { saveSnapshot } from "./snapshot.js";
import type { ETLRunTracker } from "./run-tracker.js";
import { logger } from "../logger.js";

export async function syncBills(
  metadata: ODataMetadata,
  tracker: ETLRunTracker,
  mkIdMap: Map<string, string>,
): Promise<Map<string, string>> {
  const billIdMap = new Map<string, string>();

  const entitySet = findEntitySet(metadata, BILL_ENTITY_SET_CANDIDATES);
  if (!entitySet) {
    logger.warn(
      { candidates: BILL_ENTITY_SET_CANDIDATES },
      "No Bill entity set found in OData metadata - skipping bill sync",
    );
    tracker.addError(`No Bill entity set found. Tried: ${BILL_ENTITY_SET_CANDIDATES.join(", ")}`);
    return billIdMap;
  }

  logger.info({ entitySet: entitySet.name }, "Syncing bills");
  tracker.initEntity("bill");

  const client = new ODataClient(metadata);
  const limit = pLimit(ETL_CONCURRENCY);

  for await (const page of client.fetchAllPages<RawBill>(entitySet.name)) {
    await Promise.all(
      page.map((raw) =>
        limit(async () => {
          tracker.increment("bill", "fetched");
          try {
            const data = mapBillToBill(raw);
            const existing = await db.bill.findUnique({
              where: {
                external_id_external_source: {
                  external_id: data.external_id,
                  external_source: data.external_source,
                },
              },
            });

            const bill = await db.bill.upsert({
              where: {
                external_id_external_source: {
                  external_id: data.external_id,
                  external_source: data.external_source,
                },
              },
              create: data,
              update: {
                status: data.status,
                topic: data.topic,
                last_status_date: data.last_status_date,
                last_seen_at: new Date(),
                last_changed_at: data.last_changed_at,
              },
            });

            billIdMap.set(data.external_id, bill.id);

            await saveSnapshot({
              entityType: "bill",
              entityId: bill.id,
              externalSource: "knesset_odata",
              externalId: data.external_id,
              etlRunId: tracker.getRunId(),
              payload: raw,
            });

            await db.sourceLink.upsert({
              where: { id: `bill-${bill.id}-odata` },
              create: {
                id: `bill-${bill.id}-odata`,
                entity_type: "bill",
                entity_id: bill.id,
                label: "Knesset OData",
                url: data.source_url ?? "https://knesset.gov.il",
                external_source: "knesset_odata",
                external_id: data.external_id,
              },
              update: {},
            });

            if (existing) {
              tracker.increment("bill", "updated");
            } else {
              tracker.increment("bill", "created");
            }
          } catch (err) {
            tracker.increment("bill", "failed");
            logger.error({ raw, err }, "Failed to sync bill");
          }
        }),
      ),
    );
  }

  // Sync bill initiators (sponsors)
  await syncBillInitiators(metadata, tracker, billIdMap, mkIdMap, client);

  // Sync bill stage history
  await syncBillStages(metadata, tracker, billIdMap, client);

  logger.info(
    { count: billIdMap.size, ...tracker.getSummary().counts["bill"] },
    "Bill sync complete",
  );
  return billIdMap;
}

async function syncBillInitiators(
  metadata: ODataMetadata,
  tracker: ETLRunTracker,
  billIdMap: Map<string, string>,
  mkIdMap: Map<string, string>,
  client: ODataClient,
): Promise<void> {
  const entitySet = findEntitySet(metadata, BILL_INITIATOR_ENTITY_SET_CANDIDATES);
  if (!entitySet) {
    logger.info("No bill initiator entity set found - skipping");
    return;
  }

  logger.info({ entitySet: entitySet.name }, "Syncing bill initiators");
  tracker.initEntity("bill_role");

  const limit = pLimit(ETL_CONCURRENCY);

  for await (const page of client.fetchAllPages<RawBillInitiator>(entitySet.name)) {
    await Promise.all(
      page.map((raw) =>
        limit(async () => {
          tracker.increment("bill_role", "fetched");
          try {
            const billExtId = String(raw.BillID ?? "");
            const mkExtId = String(raw.PersonID ?? raw.MemberID ?? "");

            const billDbId = billIdMap.get(billExtId);
            const mkDbId = mkIdMap.get(mkExtId);

            if (!billDbId || !mkDbId) return;

            const role = raw.IsInitiator ? "initiator" : "cosponsor";

            await db.mKBillRole.upsert({
              where: {
                mk_id_bill_id_role: {
                  mk_id: mkDbId,
                  bill_id: billDbId,
                  role,
                },
              },
              create: {
                mk_id: mkDbId,
                bill_id: billDbId,
                external_source: "knesset_odata",
                role,
              },
              update: {},
            });

            tracker.increment("bill_role", "created");
          } catch (err) {
            tracker.increment("bill_role", "failed");
            logger.error({ raw, err }, "Failed to sync bill initiator");
          }
        }),
      ),
    );
  }
}

async function syncBillStages(
  metadata: ODataMetadata,
  tracker: ETLRunTracker,
  billIdMap: Map<string, string>,
  client: ODataClient,
): Promise<void> {
  const entitySet = findEntitySet(metadata, BILL_STAGE_ENTITY_SET_CANDIDATES);
  if (!entitySet) {
    logger.info("No bill stage entity set found - skipping");
    return;
  }

  logger.info({ entitySet: entitySet.name }, "Syncing bill stages");
  tracker.initEntity("bill_stage");

  const limit = pLimit(ETL_CONCURRENCY);

  for await (const page of client.fetchAllPages<RawBillStage>(entitySet.name)) {
    await Promise.all(
      page.map((raw) =>
        limit(async () => {
          tracker.increment("bill_stage", "fetched");
          try {
            const billExtId = String(raw.BillID ?? "");
            const billDbId = billIdMap.get(billExtId);
            if (!billDbId) return;

            const stageExtId = String(raw.BillHistoryInitiatorID ?? raw.BillHistoryID ?? "").trim();

            // Skip stages with no external_id — we have no idempotency key for them
            if (!stageExtId) {
              logger.debug({ billDbId }, "Skipping bill stage with no external_id");
              return;
            }

            await db.billStage.upsert({
              where: {
                bill_id_external_id: {
                  bill_id: billDbId,
                  external_id: stageExtId,
                },
              },
              create: {
                bill_id: billDbId,
                external_id: stageExtId,
                external_source: "knesset_odata",
                stage_name_he: raw.StageName ?? raw.ReasonDesc ?? raw.StageDesc ?? "Unknown",
                stage_name_en: null,
                status: raw.ReasonDesc
                  ? String(raw.ReasonDesc)
                  : raw.StageDesc
                    ? String(raw.StageDesc)
                    : null,
                stage_date: raw.StartDate
                  ? new Date(raw.StartDate)
                  : raw.StageDate
                    ? new Date(raw.StageDate)
                    : null,
                notes: null,
              },
              update: {
                status: raw.ReasonDesc
                  ? String(raw.ReasonDesc)
                  : raw.StageDesc
                    ? String(raw.StageDesc)
                    : null,
                stage_date: raw.StartDate
                  ? new Date(raw.StartDate)
                  : raw.StageDate
                    ? new Date(raw.StageDate)
                    : null,
              },
            });

            tracker.increment("bill_stage", "created");
          } catch (err) {
            tracker.increment("bill_stage", "failed");
            logger.error({ raw, err }, "Failed to sync bill stage");
          }
        }),
      ),
    );
  }
}
