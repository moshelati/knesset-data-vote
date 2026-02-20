/**
 * Backfill MKBillRole rows from existing RawSnapshot data.
 *
 * The original ETL sync only created MKBillRole entries for MKs whose
 * external_id was present in the mkIdMap at sync time. This backfill
 * re-reads all existing bill_role RawSnapshot rows (no new HTTP calls)
 * and re-attempts upserts, picking up previously-missed MKs.
 */

import pLimit from "p-limit";
import { db } from "@knesset-vote/db";
import { ETL_CONCURRENCY } from "@knesset-vote/shared";
import type { RawBillInitiator } from "../mappers/bill-mapper.js";
import { logger } from "../logger.js";

export interface BackfillResult {
  rows_processed: number;
  roles_created: number;
  roles_skipped: number;
  errors: number;
  duration_ms: number;
}

export async function runBackfill(): Promise<BackfillResult> {
  const startedAt = Date.now();
  logger.info("Starting bill-role backfill from existing RawSnapshot rows...");

  // Build MK external_id → internal DB id map
  logger.info("Building MK id map...");
  const mkRows = await db.mK.findMany({ select: { id: true, external_id: true } });
  const mkIdMap = new Map<string, string>(mkRows.map((mk) => [mk.external_id, mk.id]));
  logger.info({ mk_count: mkIdMap.size }, "MK id map built");

  // Build Bill external_id → internal DB id map
  logger.info("Building Bill id map...");
  const billRows = await db.bill.findMany({ select: { id: true, external_id: true } });
  const billIdMap = new Map<string, string>(billRows.map((b) => [b.external_id, b.id]));
  logger.info({ bill_count: billIdMap.size }, "Bill id map built");

  // Fetch all bill_role snapshots (no HTTP — reads from DB only)
  logger.info("Fetching bill_role RawSnapshot rows...");
  const snapshots = await db.rawSnapshot.findMany({
    where: { entity_type: "bill_role" },
    select: { id: true, payload_json: true },
  });
  logger.info({ snapshot_count: snapshots.length }, "Snapshots fetched");

  const limit = pLimit(ETL_CONCURRENCY);
  let rolesCreated = 0;
  let rolesSkipped = 0;
  let errors = 0;

  await Promise.all(
    snapshots.map((snapshot) =>
      limit(async () => {
        try {
          const raw = snapshot.payload_json as RawBillInitiator;

          const billExtId = String(raw.BillID ?? "");
          const mkExtId = String(raw.PersonID ?? raw.MemberID ?? "");

          const billDbId = billIdMap.get(billExtId);
          const mkDbId = mkIdMap.get(mkExtId);

          if (!billDbId || !mkDbId) {
            rolesSkipped++;
            return;
          }

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

          rolesCreated++;
        } catch (err) {
          errors++;
          logger.error({ snapshotId: snapshot.id, err }, "Failed to process bill_role snapshot");
        }
      }),
    ),
  );

  const result: BackfillResult = {
    rows_processed: snapshots.length,
    roles_created: rolesCreated,
    roles_skipped: rolesSkipped,
    errors,
    duration_ms: Date.now() - startedAt,
  };

  logger.info(result, "Bill-role backfill complete");
  return result;
}
