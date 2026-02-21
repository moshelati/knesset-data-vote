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
  mapVoteHeaderToVote,
  type RawVoteHeader,
} from "../mappers/vote-mapper.js";
import type { ETLRunTracker } from "./run-tracker.js";
import { logger } from "../logger.js";
import { safeFetch } from "../client/ssrf-guard.js";

interface ODataPage<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

async function fetchVotesNextLink<T>(url: string): Promise<ODataPage<T>> {
  const res = await safeFetch(url);
  if (!res.ok) {
    throw new Error(`Votes OData v4 fetch failed: ${res.status} ${res.statusText} — ${url}`);
  }
  return res.json() as Promise<ODataPage<T>>;
}

async function* fetchAllVotePages<T>(entity: string): AsyncGenerator<T[], void, unknown> {
  let nextUrl: string | undefined = `${VOTES_V4_BASE}/${entity}`;
  while (nextUrl !== undefined) {
    const currentUrl: string = nextUrl;
    const page = await fetchVotesNextLink<T>(currentUrl);
    if (!page.value || page.value.length === 0) break;
    yield page.value;
    nextUrl = page["@odata.nextLink"];
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
                  external_id: data.external_id!,
                  external_source: data.external_source!,
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

  // Step 2: VoteRecords (KNS_PlenumVoteResult) — 1.85M rows, skipped in nightly cron.
  // Too large for a single deployment run (~2h at 20s/page from Railway).
  // TODO: run as a separate backfill job with resumable pagination checkpointing.
  logger.info("Skipping VoteRecord sync (1.85M rows — use dedicated backfill job for this)");
  tracker.initEntity("vote_record"); // ensure the entity exists in the summary

  const summary = tracker.getSummary();
  logger.info(
    {
      votes: summary.counts["vote"],
      vote_records: summary.counts["vote_record"],
    },
    "Votes sync complete",
  );
}
