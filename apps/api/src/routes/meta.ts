import type { FastifyInstance } from "fastify";
import { db } from "@knesset-vote/db";
import { getCached, buildCacheKey } from "../plugins/redis.js";
import { CACHE_TTL } from "@knesset-vote/shared";

export async function metaRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/meta",
    {
      schema: {
        description: "Data source metadata, last sync info, and methodology link",
        tags: ["System"],
      },
    },
    async (_, reply) => {
      const data = await getCached(
        buildCacheKey("meta", {}),
        CACHE_TTL.MEDIUM,
        async () => {
          const lastRun = await db.eTLRun.findFirst({
            orderBy: { started_at: "desc" },
            select: {
              id: true,
              started_at: true,
              completed_at: true,
              status: true,
              counts_json: true,
              errors_json: true,
              entity_sets_discovered: true,
              source: true,
            },
          });

          const lastSuccessfulRun = await db.eTLRun.findFirst({
            where: { status: "completed" },
            orderBy: { completed_at: "desc" },
            select: { completed_at: true },
          });

          return {
            data_sources: [
              {
                name: "Knesset OData API",
                base_url:
                  process.env["KNESSET_ODATA_BASE_URL"] ??
                  "https://knesset.gov.il/Odata/ParliamentInfo.svc",
                type: "odata_v3",
                last_successful_sync:
                  lastSuccessfulRun?.completed_at?.toISOString() ?? null,
                entity_sets_discovered: Array.isArray(lastRun?.entity_sets_discovered)
                  ? (lastRun.entity_sets_discovered as string[])
                  : [],
              },
            ],
            last_updated: lastSuccessfulRun?.completed_at?.toISOString() ?? null,
            etl_summary: lastRun
              ? {
                  last_run_id: lastRun.id,
                  started_at: lastRun.started_at.toISOString(),
                  completed_at: lastRun.completed_at?.toISOString() ?? null,
                  status: lastRun.status as "running" | "completed" | "failed" | "partial",
                  counts: (lastRun.counts_json as Record<string, number>) ?? {},
                  errors: (lastRun.errors_json as string[]) ?? [],
                }
              : null,
            methodology_url: `${process.env["WEB_URL"] ?? "http://localhost:3000"}/methodology`,
            knesset_home_url: "https://www.knesset.gov.il",
            knesset_odata_url:
              process.env["KNESSET_ODATA_BASE_URL"] ??
              "https://knesset.gov.il/Odata/ParliamentInfo.svc",
            disclaimer:
              "This is an independent project. Not affiliated with or endorsed by the Knesset.",
          };
        },
      );

      reply.send(data);
    },
  );
}
