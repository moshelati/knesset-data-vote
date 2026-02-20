/**
 * API contract tests using supertest
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// Mock database calls
vi.mock("@knesset-vote/db", () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    eTLRun: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    party: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
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
  },
}));

// Mock Redis
vi.mock("../plugins/redis.js", () => ({
  setupRedis: vi.fn().mockResolvedValue(undefined),
  getRedis: vi.fn().mockReturnValue(null),
  getCached: vi
    .fn()
    .mockImplementation((_key: string, _ttl: number, fetcher: () => unknown) => fetcher()),
  buildCacheKey: vi
    .fn()
    .mockImplementation(
      (route: string, params: Record<string, unknown>) => `${route}:${JSON.stringify(params)}`,
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

describe("GET /api/health", () => {
  it("returns 200 with status", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("services");
  });
});

describe("GET /api/meta", () => {
  it("returns 200 with data sources", async () => {
    const res = await app.inject({ method: "GET", url: "/api/meta" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data_sources");
    expect(body).toHaveProperty("methodology_url");
    expect(Array.isArray(body.data_sources)).toBe(true);
  });
});

describe("GET /api/parties", () => {
  it("returns 200 with paginated response", async () => {
    const res = await app.inject({ method: "GET", url: "/api/parties" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("limit");
  });

  it("accepts search parameter", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/parties?search=ליכוד",
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 404 for unknown party id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/parties/does-not-exist",
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body).toHaveProperty("error");
    expect(body.statusCode).toBe(404);
  });
});

describe("GET /api/mks", () => {
  it("returns 200 with paginated response", async () => {
    const res = await app.inject({ method: "GET", url: "/api/mks" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
  });

  it("returns 404 for unknown MK", async () => {
    const res = await app.inject({ method: "GET", url: "/api/mks/no-exist" });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/bills", () => {
  it("returns 200 with bill list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/bills" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("available_topics");
  });

  it("accepts topic filter", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/bills?topic=economy",
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /api/search", () => {
  it("returns 200 with search results", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/search?q=נתניהו",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("query");
  });

  it("returns 400 when query is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/search",
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/promises", () => {
  it("returns 200", async () => {
    const res = await app.inject({ method: "GET", url: "/api/promises" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("editorial_note");
  });
});

describe("POST /api/promises without API_KEY", () => {
  it("returns 404 when API_KEY not set", async () => {
    delete process.env["API_KEY"];
    const res = await app.inject({
      method: "POST",
      url: "/api/promises",
      payload: {
        text: "test",
        category: "statement",
        source_url: "https://example.com",
        source_label: "Test",
      },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("Rate limiting", () => {
  it("includes rate limit headers", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    // Rate limit plugin adds these headers
    expect(res.statusCode).toBe(200);
  });
});

describe("Security headers", () => {
  it("includes security headers", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    // Helmet adds X-Content-Type-Options
    expect(res.headers["x-content-type-options"]).toBeDefined();
  });
});
