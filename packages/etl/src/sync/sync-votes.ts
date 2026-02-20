/**
 * Syncs votes from the Knesset OData v4 ParliamentInfo endpoint.
 *
 * Uses the NEW v4 API (NOT the deprecated votes.svc):
 * https://knesset.gov.il/OdataV4/ParliamentInfo
 *
 * Pipeline:
 * 1. Fetch all KNS_PlenumVote headers → upsert Vote rows
 * 2. Fetch all KNS_PlenumVoteResult rows → upsert VoteRecord rows
 *
 * MK resolution: KNS_PlenumVoteResult.MkId IS the PersonID directly
 * (no zero-padding or conversion needed)
 */

import pLimit from "p-limit";
import { db } from "@knesset-vote/db";
import { ETL_CONCURRENCY } from "@knesset-vote/shared";
import {
  VOTES_V4_BASE,
  VOTE_HEADER_ENTITY,
  VOTE_RECORD_ENTITY,
  mapVoteHeaderToVote,
  mapVoteResult,
  type RawVoteHeader,
  type RawVoteRecord,
} from "../mappers/vote-mapper.js";
import type { ETLRunTracker } from "./run-tracker.js";
import { logger } from "../logger.js";
import { safeFetch } from "../client/ssrf-guard.js";

const PAGE_SIZE = 100;

async function fetchVotesPage<T>(entity: string, skip: number): Promise<T[]> {
  const url = `${VOTES_V4_BASE}/${entity}?$top=${PAGE_SIZE}&$skip=${skip}&$format=json`;
  const res = await safeFetch(url);
  if (!res.ok) {
    throw new Error(`Votes OData v4 fetch failed: ${res.status} ${res.statusText} — ${url}`);
  }
  const data = (await res.json()) as { value?: T[] };
  return data.value ?? [];
}

async function* fetchAllVotePages<T>(entity: string): AsyncGenerator<T[]> {
  let skip = 0;
  while (true) {
    const page = await fetchVotesPage<T>(entity, skip);
    if (page.length === 0) break;
    yield page;
    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
}

export async function syncVotes(
  tracker: ETLRunTracker,
  mkIdMap: Map<string, string>,
): Promise<void> {
  logger.info("Syncing votes from OData v4 ParliamentInfo (KNS_PlenumVote)");
  tracker.initEntity("vote");
  tracker.initEntity("vote_record");

  // MkId in KNS_PlenumVoteResult is directly the PersonID = MK.external_id
  // No conversion needed — just String(MkId) → mkIdMap lookup
  logger.info({ mkIdMapSize: mkIdMap.size }, "Using mkIdMap to resolve vote MK records");

  const voteIdMap = new Map<number, string>(); // KNS_PlenumVote.Id → db Vote.id
  const limit = pLimit(ETL_CONCURRENCY);

  // Step 1: Sync vote headers (KNS_PlenumVote)
  logger.info("Syncing vote headers from KNS_PlenumVote");
  for await (const page of fetchAllVotePages<RawVoteHeader>(VOTE_HEADER_ENTITY)) {
    await Promise.all(
      page.map((raw) =>
        limit(async () => {
          tracker.increment("vote", "fetched");
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
            tracker.increment("vote", "created");
          } catch (err) {
            tracker.increment("vote", "failed");
            logger.error({ raw, err }, "Failed to sync vote header");
          }
        }),
      ),
    );
  }

  logger.info({ votes: voteIdMap.size }, "Vote headers synced");

  // Step 2: Sync individual MK vote records (KNS_PlenumVoteResult)
  logger.info("Syncing MK vote records from KNS_PlenumVoteResult");
  for await (const page of fetchAllVotePages<RawVoteRecord>(VOTE_RECORD_ENTITY)) {
    await Promise.all(
      page.map((raw) =>
        limit(async () => {
          tracker.increment("vote_record", "fetched");
          try {
            const voteId = raw.VoteID;
            if (!voteId) return;

            const voteDbId = voteIdMap.get(voteId);
            if (!voteDbId) return; // vote not in our DB

            // MkId IS the PersonID directly (no zero-padding needed)
            if (!raw.MkId) return;
            const mkDbId = mkIdMap.get(String(raw.MkId));
            if (!mkDbId) return; // MK not in our DB

            const position = mapVoteResult(raw.ResultCode);

            await db.voteRecord.upsert({
              where: {
                vote_id_mk_id: {
                  vote_id: voteDbId,
                  mk_id: mkDbId,
                },
              },
              create: {
                vote_id: voteDbId,
                mk_id: mkDbId,
                external_source: "knesset_v4",
                position,
              },
              update: {
                position,
              },
            });

            tracker.increment("vote_record", "created");
          } catch (err) {
            tracker.increment("vote_record", "failed");
            logger.error({ raw, err }, "Failed to sync vote record");
          }
        }),
      ),
    );
  }

  const summary = tracker.getSummary();
  logger.info(
    {
      votes: summary.counts["vote"],
      vote_records: summary.counts["vote_record"],
    },
    "Votes sync complete",
  );
}
