/**
 * Quick vote seed script — fetches the most recent ~300 votes from
 * Knesset OData v4 and inserts them plus their MK vote records.
 *
 * Usage: pnpm --filter @knesset-vote/etl tsx src/seed-votes.ts
 *
 * Runs in parallel with the main ETL without conflict (upserts are idempotent).
 */

import { db } from "@knesset-vote/db";
import {
  VOTES_V4_BASE,
  VOTE_HEADER_ENTITY,
  VOTE_RECORD_ENTITY,
  mapVoteHeaderToVote,
  mapVoteResult,
  type RawVoteHeader,
  type RawVoteRecord,
} from "./mappers/vote-mapper.js";

const PAGE_SIZE = 100;
const VOTE_PAGES = 3; // 300 most-recent votes
const DELAY_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage<T>(entity: string, skip: number, orderby?: string): Promise<T[]> {
  let url = `${VOTES_V4_BASE}/${entity}?$top=${PAGE_SIZE}&$skip=${skip}&$format=json`;
  if (orderby) url += `&$orderby=${encodeURIComponent(orderby)}`;
  console.log(`  GET ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  const data = (await res.json()) as { value?: T[] };
  return data.value ?? [];
}

async function main() {
  console.log("=== Vote Seed Script ===");
  console.log("Fetching real MKs from DB...");

  // Build MkId → DB id map
  const mks = await db.mK.findMany({ select: { id: true, external_id: true } });
  const mkIdMap = new Map<string, string>();
  for (const mk of mks) {
    mkIdMap.set(mk.external_id, mk.id);
  }
  console.log(`  Found ${mks.length} MKs in DB (${mkIdMap.size} in map)`);

  // Step 1: Fetch most-recent vote headers ordered by VoteDateTime desc
  console.log(`\nFetching ${VOTE_PAGES} pages of recent votes from KNS_PlenumVote...`);
  const allVoteHeaders: RawVoteHeader[] = [];
  for (let i = 0; i < VOTE_PAGES; i++) {
    const page = await fetchPage<RawVoteHeader>(
      VOTE_HEADER_ENTITY,
      i * PAGE_SIZE,
      "VoteDateTime desc",
    );
    allVoteHeaders.push(...page);
    console.log(`  Page ${i + 1}: ${page.length} votes`);
    if (page.length < PAGE_SIZE) break;
    if (i < VOTE_PAGES - 1) await sleep(DELAY_MS);
  }
  console.log(`  Total vote headers fetched: ${allVoteHeaders.length}`);

  // Step 2: Upsert vote headers into DB
  console.log("\nUpserting vote headers into DB...");
  const voteIdMap = new Map<number, string>(); // OData Id → DB vote.id
  let voteCount = 0;
  for (const raw of allVoteHeaders) {
    try {
      const data = mapVoteHeaderToVote(raw);
      const vote = await db.vote.upsert({
        where: {
          external_id_external_source: {
            external_id: data.external_id,
            external_source: data.external_source,
          },
        },
        create: data,
        update: {
          title_he: data.title_he,
          vote_date: data.vote_date,
          result: data.result,
          last_seen_at: new Date(),
        },
      });
      if (raw.Id) voteIdMap.set(raw.Id, vote.id);
      voteCount++;
    } catch (err) {
      console.warn(`  Failed to upsert vote ${raw.Id}: ${err}`);
    }
  }
  console.log(`  Upserted ${voteCount} votes, mapped ${voteIdMap.size} IDs`);

  // Step 3: For each vote ID, fetch its vote records
  const voteOdataIds = Array.from(voteIdMap.keys());
  console.log(`\nFetching vote records for ${voteOdataIds.length} votes...`);

  let recordCount = 0;
  let batchNum = 0;
  const BATCH_SIZE = 10; // process in batches to avoid too many concurrent requests

  for (let b = 0; b < voteOdataIds.length; b += BATCH_SIZE) {
    const batch = voteOdataIds.slice(b, b + BATCH_SIZE);
    batchNum++;

    // Build OData filter for this batch: Id in (x, y, z)
    // OData v4 supports `Id eq x or Id eq y` style
    const filterParts = batch.map((id) => `VoteID eq ${id}`).join(" or ");
    const url = `${VOTES_V4_BASE}/${VOTE_RECORD_ENTITY}?$filter=${encodeURIComponent(filterParts)}&$top=1000&$format=json`;

    try {
      console.log(`  Batch ${batchNum}/${Math.ceil(voteOdataIds.length / BATCH_SIZE)}: fetching records for ${batch.length} votes`);
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  HTTP ${res.status} — skipping batch`);
        continue;
      }
      const data = (await res.json()) as { value?: RawVoteRecord[] };
      const records = data.value ?? [];

      // Aggregate counts per vote for this batch
      const voteCounts = new Map<number, { yes: number; no: number; abstain: number }>();

      for (const raw of records) {
        try {
          const voteId = raw.VoteID;
          if (!voteId) continue;
          const voteDbId = voteIdMap.get(voteId);
          if (!voteDbId) continue;

          // Aggregate counts (all records, not just matched MKs)
          if (!voteCounts.has(voteId)) voteCounts.set(voteId, { yes: 0, no: 0, abstain: 0 });
          const c = voteCounts.get(voteId)!;
          if (raw.ResultCode === 7 || raw.ResultCode === 11) c.yes++;
          else if (raw.ResultCode === 8) c.no++;
          else if (raw.ResultCode === 9) c.abstain++;

          // Only insert VoteRecord for MKs we have in DB
          if (!raw.MkId) continue;
          const mkDbId = mkIdMap.get(String(raw.MkId));
          if (!mkDbId) continue;

          const position = mapVoteResult(raw.ResultCode);

          await db.voteRecord.upsert({
            where: { vote_id_mk_id: { vote_id: voteDbId, mk_id: mkDbId } },
            create: {
              vote_id: voteDbId,
              mk_id: mkDbId,
              external_source: "knesset_v4",
              position,
            },
            update: { position },
          });
          recordCount++;
        } catch (err) {
          console.warn(`  Failed to upsert vote record: ${err}`);
        }
      }

      // Update vote headers with aggregated counts + derived result
      for (const [odataId, counts] of voteCounts) {
        const voteDbId = voteIdMap.get(odataId);
        if (!voteDbId) continue;
        const result = counts.yes > counts.no ? "passed" : counts.no > counts.yes ? "rejected" : "unknown";
        try {
          await db.vote.update({
            where: { id: voteDbId },
            data: {
              yes_count: counts.yes,
              no_count: counts.no,
              abstain_count: counts.abstain,
              result,
            },
          });
        } catch { /* ignore */ }
      }

    } catch (err) {
      console.warn(`  Batch ${batchNum} failed: ${err}`);
    }

    if (b + BATCH_SIZE < voteOdataIds.length) await sleep(DELAY_MS);
  }

  console.log(`\n✅ Done! Inserted ${voteCount} votes and ${recordCount} MK vote records`);
  console.log("   Visit http://localhost:3000/votes to see the results");

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
