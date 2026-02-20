/**
 * ETL Orchestrator
 *
 * Coordinates the full sync pipeline:
 * 1. Fetch + parse OData metadata
 * 2. Sync Parties
 * 3. Sync MKs + Memberships
 * 4. Sync Bills + Sponsors + Stages
 * 5. Sync Committees + Memberships
 * 6. Sync Votes + VoteRecords (from separate votes.svc OData)
 * 7. Produce ETLRun report
 */

import { fetchODataMetadata, parseODataMetadataXmlAsync } from "../client/odata-metadata.js";
import { syncParties } from "./sync-parties.js";
import { syncMKs } from "./sync-mks.js";
import { syncBills } from "./sync-bills.js";
import { syncCommittees } from "./sync-committees.js";
import { syncVotes } from "./sync-votes.js";
import { ETLRunTracker } from "./run-tracker.js";
import { logger } from "../logger.js";
import type { ETLRunResult, SyncOptions } from "@knesset-vote/shared";
import { KNESSET_ODATA_METADATA } from "@knesset-vote/shared";

export async function runSync(options: SyncOptions = {}): Promise<ETLRunResult> {
  const tracker = new ETLRunTracker();
  const runId = await tracker.start("knesset_odata");

  logger.info({ runId, options }, "Starting ETL sync");

  try {
    // Step 1: Discover entity sets from metadata
    const metadataUrl = process.env["KNESSET_ODATA_BASE_URL"]
      ? `${process.env["KNESSET_ODATA_BASE_URL"]}/$metadata`
      : KNESSET_ODATA_METADATA;

    let metadata;
    try {
      metadata = await fetchODataMetadata(metadataUrl);
      await tracker.updateEntitySets(metadata.entitySets.map((es) => es.name));
      logger.info(
        {
          entitySetCount: metadata.entitySets.length,
          names: metadata.entitySets.map((es) => es.name),
        },
        "OData metadata discovered",
      );
    } catch (err) {
      const errMsg = `Failed to fetch OData metadata from ${metadataUrl}: ${String(err)}`;
      logger.error({ err, metadataUrl }, errMsg);
      tracker.addError(errMsg);
      logger.warn("OData unavailable. Run `pnpm db:seed` to load demo data for UI testing.");
      return await tracker.complete("failed");
    }

    // Step 2: Sync Parties
    const partyIdMap = await syncParties(metadata, tracker);

    // Step 3: Sync MKs + Memberships
    const mkIdMap = await syncMKs(metadata, tracker, partyIdMap);

    // Step 4: Sync Bills + Sponsors + Stages
    const _billIdMap = await syncBills(metadata, tracker, mkIdMap);

    // Step 5: Sync Committees + Memberships
    await syncCommittees(metadata, tracker, mkIdMap);

    // Step 6: Sync Votes + VoteRecords (separate votes.svc OData endpoint)
    await syncVotes(tracker, mkIdMap);

    // Determine final status
    const summary = tracker.getSummary();
    const hasErrors = summary.errors.length > 0;
    const totalFetched = Object.values(summary.counts).reduce((sum, c) => sum + c.fetched, 0);
    const hasData = totalFetched > 0;

    let status: "completed" | "partial" | "failed";
    if (!hasData) {
      status = "failed";
    } else if (hasErrors) {
      status = "partial";
    } else {
      status = "completed";
    }

    const result = await tracker.complete(status);

    // Print summary
    logger.info(
      {
        status,
        runId,
        totalFetched,
        counts: summary.counts,
        errors: summary.errors.length,
        latencyMs: result.latencyMs,
      },
      "ETL sync complete",
    );

    return result;
  } catch (err) {
    logger.error({ err }, "ETL sync crashed");
    tracker.addError(`Fatal: ${String(err)}`);
    return await tracker.complete("failed");
  }
}

export { parseODataMetadataXmlAsync };
