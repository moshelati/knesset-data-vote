import { db } from "@knesset-vote/db";
import type { MK, MKDetail, MKSpecialRole } from "@knesset-vote/shared";
import { BILL_TOPIC_LABELS_HE } from "@knesset-vote/shared";

// כנסת 25 — קואליציה/אופוזיציה לפי external_id של הסיעה
const KNESSET_25_COALITION = new Set(["1096", "1105", "1102", "1104", "1108", "1106", "1107"]);
const KNESSET_25_OPPOSITION = new Set([
  "1097",
  "1099",
  "1101",
  "1100",
  "1103",
  "1109",
  "1110",
  "1098",
]);

function getMKCoalitionStatus(
  partyExternalId: string | null,
  knessetNumber: number | null,
): "coalition" | "opposition" | null {
  if (knessetNumber !== 25 || !partyExternalId) return null;
  if (KNESSET_25_COALITION.has(partyExternalId)) return "coalition";
  if (KNESSET_25_OPPOSITION.has(partyExternalId)) return "opposition";
  return null;
}

const SPECIAL_POSITION_LABELS: Record<number, string> = {
  39: "שר",
  57: "שרה",
  40: "סגן שר",
  59: "סגנית שר",
  45: "ראש הממשלה",
  51: 'מ"מ ראש הממשלה',
  50: "סגן ראש הממשלה",
  41: 'יו"ר ועדה',
  61: 'יו"ר ועדה',
  30: "יושב-ראש הקואליציה",
  29: "יושבת-ראש הקואליציה",
};
const SPECIAL_POSITION_IDS = Object.keys(SPECIAL_POSITION_LABELS).join(",");

async function fetchSpecialRoles(externalId: string): Promise<MKSpecialRole[]> {
  const base =
    process.env["KNESSET_ODATA_BASE_URL"] ?? "https://knesset.gov.il/OdataV4/ParliamentInfo";
  const url = `${base}/KNS_PersonToPosition?$filter=PersonID eq ${externalId} and PositionID in (${SPECIAL_POSITION_IDS})&$orderby=IsCurrent desc,KnessetNum desc&$top=200`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      value?: {
        PositionID: number;
        KnessetNum: number | null;
        StartDate: string | null;
        FinishDate: string | null;
        IsCurrent: boolean;
      }[];
    };
    const rows = json.value ?? [];
    const now = new Date();
    // Deduplicate: keep first occurrence per PositionID (ordered current-first from OData)
    const seen = new Set<number>();
    const mapped: MKSpecialRole[] = [];
    for (const row of rows) {
      if (seen.has(row.PositionID)) continue;
      seen.add(row.PositionID);
      const endDate = row.FinishDate ? new Date(row.FinishDate) : null;
      const isCurrent = row.IsCurrent ?? (endDate === null || endDate > now);
      mapped.push({
        position_id: row.PositionID,
        position_label_he: SPECIAL_POSITION_LABELS[row.PositionID] ?? String(row.PositionID),
        knesset_number: row.KnessetNum ?? null,
        start_date: row.StartDate ?? null,
        end_date: row.FinishDate ?? null,
        is_current: isCurrent,
      });
    }
    return mapped;
  } catch {
    return [];
  }
}

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

export async function listMKs(opts: {
  search?: string;
  party_id?: string;
  is_current?: boolean;
  knesset_number?: number;
  sort?: string;
  page: number;
  limit: number;
}): Promise<{ data: MK[]; total: number }> {
  const { search, party_id, is_current, knesset_number, page, limit } = opts;
  const skip = (page - 1) * limit;

  const where: NonNullable<Parameters<typeof db.mK.findMany>[0]>["where"] = {};

  if (search) {
    where.OR = [
      { name_he: { contains: search } },
      { name_en: { contains: search, mode: "insensitive" } },
      { name_last_he: { contains: search } },
      { name_first_he: { contains: search } },
    ];
  }

  if (is_current !== undefined) {
    where.is_current = is_current;
  }

  if (knesset_number) {
    where.memberships = {
      some: { knesset_number },
    };
  }

  if (party_id) {
    where.memberships = {
      some: {
        is_current: true,
        party: {
          OR: [{ id: party_id }, { external_id: party_id }],
        },
      },
    };
  }

  const [mks, total] = await Promise.all([
    db.mK.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ name_last_he: "asc" }, { name_he: "asc" }],
      include: {
        memberships: {
          where: { is_current: true },
          include: {
            party: {
              select: {
                id: true,
                name_he: true,
                name_en: true,
                external_id: true,
                knesset_number: true,
              },
            },
          },
          take: 1,
        },
      },
    }),
    db.mK.count({ where }),
  ]);

  const mksWithSources = await Promise.all(
    mks.map(async (mk) => ({
      ...mk,
      sources: mapSourceLinks(await getSourceLinks("mk", mk.id)),
    })),
  );

  return {
    data: mksWithSources.map((mk) => {
      const currentMembership = mk.memberships[0];
      return {
        id: mk.id,
        external_id: mk.external_id,
        external_source: mk.external_source,
        name_he: mk.name_he,
        name_en: mk.name_en,
        name_first_he: mk.name_first_he,
        name_last_he: mk.name_last_he,
        gender: mk.gender as "male" | "female" | "other" | "unknown",
        is_current: mk.is_current,
        current_party_id: currentMembership?.party.id ?? null,
        current_party_name: currentMembership?.party.name_he ?? null,
        coalition_status: getMKCoalitionStatus(
          currentMembership?.party.external_id ?? null,
          currentMembership?.party.knesset_number ?? null,
        ),
        source_url: mk.source_url,
        image_url: mk.image_url,
        last_seen_at: mk.last_seen_at?.toISOString() ?? null,
        last_changed_at: mk.last_changed_at?.toISOString() ?? null,
        sources: mk.sources,
      };
    }),
    total,
  };
}

export async function getMKById(id: string): Promise<MKDetail | null> {
  const mk = await db.mK.findFirst({
    where: {
      OR: [{ id }, { external_id: id }],
    },
    include: {
      memberships: {
        orderBy: { start_date: "desc" },
        include: {
          party: { select: { id: true, name_he: true, name_en: true } },
        },
      },
      bill_roles: {
        take: 20,
        orderBy: { bill: { submitted_date: "desc" } },
        include: {
          bill: {
            select: {
              id: true,
              title_he: true,
              title_en: true,
              status: true,
              submitted_date: true,
              source_url: true,
            },
          },
        },
      },
      committee_memberships: {
        orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
        include: {
          committee: { select: { id: true, name_he: true, knesset_number: true } },
        },
      },
    },
  });

  if (!mk) return null;

  const currentMembership = mk.memberships.find((m) => m.is_current);

  const [
    mkSources,
    membershipSources,
    billsInitiated,
    billsCosponsored,
    billsPassed,
    voteCount,
    topicRows,
    specialRoles,
  ] = await Promise.all([
    getSourceLinks("mk", mk.id),
    // Fetch source links for all memberships in parallel
    Promise.all(mk.memberships.map((m) => getSourceLinks("mk_membership", m.id))),
    db.mKBillRole.count({ where: { mk_id: mk.id, role: "initiator" } }),
    db.mKBillRole.count({ where: { mk_id: mk.id, role: "cosponsor" } }),
    db.mKBillRole.count({
      where: { mk_id: mk.id, role: "initiator", bill: { status: "passed" } },
    }),
    db.voteRecord.count({ where: { mk_id: mk.id } }),
    db.$queryRaw<{ topic: string; bill_count: bigint; bills_passed: bigint }[]>`
        SELECT
          b.topic,
          COUNT(DISTINCT b.id)::int    AS bill_count,
          SUM(CASE WHEN b.status = 'passed' THEN 1 ELSE 0 END)::int AS bills_passed
        FROM "MKBillRole" mbr
        JOIN "Bill" b ON b.id = mbr.bill_id
        WHERE mbr.mk_id = ${mk.id}
          AND b.topic IS NOT NULL
          AND b.topic != 'other'
        GROUP BY b.topic
        ORDER BY bill_count DESC
        LIMIT 10
      `,
    fetchSpecialRoles(mk.external_id),
  ]);

  const lastSyncAt = await db.eTLRun.findFirst({
    where: { status: "completed" },
    orderBy: { completed_at: "desc" },
    select: { completed_at: true },
  });

  // Compute profile fields
  const knessetTerms = [
    ...new Set(mk.memberships.map((m) => m.knesset_number).filter((n): n is number => n !== null)),
  ].sort((a, b) => a - b);

  const firstElected = mk.memberships.reduce<Date | null>((min, m) => {
    if (!m.start_date) return min;
    return min === null || m.start_date < min ? m.start_date : min;
  }, null);

  const genderLabelMap: Record<string, string> = {
    male: "זכר",
    female: "נקבה",
    other: "אחר",
    unknown: "לא ידוע",
  };
  const genderKey = (mk.gender ?? "unknown") as "male" | "female" | "other" | "unknown";

  // Map topic breakdown rows
  const topicBreakdown = topicRows.map((row) => ({
    topic: row.topic,
    label_he: BILL_TOPIC_LABELS_HE[row.topic] ?? row.topic,
    bill_count: Number(row.bill_count),
    bills_passed: Number(row.bills_passed),
  }));

  return {
    id: mk.id,
    external_id: mk.external_id,
    external_source: mk.external_source,
    name_he: mk.name_he,
    name_en: mk.name_en,
    name_first_he: mk.name_first_he,
    name_last_he: mk.name_last_he,
    gender: mk.gender as "male" | "female" | "other" | "unknown",
    is_current: mk.is_current,
    current_party_id: currentMembership?.party.id ?? null,
    current_party_name: currentMembership?.party.name_he ?? null,
    source_url: mk.source_url,
    image_url: mk.image_url,
    last_seen_at: mk.last_seen_at?.toISOString() ?? null,
    last_changed_at: mk.last_changed_at?.toISOString() ?? null,
    memberships: mk.memberships.map((m, i) => ({
      id: m.id,
      party_id: m.party.id,
      party_name_he: m.party.name_he,
      party_name_en: m.party.name_en ?? null,
      start_date: m.start_date?.toISOString() ?? null,
      end_date: m.end_date?.toISOString() ?? null,
      is_current: m.is_current,
      knesset_number: m.knesset_number,
      sources: mapSourceLinks(membershipSources[i] ?? []),
    })),
    activity_metrics: {
      bills_initiated: billsInitiated,
      bills_cosponsored: billsCosponsored,
      bills_passed: billsPassed,
      committee_memberships: mk.committee_memberships.length,
      votes_participated: voteCount,
      data_as_of: lastSyncAt?.completed_at?.toISOString() ?? null,
      confidence: billsInitiated > 0 ? "high" : "low",
      notes: mk.is_demo
        ? ["This is demo data. Not from official sources."]
        : billsInitiated === 0
          ? ["No bills found from source as of last sync."]
          : [],
    },
    recent_bills: mk.bill_roles.slice(0, 10).map((br) => ({
      id: br.bill.id,
      title_he: br.bill.title_he,
      title_en: br.bill.title_en ?? null,
      status: br.bill.status,
      submitted_date: br.bill.submitted_date?.toISOString() ?? null,
      role: br.role,
      source_url: br.bill.source_url,
    })),
    sources: mapSourceLinks(mkSources),
    topic_breakdown: topicBreakdown,
    committee_list: mk.committee_memberships.map((cm) => ({
      committee_id: cm.committee.id,
      name_he: cm.committee.name_he,
      role: cm.role ?? null,
      knesset_number: cm.committee.knesset_number ?? null,
      is_current: cm.is_current,
      start_date: cm.start_date?.toISOString() ?? null,
      end_date: cm.end_date?.toISOString() ?? null,
    })),
    profile: {
      gender: genderKey,
      gender_label_he: genderLabelMap[genderKey] ?? "",
      knesset_terms: knessetTerms,
      first_elected: firstElected?.toISOString() ?? null,
    },
    special_roles: specialRoles,
  };
}
