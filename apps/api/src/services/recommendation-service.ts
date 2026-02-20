/**
 * recommendation-service.ts
 *
 * Implements the "My Election" (הבחירות שלי) party-recommendation scoring logic.
 *
 * GUARDRAILS (enforced in this file):
 * 1. ideological_preference is NEVER used for scoring — parties ranked by activity only.
 * 2. Only active parties are included in results.
 * 3. Every highlight bill must have ≥1 SourceLink (provenance required).
 *
 * Scoring flow:
 *   1. Resolve topic_ids → topic_keys via MY_ELECTION_TOPICS
 *   2. Load PartyTopicAgg rows from DB
 *   3. If empty → return null (triggers 503 "run etl:aggregate")
 *   4. Min-max normalize per topic across active parties
 *   5. For multi-key topics: average normalized scores
 *   6. personal_score = Σ(weight × ui_topic_score) / Σweights × 100
 *   7. Sort desc, top 3
 *   8. Confidence: ≥75% of topics have bill_count≥2 → high; 40–74% → medium; <40% → low
 *   9. Fetch highlights: up to 4 bills per party with highest points, must have sources
 */

import { db } from "@knesset-vote/db";
import {
  MY_ELECTION_TOPICS,
  FREE_TEXT_KEYWORD_MAP,
  BILL_STATUS_SCORE,
  type RecommendationRequest,
  type RecommendationResponse,
  type RecommendationResult,
  type TopicBreakdown,
  type HighlightBill,
  type FreeTextSuggestion,
} from "@knesset-vote/shared";

// ──────────────────────────────────────────────────────────────────
// Type helpers
// ──────────────────────────────────────────────────────────────────

type PartyRow = {
  id: string;
  name_he: string;
  name_en: string | null;
  abbreviation: string | null;
  seat_count: number | null;
};

type AggRow = {
  party_id: string;
  topic: string;
  raw_score: number;
  bill_count: number;
};

// ──────────────────────────────────────────────────────────────────
// Free-text keyword → topic suggestions
// ──────────────────────────────────────────────────────────────────

export function mapFreeText(text: string): FreeTextSuggestion[] {
  if (!text?.trim()) return [];

  const suggestions: FreeTextSuggestion[] = [];
  const seen = new Set<string>();

  for (const entry of FREE_TEXT_KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (text.includes(kw) && !seen.has(entry.topic_id)) {
        const topic = MY_ELECTION_TOPICS.find((t) => t.id === entry.topic_id);
        if (topic) {
          suggestions.push({
            matched_keyword: kw,
            suggested_topic_id: entry.topic_id,
            label_he: topic.label_he,
          });
          seen.add(entry.topic_id);
        }
        break; // one suggestion per topic_id per entry
      }
    }
  }

  return suggestions;
}

// ──────────────────────────────────────────────────────────────────
// Normalization helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Min-max normalize raw scores per topic across the provided party set.
 * Returns: Map<party_id, Map<topic, normalized_score (0–1)>>
 */
function normalizeScores(
  rows: AggRow[],
  partyIds: Set<string>,
  allTopicKeys: string[],
): Map<string, Map<string, number>> {
  // Group rows by topic, restricted to active parties + requested topics
  const byTopic = new Map<string, AggRow[]>();
  for (const row of rows) {
    if (!partyIds.has(row.party_id)) continue;
    if (!allTopicKeys.includes(row.topic)) continue;
    const arr = byTopic.get(row.topic) ?? [];
    arr.push(row);
    byTopic.set(row.topic, arr);
  }

  const result = new Map<string, Map<string, number>>();

  for (const [topic, topicRows] of byTopic) {
    const scores = topicRows.map((r) => Number(r.raw_score));
    const max = Math.max(...scores);
    const min = Math.min(...scores);

    for (const row of topicRows) {
      const partyMap = result.get(row.party_id) ?? new Map<string, number>();
      let norm: number;
      if (max === 0) {
        norm = 0;
      } else if (max === min) {
        norm = 1; // all parties equal non-zero activity
      } else {
        norm = (Number(row.raw_score) - min) / (max - min);
      }
      partyMap.set(topic, norm);
      result.set(row.party_id, partyMap);
    }
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────
// Personal score computation
// ──────────────────────────────────────────────────────────────────

function computePersonalScore(
  partyId: string,
  topicWeights: Array<{ id: string; weight: number }>,
  normalized: Map<string, Map<string, number>>,
  aggMap: Map<string, Map<string, AggRow>>, // party_id → topic → row
): { score: number; breakdown: TopicBreakdown[]; confidence: "high" | "medium" | "low" } {
  const partyNorm = normalized.get(partyId) ?? new Map<string, number>();

  let weightedSum = 0;
  let totalWeight = 0;
  let topicsWithData = 0;
  const breakdown: TopicBreakdown[] = [];

  // Filter out uiOnly topics (ideology)
  const scoringTopics = topicWeights.filter((tw) => {
    const def = MY_ELECTION_TOPICS.find((t) => t.id === tw.id);
    return def && !def.uiOnly && def.topic_keys.length > 0;
  });

  for (const tw of scoringTopics) {
    const def = MY_ELECTION_TOPICS.find((t) => t.id === tw.id)!;
    const topicKeys = [...def.topic_keys];

    // Average normalized scores across the topic's keys
    const keyScores = topicKeys.map((tk) => partyNorm.get(tk) ?? 0);
    const avgNorm = keyScores.reduce((a, b) => a + b, 0) / topicKeys.length;

    // Sum bill counts across topic keys
    const billCount = topicKeys.reduce((sum, tk) => {
      const row = aggMap.get(partyId)?.get(tk);
      return sum + (row?.bill_count ?? 0);
    }, 0);

    if (billCount >= 2) topicsWithData++;

    weightedSum += tw.weight * avgNorm;
    totalWeight += tw.weight;

    breakdown.push({
      ui_topic_id: tw.id,
      label_he: def.label_he,
      weight: tw.weight,
      normalized_score: avgNorm,
      bill_count: billCount,
    });
  }

  const score = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;

  const coverageRatio =
    scoringTopics.length > 0 ? topicsWithData / scoringTopics.length : 0;
  const confidence: "high" | "medium" | "low" =
    coverageRatio >= 0.75 ? "high" : coverageRatio >= 0.4 ? "medium" : "low";

  return { score, breakdown, confidence };
}

// ──────────────────────────────────────────────────────────────────
// Highlight fetching
// ──────────────────────────────────────────────────────────────────

async function getHighlights(
  partyId: string,
  topicKeys: string[],
  limit = 4,
): Promise<HighlightBill[]> {
  // Find MKs currently in this party
  const memberships = await db.partyMembership.findMany({
    where: { party_id: partyId, is_current: true },
    select: { mk_id: true },
  });
  const mkIds = memberships.map((m) => m.mk_id);
  if (mkIds.length === 0) return [];

  // Find bills initiated by party MKs in relevant topics, ordered by status score
  const billRoles = await db.mKBillRole.findMany({
    where: {
      mk_id: { in: mkIds },
      role: "initiator",
      bill: {
        topic: { in: topicKeys },
      },
    },
    include: {
      bill: {
        select: {
          id: true,
          title_he: true,
          status: true,
          topic: true,
        },
      },
    },
    orderBy: [{ bill: { status: "asc" } }], // will re-sort by points below
    take: 50,
  });

  // Sort by bill points descending
  const sorted = billRoles.sort(
    (a, b) =>
      (BILL_STATUS_SCORE[b.bill.status] ?? 0) -
      (BILL_STATUS_SCORE[a.bill.status] ?? 0),
  );

  // Fetch source links for each candidate bill, keep only those with ≥1 source (guardrail 3)
  const highlights: HighlightBill[] = [];
  const seenBillIds = new Set<string>();

  for (const br of sorted) {
    if (highlights.length >= limit) break;
    if (seenBillIds.has(br.bill.id)) continue;
    seenBillIds.add(br.bill.id);

    const sources = await db.sourceLink.findMany({
      where: { entity_type: "bill", entity_id: br.bill.id },
    });

    if (sources.length === 0) continue; // skip bills without provenance

    highlights.push({
      bill_id: br.bill.id,
      title_he: br.bill.title_he,
      status: br.bill.status,
      topic: br.bill.topic ?? "",
      role: br.role,
      sources: sources.map((sl) => ({
        label: sl.label,
        url: sl.url,
        external_source: sl.external_source,
        external_id: sl.external_id ?? undefined,
      })),
    });
  }

  return highlights;
}

// ──────────────────────────────────────────────────────────────────
// Main entry point
// ──────────────────────────────────────────────────────────────────

export async function getRecommendations(
  req: RecommendationRequest,
): Promise<RecommendationResponse | null> {
  // 1. Resolve topic_ids → topic_keys (skip uiOnly)
  const topicDefs = req.topics
    .map((tw) => ({
      tw,
      def: MY_ELECTION_TOPICS.find((t) => t.id === tw.id),
    }))
    .filter(({ def }) => def && !def.uiOnly && def.topic_keys.length > 0);

  const allTopicKeys = [
    ...new Set(topicDefs.flatMap(({ def }) => [...def!.topic_keys])),
  ];

  if (allTopicKeys.length === 0) {
    // All selected topics are uiOnly — nothing to score
    return null;
  }

  // 2. Load PartyTopicAgg rows for relevant topics
  const aggRows = await db.partyTopicAgg.findMany({
    where: { topic: { in: allTopicKeys } },
  });

  if (aggRows.length === 0) {
    // Table is empty — aggregate hasn't been run yet
    return null;
  }

  // 3. Load active parties
  const parties = await db.party.findMany({
    where: { is_active: true },
    select: { id: true, name_he: true, name_en: true, abbreviation: true, seat_count: true },
  });

  const partyIds = new Set(parties.map((p) => p.id));

  // 4. Build aggMap: party_id → topic → row (for bill_count lookup)
  const aggMap = new Map<string, Map<string, AggRow>>();
  for (const row of aggRows) {
    if (!partyIds.has(row.party_id)) continue;
    const partyMap = aggMap.get(row.party_id) ?? new Map<string, AggRow>();
    partyMap.set(row.topic, {
      party_id: row.party_id,
      topic: row.topic,
      raw_score: Number(row.raw_score),
      bill_count: row.bill_count,
    });
    aggMap.set(row.party_id, partyMap);
  }

  // 5. Normalize scores per topic
  const normalized = normalizeScores(
    aggRows.map((r) => ({
      party_id: r.party_id,
      topic: r.topic,
      raw_score: Number(r.raw_score),
      bill_count: r.bill_count,
    })),
    partyIds,
    allTopicKeys,
  );

  // 6. Compute personal scores for each active party
  const scored: Array<{
    party: PartyRow;
    score: number;
    breakdown: TopicBreakdown[];
    confidence: "high" | "medium" | "low";
  }> = parties.map((party) => {
    const { score, breakdown, confidence } = computePersonalScore(
      party.id,
      req.topics.map((tw) => ({ id: tw.id, weight: tw.weight })),
      normalized,
      aggMap,
    );
    return { party, score, breakdown, confidence };
  });

  // 7. Sort descending, take top 3
  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);

  // 8. Fetch highlights for each top-3 party
  const results: RecommendationResult[] = await Promise.all(
    top3.map(async ({ party, score, breakdown, confidence }, idx) => {
      // Get source links for the party itself
      const partySources = await db.sourceLink.findMany({
        where: { entity_type: "party", entity_id: party.id },
      });

      const highlights = await getHighlights(party.id, allTopicKeys, 4);

      return {
        rank: idx + 1,
        party: {
          id: party.id,
          name_he: party.name_he,
          name_en: party.name_en ?? null,
          abbreviation: party.abbreviation ?? null,
          seat_count: party.seat_count ?? null,
          sources: partySources.map((sl) => ({
            label: sl.label,
            url: sl.url,
            external_source: sl.external_source,
            external_id: sl.external_id ?? undefined,
          })),
        },
        personal_score: Math.round(score * 10) / 10,
        confidence,
        topic_breakdown: breakdown,
        highlights,
      };
    }),
  );

  // 9. Optional free-text suggestions
  const freeTextSuggestions =
    req.free_text ? mapFreeText(req.free_text) : undefined;

  // 10. Get data_as_of from last ETL run
  const lastSync = await db.eTLRun.findFirst({
    where: { status: "completed" },
    orderBy: { completed_at: "desc" },
    select: { completed_at: true },
  });

  const webBaseUrl = process.env["WEB_BASE_URL"] ?? "http://localhost:3000";

  return {
    results,
    free_text_suggestions: freeTextSuggestions,
    meta: {
      parties_evaluated: parties.length,
      topics_requested: req.topics.length,
      data_as_of: lastSync?.completed_at?.toISOString() ?? null,
      methodology_url: `${webBaseUrl}/methodology#my-election-scoring`,
      warning:
        "Scores reflect legislative bill activity only. They do not represent political endorsements or ideological alignment. Data may be incomplete.",
    },
  };
}
