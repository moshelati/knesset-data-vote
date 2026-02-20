import type { FastifyInstance } from "fastify";
import { db } from "@knesset-vote/db";
import { getCached, buildCacheKey } from "../plugins/redis.js";
import { CACHE_TTL } from "@knesset-vote/shared";

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/search",
    {
      schema: {
        description: "Unified search across MKs, parties, and bills",
        tags: ["Search"],
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string", minLength: 1, maxLength: 200 },
            type: {
              type: "string",
              enum: ["mk", "party", "bill", "all"],
              default: "all",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { q, type = "all" } = request.query as { q: string; type?: string };

      const cacheKey = buildCacheKey("search", { q, type });
      const results = await getCached(cacheKey, CACHE_TTL.SHORT, async () => {
        const searchResults: Array<{
          type: string;
          id: string;
          title: string;
          subtitle: string | null;
          url: string;
          source_url: string | null;
        }> = [];

        // Search MKs
        if (type === "all" || type === "mk") {
          const mks = await db.mK.findMany({
            where: {
              OR: [
                { name_he: { contains: q } },
                { name_en: { contains: q, mode: "insensitive" } },
                { name_last_he: { contains: q } },
              ],
            },
            take: 10,
            include: {
              memberships: {
                where: { is_current: true },
                include: { party: { select: { name_he: true } } },
                take: 1,
              },
            },
          });

          for (const mk of mks) {
            searchResults.push({
              type: "mk",
              id: mk.id,
              title: mk.name_he,
              subtitle: mk.memberships[0]?.party.name_he ?? null,
              url: `/mks/${mk.id}`,
              source_url: mk.source_url,
            });
          }
        }

        // Search parties
        if (type === "all" || type === "party") {
          const parties = await db.party.findMany({
            where: {
              OR: [
                { name_he: { contains: q } },
                { name_en: { contains: q, mode: "insensitive" } },
                { abbreviation: { contains: q, mode: "insensitive" } },
              ],
            },
            take: 10,
          });

          for (const party of parties) {
            searchResults.push({
              type: "party",
              id: party.id,
              title: party.name_he,
              subtitle: party.name_en,
              url: `/parties/${party.id}`,
              source_url: party.source_url,
            });
          }
        }

        // Search bills
        if (type === "all" || type === "bill") {
          const bills = await db.bill.findMany({
            where: {
              OR: [
                { title_he: { contains: q } },
                { title_en: { contains: q, mode: "insensitive" } },
                { description_he: { contains: q } },
              ],
            },
            take: 10,
          });

          for (const bill of bills) {
            searchResults.push({
              type: "bill",
              id: bill.id,
              title: bill.title_he,
              subtitle: bill.title_en,
              url: `/bills/${bill.id}`,
              source_url: bill.source_url,
            });
          }
        }

        return searchResults;
      });

      reply.send({
        data: results,
        query: q,
        total: results.length,
      });
    },
  );
}
