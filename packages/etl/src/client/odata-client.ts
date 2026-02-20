/**
 * OData Client
 *
 * Typed client with:
 * - Pagination support ($top/$skip and @odata.nextLink)
 * - Exponential backoff retry (p-retry)
 * - Concurrency control (p-limit)
 * - Rate limiting (polite delay between requests)
 * - SSRF guard
 */

import pRetry from "p-retry";
import type { ODataMetadata, ODataResponse } from "@knesset-vote/shared";
import { ETL_PAGE_SIZE, ETL_REQUEST_DELAY_MS, ETL_RETRY_MAX } from "@knesset-vote/shared";
import { safeFetch } from "./ssrf-guard.js";
import { logger } from "../logger.js";

export interface ODataQueryOptions {
  $top?: number;
  $skip?: number;
  $filter?: string;
  $orderby?: string;
  $expand?: string;
  $select?: string;
  $count?: boolean;
}

export class ODataClient {
  constructor(private readonly metadata: ODataMetadata) {}

  /**
   * Fetch ALL pages for an entity set, following nextLink automatically.
   */
  async *fetchAllPages<T>(
    entitySetName: string,
    options: ODataQueryOptions = {},
  ): AsyncGenerator<T[]> {
    const entitySet = this.metadata.entitySets.find((es) => es.name === entitySetName);
    if (!entitySet) {
      logger.warn({ entitySetName }, "Entity set not found in metadata - skipping");
      return;
    }

    let url: string | null = this.buildUrl(entitySet.url, {
      $top: ETL_PAGE_SIZE,
      $skip: 0,
      ...options,
    });

    let pageCount = 0;

    while (url) {
      const currentUrl = url;
      const page = await pRetry(
        async () => {
          logger.debug({ url: currentUrl, page: pageCount + 1 }, "Fetching OData page");
          const res = await safeFetch(currentUrl, {
            headers: {
              Accept: "application/json",
              "OData-MaxVersion": "4.0",
              "OData-Version": "4.0",
            },
          });

          if (res.status === 429 || res.status >= 500) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }

          if (!res.ok) {
            throw new pRetry.AbortError(
              `Non-retryable HTTP ${res.status}: ${res.statusText} for ${currentUrl}`,
            );
          }

          const data = (await res.json()) as ODataResponse<T>;
          return data;
        },
        {
          retries: ETL_RETRY_MAX,
          onFailedAttempt: (error) => {
            logger.warn(
              {
                url: currentUrl,
                attempt: error.attemptNumber,
                retriesLeft: error.retriesLeft,
                error: error.message,
              },
              "OData fetch failed, retrying",
            );
          },
          minTimeout: 1000,
          maxTimeout: 30_000,
          factor: 2,
        },
      );

      if (page.value && page.value.length > 0) {
        yield page.value;
        pageCount++;
      }

      // Follow nextLink or stop
      const nextLink = page["@odata.nextLink"];
      if (nextLink) {
        // nextLink might be absolute or relative
        url = nextLink.startsWith("http") ? nextLink : `${this.metadata.baseUrl}/${nextLink}`;
      } else if (page.value && page.value.length === ETL_PAGE_SIZE) {
        // No nextLink but full page: try next skip
        const currentSkip = options.$skip ?? 0;
        const top = options.$top ?? ETL_PAGE_SIZE;
        url = this.buildUrl(entitySet.url, {
          ...options,
          $top: top,
          $skip: currentSkip + top * pageCount,
        });
      } else {
        url = null;
      }

      // Polite delay between requests
      if (url) {
        await sleep(ETL_REQUEST_DELAY_MS);
      }
    }

    logger.info({ entitySetName, pageCount }, "Completed fetching entity set");
  }

  /**
   * Fetch a single entity by ID.
   */
  async fetchOne<T>(entitySetName: string, id: string | number): Promise<T | null> {
    const entitySet = this.metadata.entitySets.find((es) => es.name === entitySetName);
    if (!entitySet) {
      logger.warn({ entitySetName }, "Entity set not found in metadata");
      return null;
    }

    const url = `${entitySet.url}(${id})`;

    try {
      const res = await pRetry(
        async () => {
          const r = await safeFetch(url, {
            headers: { Accept: "application/json" },
          });
          if (r.status === 404) return null;
          if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
          return r;
        },
        { retries: ETL_RETRY_MAX, minTimeout: 1000, factor: 2 },
      );

      if (!res) return null;
      return (await (res as Response).json()) as T;
    } catch (err) {
      logger.error({ url, err }, "Failed to fetch single entity");
      return null;
    }
  }

  private buildUrl(baseUrl: string, options: ODataQueryOptions): string {
    const params = new URLSearchParams();

    if (options.$top !== undefined) params.set("$top", String(options.$top));
    if (options.$skip !== undefined) params.set("$skip", String(options.$skip));
    if (options.$filter) params.set("$filter", options.$filter);
    if (options.$orderby) params.set("$orderby", options.$orderby);
    if (options.$expand) params.set("$expand", options.$expand);
    if (options.$select) params.set("$select", options.$select);
    if (options.$count) params.set("$count", "true");

    const paramStr = params.toString();
    return paramStr ? `${baseUrl}?${paramStr}` : baseUrl;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
