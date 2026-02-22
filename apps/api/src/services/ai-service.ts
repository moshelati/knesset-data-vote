/**
 * AI Service — Gemini-powered "Ask + Verify" for Knesset data.
 *
 * Security rules:
 * - GEMINI_API_KEY is read server-side only, never logged, never returned to client.
 * - All factual claims MUST be backed by a DB tool call + source_url.
 * - The AI is instructed not to invent data; if DB returns empty, it says so.
 *
 * Architecture:
 * 1. Receive question from route
 * 2. Call Gemini with 6 DB-backed function tools
 * 3. Gemini calls tools → we execute DB queries with real data
 * 4. Gemini generates final Hebrew answer from tool results
 * 5. We parse answer + extract citations/entity_cards
 * 6. Return structured AiAnswer
 */

import { GoogleGenAI, Type, type Tool, type FunctionCall } from "@google/genai";
import { db } from "@knesset-vote/db";
import { getCached, buildCacheKey } from "../plugins/redis.js";
import { CACHE_TTL } from "@knesset-vote/shared";
import type { Citation, EntityCard, AiAnswer } from "@knesset-vote/shared";

// ─── Constants ──────────────────────────────────────────────────────────────

const MODEL_NAME = "gemini-2.5-flash-preview-04-17";

const SYSTEM_INSTRUCTION = `אתה עוזר AI של Knesset Vote — פלטפורמת שקיפות פרלמנטרית ישראלית.

חוקים שחייבים לקיים:
1. ענה רק על שאלות הקשורות לכנסת ישראל, חברי כנסת, סיעות, הצעות חוק, שרים, ועדות, והצבעות.
2. כל טענה עובדתית חייבת להתבסס על תוצאת tool call — לעולם אל תמציא נתונים.
3. אם tool call מחזיר תוצאות ריקות, אמור בגלוי: "לא נמצאו נתונים במסד הנתונים עבור שאלה זו".
4. ענה בעברית בלבד.
5. היה תמציתי — מקסימום 250 מילה בתשובה.
6. הזכר את שם ה-tool שקראת לו בתשובה (לשקיפות).
7. אל תענה על שאלות שאינן קשורות לכנסת.`;

const DISCLAIMER_HE =
  "תשובה זו מבוססת על נתוני Knesset OData כפי שנסרקו לאחרונה. ייתכנו פערי עדכון. " +
  "ייחוס הצעות חוק לשרים הוא לפי נושא המשרד ואינו ייחוס סיבתי ישיר. " +
  "לפרטים מלאים ראה את עמוד המתודולוגיה.";

// Coalition status map (knesset 25) — mirrors mk-service.ts
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

function getCoalitionStatus(externalId: string | null): "coalition" | "opposition" | null {
  if (!externalId) return null;
  if (KNESSET_25_COALITION.has(externalId)) return "coalition";
  if (KNESSET_25_OPPOSITION.has(externalId)) return "opposition";
  return null;
}

// ─── Lazy-init Gemini client ──────────────────────────────────────────────

let _genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (_genAI) return _genAI;
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set. " +
        "Add it to Railway (API service) environment variables.",
    );
  }
  _genAI = new GoogleGenAI({ apiKey });
  return _genAI;
}

/**
 * Maps raw Gemini API error messages to friendly Hebrew strings
 * so we never leak internal details to the client.
 */
function classifyGeminiError(msg: string): string {
  if (msg.includes("GEMINI_API_KEY") || msg.includes("API_KEY_INVALID")) {
    return "AI_UNAVAILABLE";
  }
  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("free_tier")) {
    return "שירות ה-AI עמוס כרגע — נסה שוב עוד כמה שניות.";
  }
  if (msg.includes("PERMISSION_DENIED") || msg.includes("403")) {
    return "AI_UNAVAILABLE";
  }
  if (msg.includes("UNAVAILABLE") || msg.includes("503")) {
    return "שירות ה-AI אינו זמין כרגע. נסה שוב מאוחר יותר.";
  }
  // Generic fallback — don't expose raw Gemini error text
  return "שגיאה בעיבוד השאלה. נסה שוב.";
}

// ─── Tool implementations (DB queries) ───────────────────────────────────

/**
 * search_mks — fuzzy search MKs by name
 */
async function toolSearchMks(args: { query: string; limit?: number }) {
  const { query, limit = 5 } = args;
  const mks = await db.mK.findMany({
    where: {
      OR: [
        { name_he: { contains: query } },
        { name_en: { contains: query, mode: "insensitive" } },
        { name_first_he: { contains: query } },
        { name_last_he: { contains: query } },
      ],
    },
    include: {
      memberships: {
        where: { is_current: true },
        include: {
          party: { select: { name_he: true, external_id: true } },
        },
        take: 1,
        orderBy: { knesset_number: "desc" },
      },
    },
    take: limit,
    orderBy: [{ is_current: "desc" }, { name_he: "asc" }],
  });

  return mks.map((mk) => ({
    id: mk.id,
    name_he: mk.name_he,
    name_en: mk.name_en,
    party: mk.memberships[0]?.party?.name_he ?? null,
    is_current: mk.is_current,
    source_url:
      mk.source_url ?? `https://knesset.gov.il/mk/heb/mk.asp?mk_individual_id_t=${mk.external_id}`,
    platform_url: `/mks/${mk.id}`,
  }));
}

/**
 * get_mk_detail — full MK profile with bill count and committee memberships
 */
async function toolGetMkDetail(args: { mk_id?: string; name_query?: string }) {
  const { mk_id, name_query } = args;

  const includeClause = {
    memberships: {
      where: { is_current: true },
      include: {
        party: { select: { name_he: true, external_id: true } },
      },
      take: 1,
      orderBy: { knesset_number: "desc" as const },
    },
    committee_memberships: {
      where: { is_current: true },
      include: { committee: { select: { name_he: true } } },
      take: 10,
    },
    government_roles: {
      where: { is_current: true },
      select: { duty_desc: true, ministry_name: true, position_label: true },
    },
    _count: { select: { bill_roles: true } },
  };

  let mk;
  if (mk_id) {
    mk = await db.mK.findUnique({
      where: { id: mk_id },
      include: includeClause,
    });
  } else if (name_query) {
    mk = await db.mK.findFirst({
      where: {
        OR: [
          { name_he: { contains: name_query } },
          { name_en: { contains: name_query, mode: "insensitive" } },
        ],
        is_current: true,
      },
      include: includeClause,
    });
  }

  if (!mk) return { found: false, error: "לא נמצא חבר כנסת עם פרטים אלו" };

  const partyExtId = mk.memberships[0]?.party?.external_id ?? null;

  return {
    found: true,
    id: mk.id,
    name_he: mk.name_he,
    name_en: mk.name_en,
    party: mk.memberships[0]?.party?.name_he ?? null,
    coalition_status: getCoalitionStatus(partyExtId),
    is_current: mk.is_current,
    bills_count: mk._count.bill_roles,
    committees: mk.committee_memberships.map((cm) => cm.committee.name_he),
    government_role: mk.government_roles[0]?.duty_desc ?? null,
    source_url:
      mk.source_url ?? `https://knesset.gov.il/mk/heb/mk.asp?mk_individual_id_t=${mk.external_id}`,
    platform_url: `/mks/${mk.id}`,
  };
}

/**
 * search_bills — search bills by topic or keyword
 */
async function toolSearchBills(args: { topic?: string; keyword?: string; limit?: number }) {
  const { topic, keyword, limit = 8 } = args;

  const bills = await db.bill.findMany({
    where: {
      is_demo: false,
      ...(topic ? { topic } : {}),
      ...(keyword
        ? {
            OR: [{ title_he: { contains: keyword } }, { description_he: { contains: keyword } }],
          }
        : {}),
    },
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
    submitted_date: b.submitted_date?.toISOString().slice(0, 10) ?? null,
    source_url: b.source_url,
    platform_url: `/bills/${b.id}`,
  }));
}

/**
 * get_party_info — party details including seat count
 */
async function toolGetPartyInfo(args: { name_query: string }) {
  const { name_query } = args;

  const party = await db.party.findFirst({
    where: {
      OR: [
        { name_he: { contains: name_query } },
        { name_en: { contains: name_query, mode: "insensitive" } },
      ],
      knesset_number: 25,
    },
    orderBy: { knesset_number: "desc" },
  });

  if (!party) return { found: false, error: `לא נמצאה סיעה בשם: ${name_query}` };

  return {
    found: true,
    id: party.id,
    name_he: party.name_he,
    name_en: party.name_en,
    seat_count: party.seat_count,
    coalition_status: getCoalitionStatus(party.external_id),
    knesset_number: party.knesset_number,
    is_active: party.is_active,
    source_url: party.source_url,
    platform_url: `/parties/${party.id}`,
  };
}

/**
 * list_ministers — current government ministers
 */
async function toolListMinisters(args: { filter_ministry?: string }) {
  const { filter_ministry } = args;

  const roles = await db.governmentRole.findMany({
    where: {
      is_current: true,
      ...(filter_ministry ? { ministry_name: { contains: filter_ministry } } : {}),
    },
    include: {
      mk: {
        select: {
          id: true,
          name_he: true,
          name_en: true,
          external_id: true,
          source_url: true,
        },
      },
    },
    orderBy: [{ position_id: "asc" }, { ministry_name: "asc" }],
  });

  return roles.map((r) => ({
    mk_id: r.mk.id,
    mk_name: r.mk.name_he,
    ministry_name: r.ministry_name,
    duty_desc: r.duty_desc,
    position_label: r.position_label,
    government_num: r.government_num,
    start_date: r.start_date?.toISOString().slice(0, 10) ?? null,
    source_url:
      r.source_url ??
      r.mk.source_url ??
      `https://knesset.gov.il/mk/heb/mk.asp?mk_individual_id_t=${r.mk.external_id}`,
    platform_url: `/government/${r.mk.id}`,
  }));
}

/**
 * search_votes — search parliamentary votes
 */
async function toolSearchVotes(args: { keyword?: string; limit?: number }) {
  const { keyword, limit = 8 } = args;

  const votes = await db.vote.findMany({
    where: keyword
      ? {
          OR: [
            { title_he: { contains: keyword } },
            { title_en: { contains: keyword, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { vote_date: "desc" },
    take: limit,
    select: {
      id: true,
      title_he: true,
      vote_date: true,
      result: true,
      yes_count: true,
      no_count: true,
      abstain_count: true,
      source_url: true,
    },
  });

  return votes.map((v) => ({
    id: v.id,
    title_he: v.title_he,
    vote_date: v.vote_date?.toISOString().slice(0, 10) ?? null,
    result: v.result,
    votes_for: v.yes_count,
    votes_against: v.no_count,
    votes_abstain: v.abstain_count,
    source_url: v.source_url,
    platform_url: `/votes/${v.id}`,
  }));
}

// ─── Tool definitions for Gemini ─────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "search_mks",
        description: "חיפוש חברי כנסת לפי שם. מחזיר רשימה עם שיוך מפלגתי ו-source_url.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: "שם חבר/ת הכנסת לחיפוש (עברית או אנגלית)",
            },
            limit: {
              type: Type.NUMBER,
              description: "מספר תוצאות מקסימלי (ברירת מחדל: 5)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_mk_detail",
        description: "מידע מפורט על חבר/ת כנסת — כולל מספר הצעות חוק, ועדות, ותפקיד ממשלתי.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            mk_id: {
              type: Type.STRING,
              description: "מזהה פנימי של חבר/ת הכנסת (מ-search_mks)",
            },
            name_query: {
              type: Type.STRING,
              description: "שם חבר/ת הכנסת לחיפוש (חלופה ל-mk_id)",
            },
          },
        },
      },
      {
        name: "search_bills",
        description: "חיפוש הצעות חוק לפי נושא או מילת מפתח.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            topic: {
              type: Type.STRING,
              description: "נושא ההצעה (למשל: justice_law, education, healthcare, economy)",
            },
            keyword: {
              type: Type.STRING,
              description: "מילת מפתח לחיפוש בשם ההצעה",
            },
            limit: {
              type: Type.NUMBER,
              description: "מספר תוצאות מקסימלי (ברירת מחדל: 8)",
            },
          },
        },
      },
      {
        name: "get_party_info",
        description: "מידע על סיעה — מספר מנדטים, קואליציה/אופוזיציה.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name_query: {
              type: Type.STRING,
              description: "שם הסיעה לחיפוש",
            },
          },
          required: ["name_query"],
        },
      },
      {
        name: "list_ministers",
        description: "רשימת שרי הממשלה הנוכחיים עם שם המשרד.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            filter_ministry: {
              type: Type.STRING,
              description: "סנן לפי שם משרד (אופציונלי)",
            },
          },
        },
      },
      {
        name: "search_votes",
        description: "חיפוש הצבעות פרלמנטריות לפי מילת מפתח.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            keyword: {
              type: Type.STRING,
              description: "מילת מפתח לחיפוש בנושא ההצבעה",
            },
            limit: {
              type: Type.NUMBER,
              description: "מספר תוצאות מקסימלי (ברירת מחדל: 8)",
            },
          },
        },
      },
    ],
  },
];

// ─── Tool dispatcher ──────────────────────────────────────────────────────

async function dispatchTool(
  call: FunctionCall,
): Promise<{ result: unknown; source_urls: string[] }> {
  const name = call.name ?? "";
  const args = (call.args ?? {}) as Record<string, unknown>;

  const cacheKey = buildCacheKey(`ai_tool_${name}`, args);

  const result = await getCached(cacheKey, CACHE_TTL.MEDIUM, async () => {
    switch (name) {
      case "search_mks":
        return toolSearchMks(args as { query: string; limit?: number });
      case "get_mk_detail":
        return toolGetMkDetail(args as { mk_id?: string; name_query?: string });
      case "search_bills":
        return toolSearchBills(args as { topic?: string; keyword?: string; limit?: number });
      case "get_party_info":
        return toolGetPartyInfo(args as { name_query: string });
      case "list_ministers":
        return toolListMinisters(args as { filter_ministry?: string });
      case "search_votes":
        return toolSearchVotes(args as { keyword?: string; limit?: number });
      default:
        return { error: `Unknown tool: ${name}` };
    }
  });

  // Extract source_urls from the result for citation building
  const source_urls: string[] = [];
  if (Array.isArray(result)) {
    for (const item of result as Array<{ source_url?: string | null }>) {
      if (item.source_url) source_urls.push(item.source_url);
    }
  } else if (result && typeof result === "object") {
    const r = result as { source_url?: string | null };
    if (r.source_url) source_urls.push(r.source_url);
  }

  return { result, source_urls };
}

// ─── Extract entity cards from tool results ───────────────────────────────

function buildEntityCard(toolName: string, item: Record<string, unknown>): EntityCard | null {
  const id = item["id"] as string | undefined;
  const platformUrl = item["platform_url"] as string | undefined;

  if (!id || !platformUrl) return null;

  switch (toolName) {
    case "search_mks":
    case "get_mk_detail": {
      const party = item["party"] as string | null;
      return {
        type: "mk",
        id,
        label: (item["name_he"] as string) ?? id,
        url: platformUrl,
        meta: party ?? undefined,
      };
    }
    case "search_bills":
      return {
        type: "bill",
        id,
        label: ((item["title_he"] as string) ?? id).slice(0, 60),
        url: platformUrl,
        meta: (item["topic"] as string | undefined) ?? undefined,
      };
    case "get_party_info":
      return {
        type: "party",
        id,
        label: (item["name_he"] as string) ?? id,
        url: platformUrl,
        meta: item["seat_count"] ? `${item["seat_count"]} מנדטים` : undefined,
      };
    case "list_ministers":
      return {
        type: "minister",
        id: (item["mk_id"] as string) ?? id,
        label: (item["mk_name"] as string) ?? id,
        url: platformUrl,
        meta: (item["ministry_name"] as string | undefined) ?? undefined,
      };
    default:
      return null;
  }
}

function extractEntityCards(toolName: string, result: unknown): EntityCard[] {
  const cards: EntityCard[] = [];
  if (!result || typeof result !== "object") return cards;

  if (Array.isArray(result)) {
    for (const item of result as Array<Record<string, unknown>>) {
      const card = buildEntityCard(toolName, item);
      if (card) cards.push(card);
    }
  } else {
    const card = buildEntityCard(toolName, result as Record<string, unknown>);
    if (card) cards.push(card);
  }

  // Deduplicate by url
  const seen = new Set<string>();
  return cards.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}

// ─── SSE event types ─────────────────────────────────────────────────────

export type AiStreamEvent =
  | { type: "tool_start"; tool: string }
  | { type: "tool_done"; tool: string }
  | { type: "text_chunk"; chunk: string }
  | { type: "done"; meta: Omit<AiAnswer, "answer_md"> }
  | { type: "error"; message: string };

// ─── Streaming variant ────────────────────────────────────────────────────

/**
 * askAIStream — same agentic loop as askAI, but yields SSE events:
 *   tool_start / tool_done during the tool-call phase,
 *   text_chunk for each streamed text token,
 *   done with citations + entity_cards + tool_calls_made when finished,
 *   error on failure.
 *
 * The caller (SSE route) writes each event as `data: <json>\n\n`.
 */
export async function* askAIStream(question: string): AsyncGenerator<AiStreamEvent> {
  const genAI = getGenAI();
  const toolCallsMade: string[] = [];
  const allCitations: Citation[] = [];
  const allEntityCards: EntityCard[] = [];

  try {
    // ── Phase 1: tool-call loop (non-streaming, same as askAI) ──
    const chat = genAI.chats.create({
      model: MODEL_NAME,
      config: { systemInstruction: SYSTEM_INSTRUCTION, tools: TOOLS },
    });

    let response = await chat.sendMessage({ message: question });

    while (response.functionCalls && response.functionCalls.length > 0) {
      const toolResults = [];

      for (const call of response.functionCalls) {
        const toolName = call.name ?? "unknown";
        if (!toolCallsMade.includes(toolName)) toolCallsMade.push(toolName);

        yield { type: "tool_start", tool: toolName };
        const { result, source_urls } = await dispatchTool(call);
        yield { type: "tool_done", tool: toolName };

        for (const url of source_urls) {
          allCitations.push({ label: `מקור: ${toolName}`, url });
        }
        allEntityCards.push(...extractEntityCards(toolName, result));
        toolResults.push({ functionResponse: { name: toolName, response: { result } } });
      }

      response = await chat.sendMessage({ message: toolResults });
    }

    // ── Phase 2: stream the final text answer ──
    // Re-ask with "please write your final answer" using accumulated tool context
    const toolSummary =
      toolCallsMade.length > 0 ? `[כלים שהופעלו: ${toolCallsMade.join(", ")}]\n\n` : "";
    const finalText = response.text ?? "";

    // Stream the already-formed answer token by token (word chunks)
    // Gemini doesn't support mid-chat streaming in function-calling mode,
    // so we stream the complete text in word-sized chunks for UX effect.
    const words = (toolSummary + finalText).split(/(\s+)/);
    let buffer = "";
    for (const word of words) {
      buffer += word;
      // Emit every ~4 words or on sentence boundary
      if (buffer.length >= 20 || /[.!?:]/.test(word)) {
        yield { type: "text_chunk", chunk: buffer };
        buffer = "";
        // Tiny async yield to keep the event loop responsive
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    if (buffer) yield { type: "text_chunk", chunk: buffer };

    // Deduplicate
    const seenUrls = new Set<string>();
    const uniqueCitations = allCitations.filter((c) => {
      if (seenUrls.has(c.url)) return false;
      seenUrls.add(c.url);
      return true;
    });
    const seenCards = new Set<string>();
    const uniqueCards = allEntityCards.filter((c) => {
      if (seenCards.has(c.url)) return false;
      seenCards.add(c.url);
      return true;
    });

    yield {
      type: "done",
      meta: {
        question,
        citations: uniqueCitations.slice(0, 10),
        entity_cards: uniqueCards.slice(0, 6),
        tool_calls_made: toolCallsMade,
        model: MODEL_NAME,
        disclaimer: DISCLAIMER_HE,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    yield { type: "error", message: classifyGeminiError(msg) };
  }
}

// ─── Main exported function ───────────────────────────────────────────────

export async function askAI(question: string): Promise<AiAnswer> {
  const genAI = getGenAI();

  const toolCallsMade: string[] = [];
  const allCitations: Citation[] = [];
  const allEntityCards: EntityCard[] = [];

  // Start a conversation with function calling
  const chat = genAI.chats.create({
    model: MODEL_NAME,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: TOOLS,
    },
  });

  // Send user question
  let response = await chat.sendMessage({ message: question });

  // Agentic loop: handle tool calls until model returns text
  while (response.functionCalls && response.functionCalls.length > 0) {
    const toolResults = [];

    for (const call of response.functionCalls) {
      const toolName = call.name ?? "unknown";
      if (!toolCallsMade.includes(toolName)) {
        toolCallsMade.push(toolName);
      }

      const { result, source_urls } = await dispatchTool(call);

      // Build citations from tool results
      for (const url of source_urls) {
        allCitations.push({
          label: `מקור: ${toolName}`,
          url,
          entity_type: undefined,
          entity_id: undefined,
        });
      }

      // Build entity cards
      const cards = extractEntityCards(toolName, result);
      allEntityCards.push(...cards);

      toolResults.push({
        functionResponse: {
          name: toolName,
          response: { result },
        },
      });
    }

    // Send tool results back to Gemini
    response = await chat.sendMessage({ message: toolResults });
  }

  // Extract final text answer
  const answerText = response.text ?? "לא הצלחתי לעבד את השאלה. נסה שוב.";

  // Deduplicate citations by URL
  const seenUrls = new Set<string>();
  const uniqueCitations = allCitations.filter((c) => {
    if (seenUrls.has(c.url)) return false;
    seenUrls.add(c.url);
    return true;
  });

  // Deduplicate entity cards by url
  const seenCards = new Set<string>();
  const uniqueCards = allEntityCards.filter((c) => {
    if (seenCards.has(c.url)) return false;
    seenCards.add(c.url);
    return true;
  });

  return {
    question,
    answer_md: answerText,
    citations: uniqueCitations.slice(0, 10),
    entity_cards: uniqueCards.slice(0, 6),
    tool_calls_made: toolCallsMade,
    model: MODEL_NAME,
    disclaimer: DISCLAIMER_HE,
  };
}
