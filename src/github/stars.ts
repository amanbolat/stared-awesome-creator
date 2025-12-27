import { chunkArray } from "../utils/arrays.js";
import { createLimiter, sleep } from "../utils/async.js";
import { repoKey, type RepoRef } from "../utils/github.js";
import { SQLiteCache } from "../cache/sqlite.js";
export type StarClient = {
  fetchStarsBatch(
    repos: RepoRef[]
  ): Promise<{ stars: Map<string, number>; rateLimit?: { remaining: number; resetAt: string; cost?: number } }>;
};

export type StarFetchOptions = {
  batchSize?: number;
  concurrency?: number;
  retries?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
  logRateLimit?: boolean;
};

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;
const DEFAULT_MAX_RETRY_DELAY_MS = 4000;

export async function fetchStarsWithCache(
  client: StarClient,
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
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const limiter = createLimiter(concurrency);
  const logRateLimit = options.logRateLimit ?? true;

  const batches = chunkArray([...unique.values()], batchSize);
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
  client: StarClient,
  cache: SQLiteCache,
  batch: RepoRef[],
  results: Map<string, number>,
  options: BatchOptions
): Promise<void> {
  try {
    const response = await fetchBatchWithRetry(client, batch, options);
    for (const [key, count] of response.stars.entries()) {
      results.set(key, count);
      cache.set(key, count);
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
        const cached = cache.get(key);
        if (cached !== null) {
          results.set(key, cached);
        }
      }
    }
  }
}

async function fetchBatchWithRetry(
  client: StarClient,
  batch: RepoRef[],
  options: BatchOptions
): Promise<{ stars: Map<string, number>; rateLimit?: { remaining: number; resetAt: string; cost?: number } }> {
  let attempt = 0;
  let delay = options.retryDelayMs;

  while (true) {
    try {
      return await client.fetchStarsBatch(batch);
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
