import { db } from "@knesset-vote/db";
import type { Vote, VoteRecord } from "@knesset-vote/shared";

export async function listVotes(opts: {
  mk_id?: string;
  bill_id?: string;
  knesset_number?: number;
  result?: string;
  page: number;
  limit: number;
}): Promise<{ data: Vote[]; total: number }> {
  const { mk_id, bill_id, knesset_number, result, page, limit } = opts;
  const skip = (page - 1) * limit;

  const where: Parameters<typeof db.vote.findMany>[0]["where"] = {};

  if (bill_id) {
    where.OR = [{ bill_id }, { bill: { external_id: bill_id } }];
  }
  if (knesset_number) {
    where.knesset_number = knesset_number;
  }
  if (result) {
    where.result = result;
  }
  if (mk_id) {
    where.records = {
      some: {
        mk: { OR: [{ id: mk_id }, { external_id: mk_id }] },
      },
    };
  }

  const [votes, total] = await Promise.all([
    db.vote.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ vote_date: "desc" }],
    }),
    db.vote.count({ where }),
  ]);

  return {
    total,
    data: votes.map((v) => ({
      id: v.id,
      external_id: v.external_id,
      external_source: v.external_source,
      title_he: v.title_he,
      title_en: v.title_en,
      vote_date: v.vote_date?.toISOString() ?? null,
      knesset_number: v.knesset_number,
      bill_id: v.bill_id,
      topic: v.topic,
      yes_count: v.yes_count,
      no_count: v.no_count,
      abstain_count: v.abstain_count,
      result: (v.result as "passed" | "rejected" | "unknown" | null) ?? null,
      source_url: v.source_url,
      sources: [],
    })),
  };
}

export async function getVoteById(id: string): Promise<{
  vote: Vote;
  records: VoteRecord[];
} | null> {
  const vote = await db.vote.findFirst({
    where: {
      OR: [{ id }, { external_id: id }],
    },
    include: {
      records: {
        include: {
          mk: { select: { id: true, name_he: true } },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!vote) return null;

  return {
    vote: {
      id: vote.id,
      external_id: vote.external_id,
      external_source: vote.external_source,
      title_he: vote.title_he,
      title_en: vote.title_en,
      vote_date: vote.vote_date?.toISOString() ?? null,
      knesset_number: vote.knesset_number,
      bill_id: vote.bill_id,
      topic: vote.topic,
      yes_count: vote.yes_count,
      no_count: vote.no_count,
      abstain_count: vote.abstain_count,
      result: (vote.result as "passed" | "rejected" | "unknown" | null) ?? null,
      source_url: vote.source_url,
      sources: [],
    },
    records: vote.records.map((r) => ({
      id: r.id,
      vote_id: r.vote_id,
      mk_id: r.mk_id,
      mk_name_he: r.mk?.name_he ?? "Unknown",
      position: r.position as "yes" | "no" | "abstain" | "absent" | "did_not_vote",
      sources: [],
    })),
  };
}
