import type { FastifyInstance } from "fastify";
import { listBills, getBillById } from "../services/bill-service.js";
import { getCached, buildCacheKey } from "../plugins/redis.js";
import { CACHE_TTL, BILL_TOPIC_LABELS } from "@knesset-vote/shared";

export async function billRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/bills",
    {
      schema: {
        description: "List bills with optional filters",
        tags: ["Bills"],
        querystring: {
          type: "object",
          properties: {
            search: { type: "string", maxLength: 200 },
            topic: { type: "string" },
            status: { type: "string" },
            mk_id: { type: "string" },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const { search, topic, status, mk_id, page = 1, limit = 20 } = request.query as {
        search?: string;
        topic?: string;
        status?: string;
        mk_id?: string;
        page?: number;
        limit?: number;
      };

      const cacheKey = buildCacheKey("bills", { search, topic, status, mk_id, page, limit });
      const result = await getCached(cacheKey, CACHE_TTL.SHORT, () =>
        listBills({ search, topic, status, mk_id, page, limit }),
      );

      reply.send({
        ...result,
        page,
        limit,
        pages: Math.ceil(result.total / limit),
        available_topics: BILL_TOPIC_LABELS,
        methodology_url: "/methodology#bills",
      });
    },
  );

  app.get(
    "/api/bills/:id",
    {
      schema: {
        description: "Get bill detail with stage history, sponsors, and sources",
        tags: ["Bills"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const cacheKey = buildCacheKey("bill", { id });

      const bill = await getCached(cacheKey, CACHE_TTL.SHORT, () => getBillById(id));

      if (!bill) {
        reply.code(404).send({ error: "Not Found", message: "Bill not found", statusCode: 404 });
        return;
      }

      reply.send({
        data: bill,
        methodology_url: "/methodology#bills",
        computed_fields: {
          topic: {
            definition: "Automatically assigned based on keyword matching against bill title",
            limitations: "MVP: static keyword matching; may be inaccurate",
            methodology_anchor: "/methodology#topic-classification",
          },
        },
      });
    },
  );
}
