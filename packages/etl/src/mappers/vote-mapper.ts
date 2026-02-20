/**
 * Knesset OData v4 ParliamentInfo → Prisma Vote mapper
 *
 * Uses the main OData v4 endpoint (NOT the deprecated votes.svc):
 * https://knesset.gov.il/OdataV4/ParliamentInfo
 *
 * Entity sets:
 * - KNS_PlenumVote: vote headers (34,968 votes as of 2025)
 * - KNS_PlenumVoteResult: individual MK vote records (1.85M rows)
 *
 * Key mapping:
 * KNS_PlenumVoteResult.MkId is directly the PersonID = MK.external_id
 *
 * ResultCode values (v4):
 * 6 = נוכח (present, did not vote)
 * 7 = בעד (yes / for)
 * 8 = נגד (no / against)
 * 9 = נמנע (abstain)
 * 10 = לא נכח / אינו נוכח (absent)
 * 11 = הצביע (voted — manual/show-of-hands vote, counted as yes)
 */

import type { Prisma } from "@knesset-vote/db";

export const VOTES_V4_BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";

export const VOTE_HEADER_ENTITY = "KNS_PlenumVote";
export const VOTE_RECORD_ENTITY = "KNS_PlenumVoteResult";

export interface RawVoteHeader {
  Id?: number;
  VoteDateTime?: string | null;
  SessionID?: number | null;
  ItemID?: number | null;
  Ordinal?: number | null;
  VoteMethodID?: number | null;
  VoteMethodDesc?: string | null;
  VoteStatusCode?: number | null;
  VoteStatusDesc?: string | null;
  VoteTitle?: string | null;
  VoteSubject?: string | null;
  IsNoConfidenceInGov?: boolean | null;
  LastUpdatedDate?: string | null;
  ForOptionID?: number | null;
  ForOptionDesc?: string | null;
  AgainstOptionID?: number | null;
  AgainstOptionDesc?: string | null;
  [key: string]: unknown;
}

export interface RawVoteRecord {
  Id?: number;
  MkId?: number;
  VoteID?: number;
  VoteDate?: string | null;
  ResultCode?: number;
  ResultDesc?: string | null;
  LastUpdatedDate?: string | null;
  LastName?: string | null;
  FirstName?: string | null;
  SessionID?: number | null;
  ItemID?: number | null;
  [key: string]: unknown;
}

/**
 * Map v4 ResultCode to our position enum.
 * 7 = yes, 8 = no, 9 = abstain, 6/10/11 = did_not_vote
 */
export function mapVoteResult(resultCode?: number): string {
  switch (resultCode) {
    case 7: return "yes";     // בעד
    case 8: return "no";      // נגד
    case 9: return "abstain"; // נמנע
    case 11: return "yes";    // הצביע (manual show-of-hands, counted as for)
    default: return "did_not_vote"; // 6=נוכח, 10=לא נכח, unknown
  }
}

/**
 * We need to determine if a vote passed or failed.
 * KNS_PlenumVote doesn't have a direct is_accepted field.
 * The actual outcome (passed/rejected) is determined by whether yes_count > no_count.
 * When we have counts, use them. Otherwise fall back to ForOptionDesc text patterns.
 *
 * Real ForOptionDesc values seen in v4 API (2024-2026):
 *   passed-type: "להעביר לוועדה", "להעביר את הצעת החוק לוועדה", "לאשר",
 *                "לאשר את הצעת החוק", "לאשר בקריאה שניה ושלישית",
 *                "לכלול בסדר-היום", "לכלול את הנושא"
 *   rejected-type: "לדחות את ההצעה", "לדחות"
 *   unknown: when ForOptionDesc === AgainstOptionDesc or either is null
 */
export function deriveVoteResult(
  raw: RawVoteHeader,
  yesCount?: number | null,
  noCount?: number | null,
): string {
  // Best signal: actual vote counts
  if (yesCount != null && noCount != null) {
    if (yesCount > noCount) return "passed";
    if (noCount > yesCount) return "rejected";
    return "unknown"; // tie
  }

  const forDesc = raw.ForOptionDesc ?? "";
  const againstDesc = raw.AgainstOptionDesc ?? "";

  // No meaningful description
  if (!forDesc && !againstDesc) return "unknown";
  if (forDesc === againstDesc) return "unknown";

  // The "for" option being a constructive action = the bill/motion passed if yes won
  // We mark it as "passed" — outcome by yes/no counts is more reliable but not available here
  const passedPatterns = [
    "להעביר", "לאשר", "לכלול", "לאמץ", "להעלות",
    "בעד", "אושר", "עבר",
  ];
  const rejectedPatterns = ["לדחות", "נגד", "נדחה"];

  const forLower = forDesc.toLowerCase();
  if (passedPatterns.some((p) => forLower.includes(p))) return "passed";
  if (rejectedPatterns.some((p) => forLower.includes(p))) return "rejected";
  return "unknown";
}

export function mapVoteHeaderToVote(
  raw: RawVoteHeader,
  counts?: { yes: number; no: number; abstain: number },
): Prisma.VoteCreateInput {
  const id = raw.Id;
  if (!id) {
    throw new Error(`PlenumVote missing Id: ${JSON.stringify(raw)}`);
  }

  const title = raw.VoteTitle ?? raw.VoteSubject ?? "Unknown";

  return {
    external_id: String(id),
    external_source: "knesset_v4",
    title_he: String(title),
    title_en: null,
    vote_date: raw.VoteDateTime ? new Date(raw.VoteDateTime) : null,
    knesset_number: null,
    yes_count: counts?.yes ?? null,
    no_count: counts?.no ?? null,
    abstain_count: counts?.abstain ?? null,
    result: deriveVoteResult(raw, counts?.yes, counts?.no),
    topic: null,
    source_url: `${VOTES_V4_BASE}/KNS_PlenumVote?$filter=Id eq ${id}`,
    last_seen_at: new Date(),
  };
}
