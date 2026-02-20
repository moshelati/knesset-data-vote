/**
 * seed-vote-mks.ts
 *
 * Collects all unique MkIds from KNS_PlenumVoteResult for the votes already in
 * our DB, then upserts any MK missing from the MK table.
 *
 * Much faster than scanning the full 1.85M VoteResult table — only fetches
 * records for the ~2300 vote IDs we already have.
 */

import { db } from "@knesset-vote/db";
import { randomUUID } from "crypto";

const BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";
const BATCH = 10;   // vote IDs per OData filter
const DELAY = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("=== seed-vote-mks ===\n");

  // 1. Get all external vote IDs from DB
  const votes = await db.vote.findMany({ select: { id: true, external_id: true } });
  console.log(`Votes in DB: ${votes.length}`);

  // 2. Get existing MK external_ids
  const existingMks = await db.mK.findMany({ select: { id: true, external_id: true } });
  const mkIdMap = new Map<string, string>(existingMks.map((m) => [m.external_id, m.id]));
  console.log(`MKs already in DB: ${mkIdMap.size}`);

  // 3. For each batch of votes, fetch all VoteResult rows and collect unique MkIds
  const missingMks = new Map<number, { firstName: string; lastName: string }>();

  const voteOdataIds = votes.map((v) => Number(v.external_id)).filter(Boolean);
  let batchNum = 0;

  console.log(`\nScanning VoteResult for ${voteOdataIds.length} votes in batches of ${BATCH}...`);

  for (let b = 0; b < voteOdataIds.length; b += BATCH) {
    const batch = voteOdataIds.slice(b, b + BATCH);
    batchNum++;

    const filter = batch.map((id) => `VoteID eq ${id}`).join(" or ");
    let skip = 0;

    while (true) {
      const url = `${BASE}/KNS_PlenumVoteResult?$filter=${encodeURIComponent(filter)}&$top=1000&$skip=${skip}&$format=json`;
      try {
        const res = await fetch(url);
        if (!res.ok) break;
        const data = (await res.json()) as {
          value?: { MkId: number; FirstName: string; LastName: string }[];
        };
        const rows = data.value ?? [];

        for (const r of rows) {
          if (!r.MkId) continue;
          if (!mkIdMap.has(String(r.MkId)) && !missingMks.has(r.MkId)) {
            missingMks.set(r.MkId, {
              firstName: r.FirstName ?? "",
              lastName: r.LastName ?? "",
            });
          }
        }

        if (rows.length < 1000) break;
        skip += 1000;
      } catch {
        break;
      }
    }

    if (batchNum % 10 === 0 || batchNum === Math.ceil(voteOdataIds.length / BATCH)) {
      process.stdout.write(
        `  batch ${batchNum}/${Math.ceil(voteOdataIds.length / BATCH)} — ${missingMks.size} missing MKs found so far\n`,
      );
    }

    if (b + BATCH < voteOdataIds.length) await sleep(DELAY);
  }

  console.log(`\nMissing MKs to insert: ${missingMks.size}`);

  if (missingMks.size === 0) {
    console.log("All MKs already in DB — nothing to do.");
    await db.$disconnect();
    return;
  }

  // 4. Upsert missing MKs
  let inserted = 0;
  for (const [mkId, { firstName, lastName }] of missingMks) {
    try {
      await db.mK.upsert({
        where: {
          external_id_external_source: {
            external_id: String(mkId),
            external_source: "knesset_v4",
          },
        },
        create: {
          id: randomUUID(),
          external_id: String(mkId),
          external_source: "knesset_v4",
          name_he: `${firstName} ${lastName}`.trim(),
          name_en: null,
          is_current: false,
          last_seen_at: new Date(),
        },
        update: {
          name_he: `${firstName} ${lastName}`.trim(),
          last_seen_at: new Date(),
        },
      });
      mkIdMap.set(String(mkId), ""); // mark as known
      inserted++;
    } catch (err) {
      console.warn(`  Failed MkId ${mkId}: ${err}`);
    }
  }

  console.log(`\n✅ Inserted/updated ${inserted} MKs`);
  console.log(`   Total MKs in DB: ${await db.mK.count()}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
