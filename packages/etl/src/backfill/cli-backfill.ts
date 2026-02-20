#!/usr/bin/env node
/**
 * CLI entry point for bill-role backfill.
 * Reads existing RawSnapshot rows — no new HTTP calls to OData.
 *
 * Usage: pnpm --filter @knesset-vote/etl backfill
 *   or:  pnpm etl:backfill
 */

import { runBackfill } from "./backfill-bill-roles.js";
import { logger } from "../logger.js";
import { db } from "@knesset-vote/db";

async function main() {
  try {
    const result = await runBackfill();
    logger.info(result, "Backfill finished successfully");
  } catch (err) {
    logger.error(err, "Backfill failed with unhandled error");
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();
