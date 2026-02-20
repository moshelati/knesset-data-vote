#!/usr/bin/env node
/**
 * CLI entry point for the party-topic aggregation step.
 * Usage: pnpm etl:aggregate
 *        tsx src/aggregate/cli-aggregate.ts aggregate
 */

import { db } from "@knesset-vote/db";
import { runAggregate } from "./aggregate-party-topics.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command !== "aggregate") {
    console.error(`Unknown command: ${command ?? "(none)"}`);
    console.error("Usage: tsx src/aggregate/cli-aggregate.ts aggregate");
    process.exit(1);
  }

  try {
    const result = await runAggregate();
    console.log(
      `\nAggregate complete: rows_written=${result.rows_written}, parties_updated=${result.parties_updated}, duration_ms=${result.duration_ms}`,
    );
    await db.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Aggregation failed:", err);
    await db.$disconnect();
    process.exit(1);
  }
}

main();
