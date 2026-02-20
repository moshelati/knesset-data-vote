import crypto from "crypto";
import { db } from "@knesset-vote/db";
import { logger } from "../logger.js";

export function hashPayload(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function saveSnapshot(opts: {
  entityType: string;
  entityId: string;
  externalSource: string;
  externalId: string;
  etlRunId: string;
  payload: unknown;
}): Promise<void> {
  const { entityType, entityId, externalSource, externalId, etlRunId, payload } = opts;

  try {
    const payloadStr = JSON.stringify(payload);
    const hash = hashPayload(payload);

    await db.rawSnapshot.create({
      data: {
        entity_type: entityType,
        entity_id: entityId,
        external_source: externalSource,
        external_id: externalId,
        etl_run_id: etlRunId,
        payload_json: payload as object,
        payload_hash: hash,
        payload_size: payloadStr.length,
      },
    });
  } catch (err) {
    // Non-fatal: log but don't fail the sync
    logger.warn({ entityType, entityId, err }, "Failed to save snapshot - continuing");
  }
}
