import fs from "node:fs/promises";
import path from "node:path";

import type { SQLiteCache } from "./cache/sqlite.js";
import type { ResolvedListConfig } from "./config/types.js";
import type { GitHubFileRef } from "./github/client.js";
import { fetchStarsWithCache, type StarClient } from "./github/stars.js";
import type { ParserRegistry } from "./parsers/registry.js";
import { renderList } from "./renderer/table.js";
import { parseGitHubRepo, repoKey, type RepoRef } from "./utils/github.js";
import { sortItemsByStars } from "./utils/sort.js";

export type GitHubClientLike = StarClient & {
  fetchFile(ref: GitHubFileRef): Promise<string>;
  updateFile(ref: GitHubFileRef, content: string, message: string): Promise<void>;
};

export type WorkflowOptions = {
  list: ResolvedListConfig;
  parserRegistry: ParserRegistry;
  client: GitHubClientLike;
  cache: SQLiteCache;
  dryRun: boolean;
  outputDir: string;
};

export type WorkflowResult = {
  output: string;
  outputPath?: string;
};

export async function runWorkflow(options: WorkflowOptions): Promise<WorkflowResult> {
  const { list, parserRegistry, client, cache, dryRun, outputDir } = options;

  const parser = parserRegistry.get(list.parser);
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

  const stars = await fetchStarsWithCache(client, cache, repoRefs, {
    cacheMaxAgeSeconds: list.cache.ttlSeconds
  });

  for (const category of parsed.categories) {
    for (const item of category.items) {
      const repo = itemRepoMap.get(item.url);
      if (repo) {
        item.stars = stars.get(repoKey(repo)) ?? null;
      } else {
        item.stars = null;
      }
    }
    sortItemsByStars(category.items);
  }

  const output = renderList(parsed);

  if (dryRun) {
    await fs.mkdir(outputDir, { recursive: true });
    const fileName = `${list.id}.md`;
    const outputPath = path.join(outputDir, fileName);
    await fs.writeFile(outputPath, output, "utf-8");
    return { output, outputPath };
  }

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

  return { output };
}
