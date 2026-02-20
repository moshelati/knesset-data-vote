import { db } from "@knesset-vote/db";
import type { Bill, BillDetail } from "@knesset-vote/shared";

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

export async function listBills(opts: {
  search?: string;
  topic?: string;
  status?: string;
  mk_id?: string;
  page: number;
  limit: number;
}): Promise<{ data: Bill[]; total: number }> {
  const { search, topic, status, mk_id, page, limit } = opts;
  const skip = (page - 1) * limit;

  const where: Parameters<typeof db.bill.findMany>[0]["where"] = {};

  if (search) {
    where.OR = [
      { title_he: { contains: search } },
      { title_en: { contains: search, mode: "insensitive" } },
      { description_he: { contains: search } },
    ];
  }

  if (topic) where.topic = topic;
  if (status) where.status = status;

  if (mk_id) {
    where.sponsors = {
      some: {
        mk: { OR: [{ id: mk_id }, { external_id: mk_id }] },
      },
    };
  }

  const [bills, total] = await Promise.all([
    db.bill.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ submitted_date: "desc" }, { title_he: "asc" }],
    }),
    db.bill.count({ where }),
  ]);

  const billsWithSources = await Promise.all(
    bills.map(async (b) => ({
      ...b,
      sources: mapSourceLinks(await getSourceLinks("bill", b.id)),
    })),
  );

  return {
    data: billsWithSources.map((b) => ({
      id: b.id,
      external_id: b.external_id,
      external_source: b.external_source,
      title_he: b.title_he,
      title_en: b.title_en,
      description_he: b.description_he,
      description_en: b.description_en,
      status: b.status as Bill["status"],
      topic: b.topic as Bill["topic"],
      knesset_number: b.knesset_number,
      submitted_date: b.submitted_date?.toISOString() ?? null,
      last_status_date: b.last_status_date?.toISOString() ?? null,
      source_url: b.source_url,
      is_demo: b.is_demo,
      sources: b.sources,
    })),
    total,
  };
}

export async function getBillById(id: string): Promise<BillDetail | null> {
  const bill = await db.bill.findFirst({
    where: { OR: [{ id }, { external_id: id }] },
    include: {
      sponsors: {
        include: {
          mk: { select: { id: true, name_he: true, name_en: true } },
        },
      },
      stage_history: {
        orderBy: { stage_date: "asc" },
      },
      ai_summary: true,
    },
  });

  if (!bill) return null;

  const [billSources, sponsorSources, stageSources] = await Promise.all([
    getSourceLinks("bill", bill.id),
    Promise.all(bill.sponsors.map((s) => getSourceLinks("bill_role", s.id))),
    Promise.all(bill.stage_history.map((st) => getSourceLinks("bill_stage", st.id))),
  ]);

  return {
    id: bill.id,
    external_id: bill.external_id,
    external_source: bill.external_source,
    title_he: bill.title_he,
    title_en: bill.title_en,
    description_he: bill.description_he,
    description_en: bill.description_en,
    status: bill.status as BillDetail["status"],
    topic: bill.topic as BillDetail["topic"],
    knesset_number: bill.knesset_number,
    submitted_date: bill.submitted_date?.toISOString() ?? null,
    last_status_date: bill.last_status_date?.toISOString() ?? null,
    source_url: bill.source_url,
    is_demo: bill.is_demo,
    sponsors: bill.sponsors.map((s, i) => ({
      mk_id: s.mk.id,
      mk_name_he: s.mk.name_he,
      mk_name_en: s.mk.name_en ?? null,
      role: s.role as "initiator" | "cosponsor" | "committee" | "other",
      sources: mapSourceLinks(sponsorSources[i] ?? []),
    })),
    stage_history: bill.stage_history.map((st, i) => ({
      id: st.id,
      stage_name_he: st.stage_name_he,
      stage_name_en: st.stage_name_en ?? null,
      status: st.status ?? null,
      date: st.stage_date?.toISOString() ?? null,
      committee_id: st.committee_id ?? null,
      committee_name: null,
      notes: st.notes ?? null,
      sources: mapSourceLinks(stageSources[i] ?? []),
    })),
    ai_summary: bill.ai_summary
      ? {
          text: bill.ai_summary.summary_text,
          model: bill.ai_summary.model_name,
          generated_at: bill.ai_summary.generated_at.toISOString(),
          source_fields: bill.ai_summary.source_fields as string[],
          warning: bill.ai_summary.warning,
        }
      : null,
    sources: mapSourceLinks(billSources),
  };
}
