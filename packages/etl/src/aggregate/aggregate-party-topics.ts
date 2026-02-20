/**
 * aggregate-party-topics.ts
 *
 * Computes party × topic raw scores from bill activity data and upserts
 * them into the PartyTopicAgg table.
 *
 * Scoring formula:
 *   raw(party, topic) = Σ bill_points(status) × role_multiplier(role)
 *
 * bill_points:     passed=5, 2nd/3rd_reading=3, committee/1st_reading=2, submitted=1, else=0
 * role_multiplier: initiator=1.0, cosponsor=0.5, other=0
 *
 * Run with: pnpm etl:aggregate
 */

import { db } from "@knesset-vote/db";

// ──────────────────────────────────────────────────────────────────
// Pure scoring functions — exported for unit tests
// ──────────────────────────────────────────────────────────────────

/** Returns the point value for a given bill status */
export function computeBillPoints(status: string): number {
  switch (status) {
    case "passed":
      return 5;
    case "second_reading":
    case "third_reading":
      return 3;
    case "committee_review":
    case "first_reading":
      return 2;
    case "submitted":
      return 1;
    default:
      return 0; // draft, rejected, withdrawn, expired, unknown
  }
}

/** Applies role multiplier to base points */
export function applyRoleMultiplier(points: number, role: string): number {
  switch (role) {
    case "initiator":
      return points * 1.0;
    case "cosponsor":
      return points * 0.5;
    default:
      return 0; // committee, other
  }
}

export interface RawAggRow {
  party_id: string;
  topic: string;
  raw_score: number;
  bill_count: number;
}

/**
 * Min-max normalizes raw scores per topic across all parties.
 * Returns: Map<party_id, Map<topic, normalized_score (0–1)>>
 *
 * Edge cases:
 * - All parties score 0 for a topic  → 0 for all
 * - All parties score the same value → 1 for all (max activity detected)
 */
export function normalizePartyScores(
  rows: RawAggRow[],
  topicKeys: string[],
): Map<string, Map<string, number>> {
  // Group by topic
  const byTopic = new Map<string, RawAggRow[]>();
  for (const row of rows) {
    if (!topicKeys.includes(row.topic)) continue;
    const arr = byTopic.get(row.topic) ?? [];
    arr.push(row);
    byTopic.set(row.topic, arr);
  }

  const result = new Map<string, Map<string, number>>();

  for (const [topic, topicRows] of byTopic) {
    const max = Math.max(...topicRows.map((r) => r.raw_score));
    const min = Math.min(...topicRows.map((r) => r.raw_score));

    for (const row of topicRows) {
      const partyMap = result.get(row.party_id) ?? new Map<string, number>();
      let normalized: number;
      if (max === 0) {
        normalized = 0;
      } else if (max === min) {
        // All parties have identical non-zero activity — give everyone 1
        normalized = 1;
      } else {
        normalized = (row.raw_score - min) / (max - min);
      }
      partyMap.set(topic, normalized);
      result.set(row.party_id, partyMap);
    }
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────
// Raw SQL aggregation query
// ──────────────────────────────────────────────────────────────────

interface SqlAggRow {
  party_id: string;
  topic: string;
  raw_score: number;
  bill_count: number;
}

async function fetchAggRows(): Promise<SqlAggRow[]> {
  const rows = await db.$queryRaw<SqlAggRow[]>`
    SELECT
      pm.party_id,
      b.topic,
      SUM(
        CASE b.status
          WHEN 'passed'          THEN 5
          WHEN 'second_reading'  THEN 3
          WHEN 'third_reading'   THEN 3
          WHEN 'committee_review' THEN 2
          WHEN 'first_reading'   THEN 2
          WHEN 'submitted'       THEN 1
          ELSE 0
        END
        *
        CASE mbr.role
          WHEN 'initiator' THEN 1.0
          WHEN 'cosponsor' THEN 0.5
          ELSE 0
        END
      )::float AS raw_score,
      COUNT(DISTINCT b.id)::int AS bill_count
    FROM "MKBillRole" mbr
    JOIN "Bill" b ON b.id = mbr.bill_id
    JOIN "PartyMembership" pm ON pm.mk_id = mbr.mk_id AND pm.is_current = true
    WHERE mbr.role IN ('initiator', 'cosponsor')
      AND b.topic IS NOT NULL
      AND b.topic != 'other'
    GROUP BY pm.party_id, b.topic
    HAVING SUM(
      CASE b.status
        WHEN 'passed'          THEN 5
        WHEN 'second_reading'  THEN 3
        WHEN 'third_reading'   THEN 3
        WHEN 'committee_review' THEN 2
        WHEN 'first_reading'   THEN 2
        WHEN 'submitted'       THEN 1
        ELSE 0
      END
      *
      CASE mbr.role
        WHEN 'initiator' THEN 1.0
        WHEN 'cosponsor' THEN 0.5
        ELSE 0
      END
    ) > 0
  `;
  return rows;
}

// ──────────────────────────────────────────────────────────────────
// Main entry point
// ──────────────────────────────────────────────────────────────────

export interface AggregateResult {
  rows_written: number;
  parties_updated: number;
  duration_ms: number;
}

export async function runAggregate(): Promise<AggregateResult> {
  const startedAt = Date.now();

  console.log("=== aggregate-party-topics ===");
  console.log("Fetching raw scores from DB...");

  const rawRows = await fetchAggRows();
  console.log(`  Aggregation query returned ${rawRows.length} rows`);

  if (rawRows.length === 0) {
    console.warn("  No rows returned — is bill/MK data loaded? Run pnpm etl:sync first.");
    return { rows_written: 0, parties_updated: 0, duration_ms: Date.now() - startedAt };
  }

  // Upsert in batches of 50
  const BATCH_SIZE = 50;
  let rows_written = 0;
  const partiesSet = new Set<string>();

  for (let b = 0; b < rawRows.length; b += BATCH_SIZE) {
    const batch = rawRows.slice(b, b + BATCH_SIZE);

    await db.$transaction(
      batch.map((row) => {
        partiesSet.add(row.party_id);
        return db.partyTopicAgg.upsert({
          where: {
            party_id_topic: {
              party_id: row.party_id,
              topic: row.topic,
            },
          },
          create: {
            party_id: row.party_id,
            topic: row.topic,
            raw_score: Number(row.raw_score),
            bill_count: Number(row.bill_count),
            computed_at: new Date(),
          },
          update: {
            raw_score: Number(row.raw_score),
            bill_count: Number(row.bill_count),
            computed_at: new Date(),
          },
        });
      }),
    );

    rows_written += batch.length;

    if (b % (BATCH_SIZE * 10) === 0 || b + BATCH_SIZE >= rawRows.length) {
      process.stdout.write(
        `  batch ${Math.ceil((b + 1) / BATCH_SIZE)}/${Math.ceil(rawRows.length / BATCH_SIZE)} — ${rows_written} rows written\n`,
      );
    }
  }

  const duration_ms = Date.now() - startedAt;
  console.log(`\n✅ Done! ${rows_written} rows, ${partiesSet.size} parties, ${duration_ms}ms`);

  return {
    rows_written,
    parties_updated: partiesSet.size,
    duration_ms,
  };
}
