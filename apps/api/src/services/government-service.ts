/**
 * Government service — queries DB for ministers and their roles.
 *
 * Data source: GovernmentRole table (synced from KNS_PersonToPosition via ETL).
 * Ministry→topic mapping: ministry-map.json (manual config).
 */

import { db } from "@knesset-vote/db";
import type {
  GovernmentMinister,
  GovernmentMinisterDetail,
  GovernmentRole,
  GovernmentRelatedBill,
  MKCommitteeListItem,
  SourceLink,
} from "@knesset-vote/shared";
import { MINISTRY_TOPIC_MAP } from "@knesset-vote/shared";

const MINISTRY_MAP = MINISTRY_TOPIC_MAP;

/** Get topic key for a given GovMinistryID */
function getMinistryTopic(govMinistryId: number | null): string | null {
  if (!govMinistryId) return null;
  return MINISTRY_MAP[String(govMinistryId)]?.topic ?? null;
}

/** Fetch related bills for a given topic (ministry-scoped) */
async function fetchRelatedBills(
  topic: string | null,
  limit: number,
): Promise<GovernmentRelatedBill[]> {
  if (!topic) return [];
  const bills = await db.bill.findMany({
    where: { topic, is_demo: false },
    orderBy: [{ last_status_date: "desc" }, { submitted_date: "desc" }],
    take: limit,
    select: {
      id: true,
      title_he: true,
      status: true,
      topic: true,
      submitted_date: true,
      source_url: true,
    },
  });

  return bills.map((b) => ({
    id: b.id,
    title_he: b.title_he,
    status: b.status,
    topic: b.topic,
    submitted_date: b.submitted_date?.toISOString() ?? null,
    source_url: b.source_url,
  }));
}

/** Fetch source links for a GovernmentRole */
async function fetchRoleSources(roleId: string): Promise<SourceLink[]> {
  const links = await db.sourceLink.findMany({
    where: { entity_type: "government_role", entity_id: roleId },
  });
  return links.map((l) => ({
    label: l.label,
    url: l.url,
    external_source: l.external_source,
    external_id: l.external_id ?? undefined,
  }));
}

/** Map a Prisma GovernmentRole record to the shared GovernmentRole type */
function mapRole(r: {
  id: string;
  mk_id: string;
  position_id: number;
  position_label: string;
  gov_ministry_id: number | null;
  ministry_name: string | null;
  duty_desc: string | null;
  government_num: number | null;
  knesset_num: number | null;
  start_date: Date | null;
  end_date: Date | null;
  is_current: boolean;
  source_url: string | null;
}): GovernmentRole {
  return {
    id: r.id,
    mk_id: r.mk_id,
    position_id: r.position_id,
    position_label: r.position_label,
    gov_ministry_id: r.gov_ministry_id,
    ministry_name: r.ministry_name,
    duty_desc: r.duty_desc,
    government_num: r.government_num,
    knesset_num: r.knesset_num,
    start_date: r.start_date?.toISOString() ?? null,
    end_date: r.end_date?.toISOString() ?? null,
    is_current: r.is_current,
    source_url: r.source_url,
  };
}

/** List all current ministers, sorted: PM first, then alphabetically by ministry */
export async function listMinisters(): Promise<{
  data: GovernmentMinister[];
  total: number;
}> {
  const roles = await db.governmentRole.findMany({
    where: { is_current: true },
    include: {
      mk: {
        include: {
          memberships: {
            where: { is_current: true },
            include: { party: { select: { id: true, name_he: true, name_en: true, external_id: true } } },
            take: 1,
            orderBy: { knesset_number: "desc" },
          },
        },
      },
    },
    orderBy: [{ position_id: "asc" }, { ministry_name: "asc" }],
  });

  const ministers: GovernmentMinister[] = await Promise.all(
    roles.map(async (role) => {
      const mk = role.mk;
      const currentMembership = mk.memberships[0] ?? null;

      const topic = getMinistryTopic(role.gov_ministry_id);
      const [relatedBills, sources] = await Promise.all([
        fetchRelatedBills(topic, 3),
        fetchRoleSources(role.id),
      ]);

      return {
        mk: {
          id: mk.id,
          external_id: mk.external_id,
          external_source: mk.external_source,
          name_he: mk.name_he,
          name_en: mk.name_en,
          name_first_he: mk.name_first_he,
          name_last_he: mk.name_last_he,
          gender: (mk.gender as "male" | "female" | "other" | "unknown") ?? "unknown",
          is_current: mk.is_current,
          current_party_id: currentMembership?.party_id ?? null,
          current_party_name: currentMembership?.party?.name_he ?? null,
          coalition_status: null,
          source_url: mk.source_url,
          image_url: mk.image_url,
          last_seen_at: mk.last_seen_at?.toISOString() ?? null,
          last_changed_at: mk.last_changed_at?.toISOString() ?? null,
          sources: [],
        },
        role: mapRole(role),
        related_bills: relatedBills,
        sources,
      };
    }),
  );

  // Sort: PM (positionId=45) first, then by ministry name
  ministers.sort((a, b) => {
    const aIsPM = a.role.position_id === 45;
    const bIsPM = b.role.position_id === 45;
    if (aIsPM && !bIsPM) return -1;
    if (!aIsPM && bIsPM) return 1;
    return (a.role.ministry_name ?? "").localeCompare(b.role.ministry_name ?? "", "he");
  });

  return { data: ministers, total: ministers.length };
}

/** Get full minister detail by MK db id */
export async function getMinisterById(mkId: string): Promise<GovernmentMinisterDetail | null> {
  const role = await db.governmentRole.findFirst({
    where: { mk_id: mkId, is_current: true },
    include: {
      mk: {
        include: {
          memberships: {
            where: { is_current: true },
            include: { party: { select: { id: true, name_he: true, name_en: true, external_id: true } } },
            take: 1,
            orderBy: { knesset_number: "desc" },
          },
          committee_memberships: {
            include: { committee: { select: { id: true, name_he: true, knesset_number: true } } },
            orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
            take: 20,
          },
        },
      },
    },
  });

  if (!role) return null;

  const mk = role.mk;
  const currentMembership = mk.memberships[0] ?? null;
  const topic = getMinistryTopic(role.gov_ministry_id);

  const [relatedBills, sources] = await Promise.all([
    fetchRelatedBills(topic, 10),
    fetchRoleSources(role.id),
  ]);

  const committeeRoles: MKCommitteeListItem[] = mk.committee_memberships.map((cm) => ({
    committee_id: cm.committee_id,
    name_he: cm.committee.name_he,
    role: cm.role,
    knesset_number: cm.committee.knesset_number,
    is_current: cm.is_current,
    start_date: cm.start_date?.toISOString() ?? null,
    end_date: cm.end_date?.toISOString() ?? null,
  }));

  return {
    mk: {
      id: mk.id,
      external_id: mk.external_id,
      external_source: mk.external_source,
      name_he: mk.name_he,
      name_en: mk.name_en,
      name_first_he: mk.name_first_he,
      name_last_he: mk.name_last_he,
      gender: (mk.gender as "male" | "female" | "other" | "unknown") ?? "unknown",
      is_current: mk.is_current,
      current_party_id: currentMembership?.party_id ?? null,
      current_party_name: currentMembership?.party?.name_he ?? null,
      coalition_status: null,
      source_url: mk.source_url,
      image_url: mk.image_url,
      last_seen_at: mk.last_seen_at?.toISOString() ?? null,
      last_changed_at: mk.last_changed_at?.toISOString() ?? null,
      sources: [],
    },
    role: mapRole(role),
    related_bills: relatedBills,
    committee_roles: committeeRoles,
    sources,
  };
}
