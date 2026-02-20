/**
 * DEMO SEED DATA
 *
 * This seed provides a small fixture dataset for demonstrating the UI
 * when the Knesset OData source is unreachable.
 *
 * ALL ENTRIES ARE MARKED is_demo=true.
 * No claims are invented. Data is clearly labeled as "DEMO DATA".
 * Sources point to the official Knesset website for structure/context.
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function hashId(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}

async function main() {
  console.info("🌱 Seeding demo data...");

  // Create a demo ETL run
  const etlRun = await prisma.eTLRun.create({
    data: {
      status: "completed",
      source: "demo_seed",
      source_version: "1.0.0",
      commit_hash: "demo",
      counts_json: {
        party: { fetched: 5, created: 5, updated: 0, failed: 0 },
        mk: { fetched: 10, created: 10, updated: 0, failed: 0 },
        bill: { fetched: 5, created: 5, updated: 0, failed: 0 },
      },
      errors_json: [],
      latency_ms: 0,
      completed_at: new Date(),
    },
  });

  // ─── DEMO PARTIES (based on 25th Knesset, names are factual) ───
  const partyData = [
    {
      external_id: "demo_party_1",
      name_he: "הליכוד",
      name_en: "Likud",
      abbreviation: "lik",
      seat_count: 32,
      knesset_number: 25,
    },
    {
      external_id: "demo_party_2",
      name_he: "יש עתיד",
      name_en: "Yesh Atid",
      abbreviation: "ya",
      seat_count: 24,
      knesset_number: 25,
    },
    {
      external_id: "demo_party_3",
      name_he: "המחנה הממלכתי",
      name_en: "National Unity",
      abbreviation: "nu",
      seat_count: 12,
      knesset_number: 25,
    },
    {
      external_id: "demo_party_4",
      name_he: "ש\"ס",
      name_en: "Shas",
      abbreviation: "shas",
      seat_count: 11,
      knesset_number: 25,
    },
    {
      external_id: "demo_party_5",
      name_he: "יהדות התורה",
      name_en: "United Torah Judaism",
      abbreviation: "utj",
      seat_count: 7,
      knesset_number: 25,
    },
  ];

  const parties: Array<{ id: string; external_id: string }> = [];

  for (const p of partyData) {
    const party = await prisma.party.upsert({
      where: {
        external_id_external_source: {
          external_id: p.external_id,
          external_source: "demo",
        },
      },
      update: {},
      create: {
        external_id: p.external_id,
        external_source: "demo",
        name_he: p.name_he,
        name_en: p.name_en,
        abbreviation: p.abbreviation,
        seat_count: p.seat_count,
        knesset_number: p.knesset_number,
        is_active: true,
        is_demo: true,
        source_url: "https://knesset.gov.il/mk/heb/factions.asp",
        last_seen_at: new Date(),
      },
    });
    parties.push({ id: party.id, external_id: p.external_id });
  }

  // ─── DEMO MKs (names based on factual 25th Knesset members) ───
  const mkData = [
    {
      external_id: "demo_mk_1",
      name_he: "בנימין נתניהו",
      name_en: "Benjamin Netanyahu",
      name_first_he: "בנימין",
      name_last_he: "נתניהו",
      party_external_id: "demo_party_1",
      gender: "male",
      is_current: true,
    },
    {
      external_id: "demo_mk_2",
      name_he: "יאיר לפיד",
      name_en: "Yair Lapid",
      name_first_he: "יאיר",
      name_last_he: "לפיד",
      party_external_id: "demo_party_2",
      gender: "male",
      is_current: true,
    },
    {
      external_id: "demo_mk_3",
      name_he: "בני גנץ",
      name_en: "Benny Gantz",
      name_first_he: "בני",
      name_last_he: "גנץ",
      party_external_id: "demo_party_3",
      gender: "male",
      is_current: true,
    },
    {
      external_id: "demo_mk_4",
      name_he: "אריה דרעי",
      name_en: "Aryeh Deri",
      name_first_he: "אריה",
      name_last_he: "דרעי",
      party_external_id: "demo_party_4",
      gender: "male",
      is_current: true,
    },
    {
      external_id: "demo_mk_5",
      name_he: "משה גפני",
      name_en: "Moshe Gafni",
      name_first_he: "משה",
      name_last_he: "גפני",
      party_external_id: "demo_party_5",
      gender: "male",
      is_current: true,
    },
  ];

  const mks: Array<{ id: string; external_id: string }> = [];

  for (const m of mkData) {
    const partyRef = parties.find((p) => p.external_id === m.party_external_id);
    const mk = await prisma.mK.upsert({
      where: {
        external_id_external_source: {
          external_id: m.external_id,
          external_source: "demo",
        },
      },
      update: {},
      create: {
        external_id: m.external_id,
        external_source: "demo",
        name_he: m.name_he,
        name_en: m.name_en,
        name_first_he: m.name_first_he,
        name_last_he: m.name_last_he,
        gender: m.gender,
        is_current: m.is_current,
        is_demo: true,
        source_url: `https://knesset.gov.il/mk/heb/mk.asp?mk_individual_id_t=${m.external_id}`,
        last_seen_at: new Date(),
      },
    });
    mks.push({ id: mk.id, external_id: m.external_id });

    // Create party membership
    if (partyRef) {
      await prisma.partyMembership.upsert({
        where: {
          mk_id_party_id_knesset_number: {
            mk_id: mk.id,
            party_id: partyRef.id,
            knesset_number: 25,
          },
        },
        update: {},
        create: {
          mk_id: mk.id,
          party_id: partyRef.id,
          external_source: "demo",
          knesset_number: 25,
          start_date: new Date("2022-11-01"),
          is_current: true,
        },
      });
    }
  }

  // ─── DEMO BILLS ───
  const billData = [
    {
      external_id: "demo_bill_1",
      title_he: "חוק התקציב לשנת 2023 (הצעה לדוגמה)",
      title_en: "Budget Law 2023 (Demo)",
      status: "passed",
      topic: "economy",
      knesset_number: 25,
      submitted_date: new Date("2023-01-15"),
      mk_external_id: "demo_mk_1",
    },
    {
      external_id: "demo_bill_2",
      title_he: "הצעת חוק בריאות הציבור (לדוגמה)",
      title_en: "Public Health Bill (Demo)",
      status: "committee_review",
      topic: "healthcare",
      knesset_number: 25,
      submitted_date: new Date("2023-03-20"),
      mk_external_id: "demo_mk_2",
    },
    {
      external_id: "demo_bill_3",
      title_he: "הצעת חוק חינוך לכולם (לדוגמה)",
      title_en: "Education for All Bill (Demo)",
      status: "first_reading",
      topic: "education",
      knesset_number: 25,
      submitted_date: new Date("2023-05-10"),
      mk_external_id: "demo_mk_3",
    },
  ];

  for (const b of billData) {
    const mkRef = mks.find((m) => m.external_id === b.mk_external_id);
    const bill = await prisma.bill.upsert({
      where: {
        external_id_external_source: {
          external_id: b.external_id,
          external_source: "demo",
        },
      },
      update: {},
      create: {
        external_id: b.external_id,
        external_source: "demo",
        title_he: b.title_he,
        title_en: b.title_en,
        description_he:
          "תיאור לדוגמה בלבד. נתונים אלה אינם ממקור רשמי ומיועדים להדגמת הממשק בלבד.",
        description_en:
          "Demo description only. This data is not from an official source and is intended only for UI demonstration.",
        status: b.status,
        topic: b.topic,
        knesset_number: b.knesset_number,
        submitted_date: b.submitted_date,
        is_demo: true,
        source_url: "https://knesset.gov.il/privatelaw/heb/PrivateLawMenuContent.aspx",
        last_seen_at: new Date(),
      },
    });

    // Create MK-Bill role
    if (mkRef) {
      await prisma.mKBillRole.upsert({
        where: {
          mk_id_bill_id_role: {
            mk_id: mkRef.id,
            bill_id: bill.id,
            role: "initiator",
          },
        },
        update: {},
        create: {
          mk_id: mkRef.id,
          bill_id: bill.id,
          external_source: "demo",
          role: "initiator",
        },
      });
    }

    // Store a demo snapshot
    await prisma.rawSnapshot.create({
      data: {
        entity_type: "bill",
        entity_id: bill.id,
        external_source: "demo",
        external_id: b.external_id,
        etl_run_id: etlRun.id,
        payload_json: b as object,
        payload_hash: hashId(JSON.stringify(b)),
        payload_size: JSON.stringify(b).length,
      },
    });
  }

  // ─── DEMO PROMISE (Statement) ───
  const mk1Ref = mks.find((m) => m.external_id === "demo_mk_1");
  if (mk1Ref) {
    await prisma.promise.create({
      data: {
        text: "הצהרה לדוגמה: \\\"נעמיד את כלכלת ישראל בראש סדר העדיפויות\\\" (לדוגמה בלבד, לא ממקור רשמי)",
        category: "statement",
        topic: "economy",
        mk_id: mk1Ref.id,
        stated_on: new Date("2022-10-01"),
        source_url: "https://knesset.gov.il",
        source_label: "Demo source - not official",
        added_by: "demo_seed",
        is_demo: true,
      },
    });
  }

  console.info("✅ Demo seed complete.");
  console.info(
    "⚠️  All seeded data is marked is_demo=true and is for UI demonstration only.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
