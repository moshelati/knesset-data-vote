import { db } from "@knesset-vote/db";
import type { ETLRunResult } from "@knesset-vote/shared";
import { logger } from "../logger.js";

export class ETLRunTracker {
  private runId: string = "";
  private counts: ETLRunResult["counts"] = {};
  private errors: string[] = [];
  private startedAt = new Date();

  async start(source: string): Promise<string> {
    this.startedAt = new Date();
    this.counts = {};
    this.errors = [];

    const run = await db.eTLRun.create({
      data: {
        status: "running",
        source,
        commit_hash: process.env["COMMIT_HASH"] ?? null,
        source_version: new Date().toISOString(),
      },
    });

    this.runId = run.id;
    logger.info({ runId: this.runId, source }, "ETL run started");
    return this.runId;
  }

  initEntity(entityType: string): void {
    if (!this.counts[entityType]) {
      this.counts[entityType] = { fetched: 0, created: 0, updated: 0, failed: 0 };
    }
  }

  increment(
    entityType: string,
    field: "fetched" | "created" | "updated" | "failed",
  ): void {
    this.initEntity(entityType);
    this.counts[entityType]![field]++;
  }

  addError(message: string): void {
    this.errors.push(message);
    logger.error({ message }, "ETL error recorded");
  }

  async updateEntitySets(entitySets: string[]): Promise<void> {
    await db.eTLRun.update({
      where: { id: this.runId },
      data: { entity_sets_discovered: entitySets },
    });
  }

  async complete(status: "completed" | "failed" | "partial"): Promise<ETLRunResult> {
    const completedAt = new Date();
    const latencyMs = completedAt.getTime() - this.startedAt.getTime();

    await db.eTLRun.update({
      where: { id: this.runId },
      data: {
        status,
        completed_at: completedAt,
        counts_json: this.counts as object,
        errors_json: this.errors,
        latency_ms: latencyMs,
      },
    });

    const result: ETLRunResult = {
      runId: this.runId,
      startedAt: this.startedAt,
      completedAt,
      status,
      source: "knesset_odata",
      counts: this.counts,
      errors: this.errors,
      latencyMs,
    };

    logger.info(result, "ETL run completed");
    return result;
  }

  getRunId(): string {
    return this.runId;
  }

  getSummary(): { counts: ETLRunResult["counts"]; errors: string[] } {
    return { counts: this.counts, errors: this.errors };
  }
}
