/**
 * seed-more-votes.ts
 *
 * Fetches votes 301–2300 (20 pages × 100) from KNS_PlenumVote ordered by
 * VoteDateTime desc, then pulls their vote records and upserts everything.
 *
 * Run AFTER seed-vote-mks so the MkId→DB map is complete.
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
const START_PAGE = 3; // skip first 300 (already seeded)
const END_PAGE = 23; // fetch pages 4–23 → 2000 more votes
const BATCH_SIZE = 10;
const DELAY_MS = 350;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage<T>(entity: string, skip: number, orderby?: string): Promise<T[]> {
  let url = `${VOTES_V4_BASE}/${entity}?$top=${PAGE_SIZE}&$skip=${skip}&$format=json`;
  if (orderby) url += `&$orderby=${encodeURIComponent(orderby)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  const data = (await res.json()) as { value?: T[] };
  return data.value ?? [];
}

async function main() {
  console.log("=== seed-more-votes ===");

  // Build MkId → DB id map (includes newly inserted vote-MKs)
  const mks = await db.mK.findMany({ select: { id: true, external_id: true } });
  const mkIdMap = new Map<string, string>();
  for (const mk of mks) mkIdMap.set(mk.external_id, mk.id);
  console.log(`MKs in DB: ${mks.length}`);

  // Fetch vote headers pages START_PAGE..END_PAGE
  console.log(
    `\nFetching vote pages ${START_PAGE + 1}–${END_PAGE} (${(END_PAGE - START_PAGE) * PAGE_SIZE} votes)...`,
  );
  const allHeaders: RawVoteHeader[] = [];

  for (let p = START_PAGE; p < END_PAGE; p++) {
    const skip = p * PAGE_SIZE;
    const page = await fetchPage<RawVoteHeader>(VOTE_HEADER_ENTITY, skip, "VoteDateTime desc");
    allHeaders.push(...page);
    process.stdout.write(
      `  page ${p + 1}/${END_PAGE}: ${page.length} votes (total ${allHeaders.length})\n`,
    );
    if (page.length < PAGE_SIZE) break;
    await sleep(DELAY_MS);
  }
  console.log(`Fetched ${allHeaders.length} vote headers`);

  // Upsert vote headers
  console.log("\nUpserting vote headers...");
  const voteIdMap = new Map<number, string>();
  let voteCount = 0;

  for (const raw of allHeaders) {
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
      console.warn(`  vote ${raw.Id} failed: ${err}`);
    }
  }
  console.log(`Upserted ${voteCount} votes`);

  // Fetch + upsert vote records in batches
  const voteOdataIds = Array.from(voteIdMap.keys());
  console.log(`\nFetching records for ${voteOdataIds.length} votes in batches of ${BATCH_SIZE}...`);

  let recordCount = 0;
  let batchNum = 0;

  for (let b = 0; b < voteOdataIds.length; b += BATCH_SIZE) {
    const batch = voteOdataIds.slice(b, b + BATCH_SIZE);
    batchNum++;

    const filter = batch.map((id) => `VoteID eq ${id}`).join(" or ");
    const url = `${VOTES_V4_BASE}/${VOTE_RECORD_ENTITY}?$filter=${encodeURIComponent(filter)}&$top=1000&$format=json`;

    try {
      process.stdout.write(
        `  batch ${batchNum}/${Math.ceil(voteOdataIds.length / BATCH_SIZE)}: fetching...`,
      );
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(` HTTP ${res.status} — skip`);
        continue;
      }
      const data = (await res.json()) as { value?: RawVoteRecord[] };
      const records = data.value ?? [];
      process.stdout.write(` ${records.length} records\n`);

      const voteCounts = new Map<number, { yes: number; no: number; abstain: number }>();

      for (const raw of records) {
        const voteId = raw.VoteID;
        if (!voteId) continue;
        const voteDbId = voteIdMap.get(voteId);
        if (!voteDbId) continue;

        // aggregate counts
        if (!voteCounts.has(voteId)) voteCounts.set(voteId, { yes: 0, no: 0, abstain: 0 });
        const c = voteCounts.get(voteId)!;
        if (raw.ResultCode === 7 || raw.ResultCode === 11) c.yes++;
        else if (raw.ResultCode === 8) c.no++;
        else if (raw.ResultCode === 9) c.abstain++;

        // insert VoteRecord only for MKs we have
        if (!raw.MkId) continue;
        const mkDbId = mkIdMap.get(String(raw.MkId));
        if (!mkDbId) continue;

        const position = mapVoteResult(raw.ResultCode);
        try {
          await db.voteRecord.upsert({
            where: { vote_id_mk_id: { vote_id: voteDbId, mk_id: mkDbId } },
            create: { vote_id: voteDbId, mk_id: mkDbId, external_source: "knesset_v4", position },
            update: { position },
          });
          recordCount++;
        } catch {
          /* skip dup */
        }
      }

      // update counts
      for (const [odataId, counts] of voteCounts) {
        const voteDbId = voteIdMap.get(odataId);
        if (!voteDbId) continue;
        const result =
          counts.yes > counts.no ? "passed" : counts.no > counts.yes ? "rejected" : "unknown";
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
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.warn(`  batch ${batchNum} error: ${err}`);
    }

    if (b + BATCH_SIZE < voteOdataIds.length) await sleep(DELAY_MS);
  }

  console.log(`\n✅ Done! ${voteCount} votes, ${recordCount} vote records`);

  const totals = await db.$queryRaw<{ votes: bigint; records: bigint }[]>`
    SELECT
      (SELECT COUNT(*) FROM "Vote") AS votes,
      (SELECT COUNT(*) FROM "VoteRecord") AS records
  `;
  console.log(`   DB totals — votes: ${totals[0]?.votes}, records: ${totals[0]?.records}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
