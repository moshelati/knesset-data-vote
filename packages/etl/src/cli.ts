#!/usr/bin/env node
/**
 * ETL CLI
 * Usage: pnpm etl:sync [--demo]
 */

import { runSync } from "./sync/orchestrator.js";
import { logger } from "./logger.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const isDemo = args.includes("--demo");

  if (command === "sync") {
    if (isDemo) {
      logger.info("Demo mode: loading fixture data from database seed instead of OData");
      logger.info(
        "To load demo data, run: pnpm db:seed\n" +
          "Demo data is clearly marked is_demo=true in the database.",
      );
      process.exit(0);
    }

    const result = await runSync();

    if (result.status === "failed") {
      logger.error({ runId: result.runId, errors: result.errors }, "ETL sync failed");
      logger.info(
        "Tip: If the Knesset OData API is unreachable, run `pnpm db:seed` to load demo data.",
      );
      process.exit(1);
    }

    logger.info(
      {
        runId: result.runId,
        status: result.status,
        counts: result.counts,
        latencyMs: result.latencyMs,
      },
      "ETL sync finished",
    );
    process.exit(0);
  }

  if (command === "aggregate") {
    const { runAggregate } = await import("./aggregate/aggregate-party-topics.js");
    const result = await runAggregate();
    logger.info(result, "Aggregation complete");
    const { db } = await import("@knesset-vote/db");
    await db.$disconnect();
    process.exit(0);
  }

  if (command === "backfill") {
    const { runBackfill } = await import("./backfill/backfill-bill-roles.js");
    const result = await runBackfill();
    logger.info(result, "Backfill complete");
    const { db } = await import("@knesset-vote/db");
    await db.$disconnect();
    process.exit(0);
  }

  console.error(`Unknown command: ${command ?? "(none)"}`);
  console.error(
    "Usage: tsx src/cli.ts sync [--demo] | tsx src/cli.ts aggregate | tsx src/cli.ts backfill",
  );
  process.exit(1);
}

main().catch((err) => {
  logger.error(err, "Unhandled error in ETL CLI");
  process.exit(1);
});
