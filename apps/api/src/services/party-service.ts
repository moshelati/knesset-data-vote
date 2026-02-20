import { db } from "@knesset-vote/db";
import type { Party, PartyDetail } from "@knesset-vote/shared";

async function getSourceLinks(entityType: string, entityId: string) {
  return db.sourceLink.findMany({
    where: { entity_type: entityType, entity_id: entityId },
  });
}

function mapSourceLinks(links: Awaited<ReturnType<typeof getSourceLinks>>) {
  return links.map((sl) => ({
    label: sl.label,
    url: sl.url,
    external_source: sl.external_source,
    external_id: sl.external_id ?? undefined,
  }));
}

export async function listParties(opts: {
  search?: string;
  page: number;
  limit: number;
}): Promise<{ data: Party[]; total: number }> {
  const { search, page, limit } = opts;
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { name_he: { contains: search } },
          { name_en: { contains: search, mode: "insensitive" as const } },
          { abbreviation: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [parties, total] = await Promise.all([
    db.party.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ is_active: "desc" }, { seat_count: "desc" }, { name_he: "asc" }],
    }),
    db.party.count({ where }),
  ]);

  const partiesWithSources = await Promise.all(
    parties.map(async (p) => ({
      ...p,
      sources: mapSourceLinks(await getSourceLinks("party", p.id)),
    })),
  );

  return {
    data: partiesWithSources.map((p) => ({
      id: p.id,
      external_id: p.external_id,
      external_source: p.external_source,
      name_he: p.name_he,
      name_en: p.name_en,
      abbreviation: p.abbreviation,
      knesset_number: p.knesset_number,
      seat_count: p.seat_count,
      is_active: p.is_active,
      source_url: p.source_url,
      is_demo: p.is_demo,
      last_seen_at: p.last_seen_at?.toISOString() ?? null,
      last_changed_at: p.last_changed_at?.toISOString() ?? null,
      sources: p.sources,
    })),
    total,
  };
}

export async function getPartyById(id: string): Promise<PartyDetail | null> {
  const party = await db.party.findFirst({
    where: {
      OR: [{ id }, { external_id: id }],
    },
    include: {
      memberships: {
        where: { is_current: true },
        include: { mk: true },
      },
      promises: { take: 5, orderBy: { created_at: "desc" } },
    },
  });

  if (!party) return null;

  const sources = mapSourceLinks(await getSourceLinks("party", party.id));

  // Count bills for this party's MKs
  const currentMkIds = party.memberships.map((m) => m.mk.id);
  const [billsInitiated, billsPassed] = await Promise.all([
    db.mKBillRole.count({
      where: { mk_id: { in: currentMkIds }, role: "initiator" },
    }),
    db.mKBillRole.count({
      where: {
        mk_id: { in: currentMkIds },
        role: "initiator",
        bill: { status: "passed" },
      },
    }),
  ]);

  const committeeMeetings = await db.committeeMembership.count({
    where: { mk_id: { in: currentMkIds }, is_current: true },
  });

  return {
    id: party.id,
    external_id: party.external_id,
    external_source: party.external_source,
    name_he: party.name_he,
    name_en: party.name_en,
    abbreviation: party.abbreviation,
    knesset_number: party.knesset_number,
    seat_count: party.seat_count,
    is_active: party.is_active,
    source_url: party.source_url,
    last_seen_at: party.last_seen_at?.toISOString() ?? null,
    last_changed_at: party.last_changed_at?.toISOString() ?? null,
    mk_count: party.memberships.length,
    bill_count: billsInitiated,
    activity_summary: {
      bills_initiated: billsInitiated,
      bills_passed: billsPassed,
      committee_meetings: committeeMeetings,
    },
    sources,
  };
}
