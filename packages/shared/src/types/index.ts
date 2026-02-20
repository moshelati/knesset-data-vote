export interface ODataMetadata {
  baseUrl: string;
  entitySets: ODataEntitySet[];
  discoveredAt: Date;
}

export interface ODataEntitySet {
  name: string;
  entityType: string;
  url: string;
  properties?: ODataProperty[];
}

export interface ODataProperty {
  name: string;
  type: string;
  nullable?: boolean;
}

export interface ODataResponse<T> {
  value: T[];
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
}

export interface ETLRunResult {
  runId: string;
  startedAt: Date;
  completedAt?: Date;
  status: "running" | "completed" | "failed" | "partial";
  source: string;
  sourceVersion?: string;
  commitHash?: string;
  counts: {
    [entityType: string]: {
      fetched: number;
      created: number;
      updated: number;
      failed: number;
    };
  };
  errors: string[];
  latencyMs?: number;
}

export interface SyncOptions {
  entityTypes?: string[];
  forceFullSync?: boolean;
  dryRun?: boolean;
  concurrency?: number;
}
