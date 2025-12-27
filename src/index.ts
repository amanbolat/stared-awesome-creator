import { parseArgs } from "node:util";

import { DEFAULT_CACHE_PATH, SQLiteCache } from "./cache/sqlite.js";
import { loadConfig, resolveConfigPath } from "./config/index.js";
import { GitHubClient } from "./github/client.js";
import { createParserRegistry } from "./parsers/index.js";
import { runWorkflow } from "./workflow.js";

const ENV_TOKEN = "GITHUB_TOKEN";
const ENV_CACHE_PATH = "STAR_CACHE_PATH";
const ENV_DRY_RUN = "DRY_RUN";
const ENV_DRY_RUN_DIR = "DRY_RUN_DIR";

const { values } = parseArgs({
  options: {
    config: { type: "string", short: "c" },
    dryRun: { type: "boolean" },
    outputDir: { type: "string" },
    cachePath: { type: "string" }
  }
});

const configPath = resolveConfigPath(values.config);
const dryRun = values.dryRun ?? parseBoolean(process.env[ENV_DRY_RUN]);
const outputDir = values.outputDir ?? process.env[ENV_DRY_RUN_DIR] ?? "./out";
const cachePath = values.cachePath ?? process.env[ENV_CACHE_PATH] ?? DEFAULT_CACHE_PATH;

const token = process.env[ENV_TOKEN];
if (!token) {
  throw new Error(`${ENV_TOKEN} is required`);
}

const config = await loadConfig(configPath);
const registry = createParserRegistry();
const client = new GitHubClient(token);
const cache = new SQLiteCache(cachePath);

const list = config.list;
await runWorkflow({
  list,
  parserRegistry: registry,
  client,
  cache,
  dryRun,
  outputDir
});

cache.close();

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
}
