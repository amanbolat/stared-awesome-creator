import { chunkArray } from "../utils/arrays.js";
import { repoKey, type RepoRef } from "../utils/github.js";
import { SQLiteCache } from "../cache/sqlite.js";
import { GitHubClient } from "./client.js";

export type StarFetchOptions = {
  batchSize?: number;
};

const DEFAULT_BATCH_SIZE = 25;

export async function fetchStarsWithCache(
  client: GitHubClient,
  cache: SQLiteCache,
  repos: RepoRef[],
  options: StarFetchOptions = {}
): Promise<Map<string, number>> {
  const unique = new Map<string, RepoRef>();
  for (const repo of repos) {
    unique.set(repoKey(repo), repo);
  }

  const results = new Map<string, number>();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

  for (const batch of chunkArray([...unique.values()], batchSize)) {
    try {
      const { stars } = await client.fetchStarsBatch(batch);
      for (const [key, count] of stars.entries()) {
        results.set(key, count);
        cache.set(key, count);
      }

      for (const repo of batch) {
        const key = repoKey(repo);
        if (!results.has(key)) {
          const cached = cache.get(key);
          if (cached !== null) {
            results.set(key, cached);
          }
        }
      }
    } catch {
      for (const repo of batch) {
        const key = repoKey(repo);
        const cached = cache.get(key);
        if (cached !== null) {
          results.set(key, cached);
        }
      }
    }
  }

  return results;
}
