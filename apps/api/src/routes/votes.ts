import type { FastifyInstance } from "fastify";
import { listVotes, getVoteById } from "../services/vote-service.js";
import { getCached, buildCacheKey } from "../plugins/redis.js";
import { CACHE_TTL } from "@knesset-vote/shared";

export async function voteRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/votes",
    {
      schema: {
        description: "List votes with optional filters",
        tags: ["Votes"],
        querystring: {
          type: "object",
          properties: {
            mk_id: { type: "string", description: "Filter by MK id or external_id" },
            bill_id: { type: "string", description: "Filter by Bill id or external_id" },
            knesset_number: { type: "integer", description: "Filter by Knesset number" },
            result: { type: "string", enum: ["passed", "rejected", "unknown"] },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        mk_id,
        bill_id,
        knesset_number,
        result,
        page = 1,
        limit = 20,
      } = request.query as {
        mk_id?: string;
        bill_id?: string;
        knesset_number?: number;
        result?: string;
        page?: number;
        limit?: number;
      };

      const cacheKey = buildCacheKey("votes", {
        mk_id,
        bill_id,
        knesset_number,
        result,
        page,
        limit,
      });
      const data = await getCached(cacheKey, CACHE_TTL.SHORT, () =>
        listVotes({ mk_id, bill_id, knesset_number, result, page, limit }),
      );

      reply.send({
        ...data,
        page,
        limit,
        pages: Math.ceil(data.total / limit),
      });
    },
  );

  app.get(
    "/api/votes/:id",
    {
      schema: {
        description: "Get vote detail with all MK vote records",
        tags: ["Votes"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const cacheKey = buildCacheKey("vote", { id });
      const result = await getCached(cacheKey, CACHE_TTL.MEDIUM, () => getVoteById(id));

      if (!result) {
        return reply
          .code(404)
          .send({ error: "Not Found", message: "Vote not found", statusCode: 404 });
      }

      reply.send({ data: result });
    },
  );
}
