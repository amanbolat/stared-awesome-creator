import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { DEFAULT_CACHE_PATH, SQLiteCache } from "./cache/sqlite.js";
import { loadConfig, resolveConfigPath } from "./config/index.js";
import { GitHubClient } from "./github/client.js";
import { fetchStarsWithCache } from "./github/stars.js";
import { createParserRegistry } from "./parsers/index.js";
import { renderList } from "./renderer/table.js";
import { parseGitHubRepo, repoKey, type RepoRef } from "./utils/github.js";

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
const parser = registry.get(list.parser);
const markdown = await client.fetchFile({
  owner: list.source.owner,
  repo: list.source.repo,
  path: list.source.path ?? "README.md",
  branch: list.source.branch
});

const parsed = parser.parse(markdown, list.parserOptions);
parsed.title = parsed.title ?? list.name ?? list.id;

const repoRefs: RepoRef[] = [];
const itemRepoMap = new Map<string, RepoRef>();

for (const category of parsed.categories) {
  for (const item of category.items) {
    const repo = parseGitHubRepo(item.url);
    if (repo) {
      repoRefs.push(repo);
      itemRepoMap.set(item.url, repo);
    }
  }
}

const stars = await fetchStarsWithCache(client, cache, repoRefs);

for (const category of parsed.categories) {
  for (const item of category.items) {
    const repo = itemRepoMap.get(item.url);
    if (repo) {
      item.stars = stars.get(repoKey(repo)) ?? null;
    } else {
      item.stars = null;
    }
  }
  sortItems(category.items);
}

const output = renderList(parsed);

if (dryRun) {
  await fs.mkdir(outputDir, { recursive: true });
  const fileName = `${list.id}.md`;
  const outputPath = path.join(outputDir, fileName);
  await fs.writeFile(outputPath, output, "utf-8");
} else {
  await client.updateFile(
    {
      owner: list.output.owner,
      repo: list.output.repo,
      path: list.output.path ?? "README.md",
      branch: list.output.branch
    },
    output,
    `chore: update ${list.id} stars`
  );
}

cache.close();

function sortItems(items: Array<{ stars?: number | null; name: string }>): void {
  items.sort((a, b) => {
    const left = a.stars ?? -1;
    const right = b.stars ?? -1;
    if (right !== left) {
      return right - left;
    }
    return a.name.localeCompare(b.name);
  });
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
}
