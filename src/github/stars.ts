import { chunkArray } from "../utils/arrays.js";
import { createLimiter, sleep } from "../utils/async.js";
import { repoKey, type RepoRef } from "../utils/github.js";
import { SQLiteCache } from "../cache/sqlite.js";

export type RepoStats = {
  stars: number;
  lastCommitAt?: string | null;
};

export type RepoStatsClient = {
  fetchRepoStatsBatch(
    repos: RepoRef[]
  ): Promise<{ stats: Map<string, RepoStats>; rateLimit?: { remaining: number; resetAt: string; cost?: number } }>;
};

export type RepoStatsFetchOptions = {
  batchSize?: number;
  concurrency?: number;
  retries?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
  logRateLimit?: boolean;
  cacheMaxAgeSeconds?: number;
};

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;
const DEFAULT_MAX_RETRY_DELAY_MS = 4000;
const DEFAULT_CACHE_MAX_AGE_SECONDS = 60 * 60;

export async function fetchRepoStatsWithCache(
  client: RepoStatsClient,
  cache: SQLiteCache,
  repos: RepoRef[],
  options: RepoStatsFetchOptions = {}
): Promise<Map<string, RepoStats>> {
  const unique = new Map<string, RepoRef>();
  for (const repo of repos) {
    unique.set(repoKey(repo), repo);
  }

  const results = new Map<string, RepoStats>();
  const cacheMaxAgeSeconds =
    options.cacheMaxAgeSeconds ?? DEFAULT_CACHE_MAX_AGE_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const toFetch: RepoRef[] = [];

  for (const [key, repo] of unique.entries()) {
    if (cacheMaxAgeSeconds > 0) {
      const cached = cache.getEntry(key);
      if (cached && now - cached.updatedAt <= cacheMaxAgeSeconds) {
        results.set(key, {
          stars: cached.stars,
          lastCommitAt: cached.lastCommitAt
        });
        continue;
      }
    }
    toFetch.push(repo);
  }

  if (toFetch.length === 0) {
    return results;
  }

  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const limiter = createLimiter(concurrency);
  const logRateLimit = options.logRateLimit ?? true;

  const batches = chunkArray(toFetch, batchSize);
  const tasks = batches.map((batch) =>
    limiter(async () => {
      await processBatch(client, cache, batch, results, {
        retries: options.retries ?? DEFAULT_RETRIES,
        retryDelayMs: options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
        maxRetryDelayMs: options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS,
        logRateLimit
      });
    })
  );

  await Promise.all(tasks);

  return results;
}

type BatchOptions = {
  retries: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  logRateLimit: boolean;
};

async function processBatch(
  client: RepoStatsClient,
  cache: SQLiteCache,
  batch: RepoRef[],
  results: Map<string, RepoStats>,
  options: BatchOptions
): Promise<void> {
  try {
    const response = await fetchBatchWithRetry(client, batch, options);
    for (const [key, stats] of response.stats.entries()) {
      results.set(key, stats);
      cache.set(key, stats.stars, stats.lastCommitAt ?? null);
    }

    if (options.logRateLimit && response.rateLimit) {
      console.info(
        `rate-limit remaining=${response.rateLimit.remaining} resetAt=${response.rateLimit.resetAt} cost=${response.rateLimit.cost ?? "n/a"}`
      );
    }
  } catch (error) {
    console.warn(`failed to fetch batch (${batch.length} repos): ${(error as Error).message}`);
  } finally {
    for (const repo of batch) {
      const key = repoKey(repo);
      if (!results.has(key)) {
        const cached = cache.getEntry(key);
        if (cached) {
          results.set(key, {
            stars: cached.stars,
            lastCommitAt: cached.lastCommitAt
          });
        }
      }
    }
  }
}

async function fetchBatchWithRetry(
  client: RepoStatsClient,
  batch: RepoRef[],
  options: BatchOptions
): Promise<{ stats: Map<string, RepoStats>; rateLimit?: { remaining: number; resetAt: string; cost?: number } }> {
  let attempt = 0;
  let delay = options.retryDelayMs;

  while (true) {
    try {
      return await client.fetchRepoStatsBatch(batch);
    } catch (error) {
      attempt += 1;
      if (attempt > options.retries) {
        throw error;
      }
      await sleep(delay);
      delay = Math.min(delay * 2, options.maxRetryDelayMs);
    }
  }
}
