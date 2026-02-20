/**
 * API contract tests for POST /api/recommendations
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// ─── Mock DB ────────────────────────────────────────────────────────────────
vi.mock("@knesset-vote/db", () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    eTLRun: {
      findFirst: vi.fn().mockResolvedValue({
        completed_at: new Date("2025-01-01T00:00:00Z"),
      }),
    },
    party: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "party-1",
          name_he: "סיעה א",
          name_en: "Party A",
          abbreviation: "א",
          seat_count: 10,
          is_active: true,
        },
        {
          id: "party-2",
          name_he: "סיעה ב",
          name_en: "Party B",
          abbreviation: "ב",
          seat_count: 8,
          is_active: true,
        },
        {
          id: "party-3",
          name_he: "סיעה ג",
          name_en: "Party C",
          abbreviation: "ג",
          seat_count: 5,
          is_active: true,
        },
      ]),
      count: vi.fn().mockResolvedValue(3),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    mK: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    bill: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    mKBillRole: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    committeeMembership: {
      count: vi.fn().mockResolvedValue(0),
    },
    voteRecord: {
      count: vi.fn().mockResolvedValue(0),
    },
    promise: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    sourceLink: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    partyMembership: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    partyTopicAgg: {
      findMany: vi.fn().mockResolvedValue([
        { party_id: "party-1", topic: "housing", raw_score: 10, bill_count: 5 },
        { party_id: "party-2", topic: "housing", raw_score: 5, bill_count: 3 },
        { party_id: "party-3", topic: "housing", raw_score: 2, bill_count: 1 },
        { party_id: "party-1", topic: "economy", raw_score: 8, bill_count: 4 },
        { party_id: "party-2", topic: "economy", raw_score: 4, bill_count: 2 },
        { party_id: "party-3", topic: "economy", raw_score: 6, bill_count: 3 },
      ]),
    },
    vote: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

// ─── Mock Redis ──────────────────────────────────────────────────────────────
vi.mock("../plugins/redis.js", () => ({
  setupRedis: vi.fn().mockResolvedValue(undefined),
  getRedis: vi.fn().mockReturnValue(null),
  getCached: vi.fn().mockImplementation(
    (_key: string, _ttl: number, fetcher: () => unknown) => fetcher(),
  ),
  buildCacheKey: vi.fn().mockImplementation(
    (route: string, params: Record<string, unknown>) =>
      `${route}:${JSON.stringify(params)}`,
  ),
}));

let app: FastifyInstance;

beforeAll(async () => {
  const { build } = await import("../server.js");
  app = await build();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ────────────────────────────────────────────────────────────────────────────

describe("POST /api/recommendations", () => {
  it("returns 400 with no body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when topics is empty array", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topics: [] }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when weight is 0 (below minimum)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topics: [{ id: "housing_prices", weight: 0 }],
      }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when weight is 6 (above maximum)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topics: [{ id: "housing_prices", weight: 6 }],
      }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 503 when partyTopicAgg is empty (aggregate not run)", async () => {
    // Override partyTopicAgg to return empty
    const { db } = await import("@knesset-vote/db");
    vi.mocked(db.partyTopicAgg.findMany).mockResolvedValueOnce([]);

    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topics: [{ id: "housing_prices", weight: 3 }],
      }),
    });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body).toHaveProperty("message");
  });

  it("returns 200 with results and meta for valid request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topics: [
          { id: "housing_prices", weight: 5 },
          { id: "cost_of_living", weight: 3 },
        ],
      }),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("results");
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeLessThanOrEqual(3);
    expect(body).toHaveProperty("meta");
    expect(body.meta).toHaveProperty("methodology_url");
    expect(body.meta).toHaveProperty("warning");
    expect(body.meta).toHaveProperty("parties_evaluated");
    expect(body.meta).toHaveProperty("topics_requested");
    expect(body.meta.topics_requested).toBe(2);
  });

  it("returns 200 and includes free_text_suggestions when free_text is provided", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topics: [{ id: "housing_prices", weight: 4 }],
        free_text: "דיור ותחבורה",
      }),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("results");
    // free_text_suggestions may or may not be present depending on keyword match
    // but should not cause a 400/500 error
  });

  it("accepts ideological_preference without error (guardrail: not used in scoring)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topics: [{ id: "education", weight: 3 }],
        ideological_preference: "right",
      }),
    });
    // Should not return 400 (field is accepted but ignored)
    expect(res.statusCode).not.toBe(400);
  });

  it("result items have required fields: rank, party, personal_score, confidence, topic_breakdown, highlights", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topics: [{ id: "housing_prices", weight: 5 }],
      }),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    if (body.results.length > 0) {
      const first = body.results[0];
      expect(first).toHaveProperty("rank");
      expect(first).toHaveProperty("party");
      expect(first).toHaveProperty("personal_score");
      expect(first).toHaveProperty("confidence");
      expect(first).toHaveProperty("topic_breakdown");
      expect(first).toHaveProperty("highlights");
      expect(first.party).toHaveProperty("id");
      expect(first.party).toHaveProperty("name_he");
    }
  });
});
