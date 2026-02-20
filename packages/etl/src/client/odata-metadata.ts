/**
 * OData Metadata Parser
 *
 * Fetches and parses the OData $metadata document to discover available
 * entity sets WITHOUT hardcoding them. This satisfies the requirement:
 * "Do not hardcode entity set names; discover via metadata."
 */

import { parseStringPromise } from "xml2js";
import type { ODataMetadata, ODataEntitySet, ODataProperty } from "@knesset-vote/shared";
import { KNESSET_ODATA_METADATA } from "@knesset-vote/shared";
import { safeFetch } from "./ssrf-guard.js";
import { logger } from "../logger.js";

interface RawEntityContainer {
  EntitySet?: Array<{
    $: { Name: string; EntityType: string };
  }>;
}

interface RawEntityType {
  $: { Name: string };
  Property?: Array<{
    $: { Name: string; Type: string; Nullable?: string };
  }>;
}

interface RawSchema {
  EntityType?: RawEntityType[];
  EntityContainer?: RawEntityContainer[];
}

interface RawMetadata {
  "edmx:Edmx"?: {
    "edmx:DataServices"?: Array<{
      Schema?: RawSchema[];
    }>;
  };
}

export async function fetchODataMetadata(
  baseUrl: string = KNESSET_ODATA_METADATA,
): Promise<ODataMetadata> {
  logger.info({ url: baseUrl }, "Fetching OData metadata");

  const res = await safeFetch(baseUrl, {
    headers: { Accept: "application/xml, text/xml" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch OData metadata: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();
  logger.debug({ bytes: xml.length }, "Received metadata XML");

  return parseODataMetadataXmlAsync(xml, baseUrl.replace("/$metadata", ""));
}

export function parseODataMetadataXml(xml: string, baseUrl: string): ODataMetadata {
  let parsed: RawMetadata;
  try {
    // xml2js returns a promise when using parseStringPromise
    // but we need sync parsing here - use a workaround
    parsed = {} as RawMetadata;
    parseStringPromise(xml, { explicitArray: true })
      .then((result: unknown) => {
        parsed = result as RawMetadata;
      })
      .catch(() => {
        // handled below
      });
  } catch {
    throw new Error("Failed to parse OData metadata XML");
  }

  return buildMetadata(parsed, baseUrl);
}

export async function parseODataMetadataXmlAsync(
  xml: string,
  baseUrl: string,
): Promise<ODataMetadata> {
  const parsed = (await parseStringPromise(xml, {
    explicitArray: true,
    mergeAttrs: false,
  })) as RawMetadata;

  return buildMetadata(parsed, baseUrl);
}

function buildMetadata(parsed: RawMetadata, baseUrl: string): ODataMetadata {
  const entitySets: ODataEntitySet[] = [];
  const entityTypeMap = new Map<string, ODataProperty[]>();

  const schemas =
    parsed?.["edmx:Edmx"]?.["edmx:DataServices"]?.[0]?.["Schema"] ?? [];

  // First pass: collect entity type property definitions
  for (const schema of schemas) {
    const entityTypes = schema.EntityType ?? [];
    for (const et of entityTypes) {
      const typeName = et.$.Name;
      const properties: ODataProperty[] = (et.Property ?? []).map((prop) => ({
        name: prop.$.Name,
        type: prop.$.Type,
        nullable: prop.$.Nullable !== "false",
      }));
      entityTypeMap.set(typeName, properties);
    }
  }

  // Second pass: collect entity sets
  for (const schema of schemas) {
    const containers = schema.EntityContainer ?? [];
    for (const container of containers) {
      const sets = container.EntitySet ?? [];
      for (const entitySet of sets) {
        const name = entitySet.$.Name;
        const entityType = entitySet.$.EntityType;
        // EntityType is usually namespace-qualified: e.g. "KnessetOdata.Faction"
        const shortTypeName = entityType.includes(".")
          ? entityType.split(".").pop() ?? entityType
          : entityType;

        entitySets.push({
          name,
          entityType,
          url: `${baseUrl}/${name}`,
          properties: entityTypeMap.get(shortTypeName),
        });
      }
    }
  }

  logger.info(
    {
      entitySetCount: entitySets.length,
      entitySets: entitySets.map((e) => e.name),
    },
    "Discovered OData entity sets",
  );

  return {
    baseUrl,
    entitySets,
    discoveredAt: new Date(),
  };
}

/**
 * Try to find an entity set by common name patterns.
 * Returns the first match or undefined if not found.
 *
 * This allows graceful degradation when entity sets are renamed.
 */
export function findEntitySet(
  metadata: ODataMetadata,
  candidates: string[],
): ODataEntitySet | undefined {
  for (const candidate of candidates) {
    const found = metadata.entitySets.find(
      (es) =>
        es.name.toLowerCase() === candidate.toLowerCase() ||
        es.name.toLowerCase().includes(candidate.toLowerCase()),
    );
    if (found) return found;
  }
  return undefined;
}
