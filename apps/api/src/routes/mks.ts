import type { FastifyInstance } from "fastify";
import { listMKs, getMKById } from "../services/mk-service.js";
import { getCached, buildCacheKey } from "../plugins/redis.js";
import { CACHE_TTL } from "@knesset-vote/shared";

export async function mkRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/mks",
    {
      schema: {
        description: "List Members of Knesset with optional filters",
        tags: ["MKs"],
        querystring: {
          type: "object",
          properties: {
            search: { type: "string", maxLength: 200 },
            party_id: { type: "string" },
            is_current: { type: "boolean", default: true },
            knesset_number: { type: "integer" },
            sort: { type: "string", enum: ["name", "bills", "party"] },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        search,
        party_id,
        is_current = true,
        knesset_number,
        sort,
        page = 1,
        limit = 20,
      } = request.query as {
        search?: string;
        party_id?: string;
        is_current?: boolean;
        knesset_number?: number;
        sort?: string;
        page?: number;
        limit?: number;
      };

      const cacheKey = buildCacheKey("mks", {
        search,
        party_id,
        is_current,
        knesset_number,
        sort,
        page,
        limit,
      });
      const result = await getCached(cacheKey, CACHE_TTL.SHORT, () =>
        listMKs({ search, party_id, is_current, knesset_number, sort, page, limit }),
      );

      reply.send({
        ...result,
        page,
        limit,
        pages: Math.ceil(result.total / limit),
        methodology_url: "/methodology#mks",
      });
    },
  );

  app.get(
    "/api/mks/:id",
    {
      schema: {
        description: "Get MK profile with activity metrics, memberships, and bills",
        tags: ["MKs"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const cacheKey = buildCacheKey("mk", { id });

      const mk = await getCached(cacheKey, CACHE_TTL.SHORT, () => getMKById(id));

      if (!mk) {
        reply.code(404).send({ error: "Not Found", message: "MK not found", statusCode: 404 });
        return;
      }

      reply.send({
        data: mk,
        methodology_url: "/methodology#mks",
        computed_fields: {
          activity_metrics: {
            definition:
              "Bills: count of bills where MK is listed as initiator or co-sponsor in Knesset OData",
            limitations:
              "Votes data may be incomplete. Committee meetings counted from current memberships only.",
            confidence_note:
              "'High confidence' means a direct source link from Knesset OData exists.",
          },
        },
      });
    },
  );
}
