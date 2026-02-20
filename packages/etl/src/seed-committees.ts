/**
 * Quick committee + committee-membership seed script.
 *
 * Fetches KNS_Committee (all, ~1000) and KNS_PersonToPosition
 * filtered to CommitteeID ne null — inserts into DB in parallel
 * with the running ETL (all upserts are idempotent).
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx src/seed-committees.ts
 */

import { db } from "@knesset-vote/db";

const BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";
const PAGE = 100; // API max is 100 rows per page
const DELAY = 350;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchAll<T>(entity: string, filter?: string): Promise<T[]> {
  const results: T[] = [];
  let skip = 0;
  while (true) {
    let url = `${BASE}/${entity}?$top=${PAGE}&$skip=${skip}&$format=json`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    console.log(`  GET ${entity} skip=${skip} (${results.length} so far)`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    const data = (await res.json()) as { value?: T[] };
    const page = data.value ?? [];
    results.push(...page);
    if (page.length < PAGE) break;
    skip += PAGE;
    await sleep(DELAY);
  }
  return results;
}

interface RawCommittee {
  CommitteeID?: number;
  Id?: number;
  ID?: number;
  Name?: string;
  CommitteeName?: string;
  CategoryDesc?: string | null;
  CommitteeTypeDesc?: string | null;
  AdditionalTypeDesc?: string | null;
  KnessetNum?: number | null;
  StartDate?: string | null;
  FinishDate?: string | null;
  IsCurrent?: boolean;
}

interface RawPosition {
  PersonID?: number;
  CommitteeID?: number;
  CommitteeName?: string | null;
  PositionID?: number;
  StartDate?: string | null;
  FinishDate?: string | null;
  IsCurrent?: boolean;
  KnessetNum?: number | null;
}

async function main() {
  console.log("=== Committee Seed ===");

  // ── 1. Load MK map ──────────────────────────────────────────────────────────
  const mks = await db.mK.findMany({ select: { id: true, external_id: true } });
  const mkMap = new Map(mks.map((m) => [m.external_id, m.id]));
  console.log(`Found ${mks.length} MKs`);

  // ── 2. Fetch + upsert all committees ────────────────────────────────────────
  console.log("\nFetching KNS_Committee…");
  const rawCommittees = await fetchAll<RawCommittee>("KNS_Committee");
  console.log(`  ${rawCommittees.length} committees fetched`);

  const committeeMap = new Map<string, string>(); // external_id → db id
  let committeeCount = 0;
  for (const raw of rawCommittees) {
    const extId = raw.CommitteeID ?? raw.Id ?? raw.ID;
    const name = raw.Name ?? raw.CommitteeName;
    if (!extId || !name) continue;
    try {
      const c = await db.committee.upsert({
        where: {
          external_id_external_source: {
            external_id: String(extId),
            external_source: "knesset_odata",
          },
        },
        create: {
          external_id: String(extId),
          external_source: "knesset_odata",
          name_he: String(name),
          name_en: null,
          knesset_number: raw.KnessetNum ? Number(raw.KnessetNum) : null,
          is_active: raw.IsCurrent !== undefined ? Boolean(raw.IsCurrent) : !raw.FinishDate,
          source_url: `${BASE}/KNS_Committee(${extId})`,
          last_seen_at: new Date(),
        },
        update: {
          name_he: String(name),
          is_active: raw.IsCurrent !== undefined ? Boolean(raw.IsCurrent) : !raw.FinishDate,
          last_seen_at: new Date(),
        },
      });
      committeeMap.set(String(extId), c.id);
      committeeCount++;
    } catch (err) {
      console.warn(`  Failed committee ${extId}: ${err}`);
    }
  }
  console.log(`  Upserted ${committeeCount} committees`);

  // ── 3. Fetch PersonToPosition filtered to CommitteeID ne null ───────────────
  console.log("\nFetching KNS_PersonToPosition (CommitteeID ne null)…");
  const rawPositions = await fetchAll<RawPosition>("KNS_PersonToPosition", "CommitteeID ne null");
  console.log(`  ${rawPositions.length} committee-position rows fetched`);

  let memberCount = 0;
  let skipped = 0;
  for (const raw of rawPositions) {
    if (!raw.CommitteeID || !raw.PersonID) {
      skipped++;
      continue;
    }
    const committeeDbId = committeeMap.get(String(raw.CommitteeID));
    const mkDbId = mkMap.get(String(raw.PersonID));
    if (!committeeDbId || !mkDbId) {
      skipped++;
      continue;
    }

    try {
      await db.committeeMembership.upsert({
        where: {
          mk_id_committee_id: { mk_id: mkDbId, committee_id: committeeDbId },
        },
        create: {
          mk_id: mkDbId,
          committee_id: committeeDbId,
          external_source: "knesset_odata",
          role: null,
          start_date: raw.StartDate ? new Date(raw.StartDate) : null,
          end_date: raw.FinishDate ? new Date(raw.FinishDate) : null,
          is_current: raw.IsCurrent !== undefined ? Boolean(raw.IsCurrent) : !raw.FinishDate,
        },
        update: {
          end_date: raw.FinishDate ? new Date(raw.FinishDate) : null,
          is_current: raw.IsCurrent !== undefined ? Boolean(raw.IsCurrent) : !raw.FinishDate,
        },
      });
      memberCount++;
    } catch (err) {
      console.warn(
        `  Failed membership PersonID=${raw.PersonID} CommitteeID=${raw.CommitteeID}: ${err}`,
      );
    }
  }
  console.log(
    `  Upserted ${memberCount} committee memberships (${skipped} skipped — MK/committee not in DB)`,
  );

  // ── Final summary ────────────────────────────────────────────────────────────
  const counts = await db.$queryRaw<{ committees: bigint; memberships: bigint }[]>`
    SELECT
      (SELECT COUNT(*) FROM "Committee") as committees,
      (SELECT COUNT(*) FROM "CommitteeMembership") as memberships
  `;
  const { committees, memberships } = counts[0]!;
  console.log(
    `\n✅ Done! DB now has ${committees} committees and ${memberships} committee memberships`,
  );
  console.log("   Visit http://localhost:3000/mks to see updated profiles");

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
