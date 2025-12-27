import fs from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";

import { configSchema } from "./schema.js";
import type {
  DefaultsConfig,
  RawConfig,
  ResolvedConfig,
  ResolvedListConfig,
  TableConfig
} from "./types.js";

const DEFAULT_TABLE: TableConfig = {
  columns: ["stars", "name", "description"],
  sort: "stars_desc"
};

const DEFAULTS: Required<DefaultsConfig> = {
  source: {
    branch: "main",
    path: "README.md"
  },
  output: {
    branch: "main",
    path: "README.md",
    repoSuffix: "-with-stars"
  },
  parser: "default",
  parserOptions: {
    headingDepths: [2, 3]
  },
  table: DEFAULT_TABLE,
  cache: {
    ttlSeconds: 60 * 60
  },
  toc: false
};

export async function loadConfig(configPath: string): Promise<ResolvedConfig> {
  const raw = await fs.readFile(configPath, "utf-8");
  const parsed = configSchema.parse(yaml.parse(raw)) as RawConfig;

  const mergedDefaults: Required<DefaultsConfig> = {
    source: { ...DEFAULTS.source, ...parsed.defaults?.source },
    output: { ...DEFAULTS.output, ...parsed.defaults?.output },
    parser: parsed.defaults?.parser ?? DEFAULTS.parser,
    parserOptions: {
      ...DEFAULTS.parserOptions,
      ...parsed.defaults?.parserOptions
    },
    table: parsed.defaults?.table ?? DEFAULTS.table,
    cache: {
      ttlSeconds: parsed.defaults?.cache?.ttlSeconds ?? DEFAULTS.cache.ttlSeconds
    },
    toc: parsed.defaults?.toc ?? DEFAULTS.toc
  };

  const list = parsed.list;
  const outputOwner = list.output?.owner ?? mergedDefaults.output.owner;
  if (!outputOwner) {
    throw new Error(
      `Missing output.owner for list ${list.id}. Set defaults.output.owner or list.output.owner.`
    );
  }

  const outputRepo =
    list.output?.repo ?? `${list.source.repo}${mergedDefaults.output.repoSuffix}`;

  const resolvedList: ResolvedListConfig = {
    id: list.id,
    name: list.name,
    header: list.header,
    source: {
      ...mergedDefaults.source,
      ...list.source
    },
    output: {
      owner: outputOwner,
      repo: outputRepo,
      branch: list.output?.branch ?? mergedDefaults.output.branch,
      path: list.output?.path ?? mergedDefaults.output.path
    },
    parser: list.parser ?? mergedDefaults.parser,
    parserOptions: {
      ...mergedDefaults.parserOptions,
      ...list.parserOptions
    },
    table: list.table ?? mergedDefaults.table,
    cache: {
      ttlSeconds: list.cache?.ttlSeconds ?? mergedDefaults.cache.ttlSeconds
    },
    toc: list.toc ?? mergedDefaults.toc
  };

  return {
    version: parsed.version,
    defaults: mergedDefaults,
    list: resolvedList
  };
}

export function resolveConfigPath(configPath?: string): string {
  if (configPath) {
    return configPath;
  }

  return path.resolve("configs", "list.yml");
}
