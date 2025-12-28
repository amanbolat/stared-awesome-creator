import test from "node:test";
import assert from "node:assert/strict";

import { SQLiteCache } from "../src/cache/sqlite.ts";
import { fetchRepoStatsWithCache } from "../src/github/stars.ts";
import { repoKey, type RepoRef } from "../src/utils/github.ts";

type BatchResponse = {
  stats: Map<string, { stars: number; lastCommitAt?: string | null }>;
};

class FakeGitHubClient {
  responses: (Error | ((batch: RepoRef[]) => BatchResponse))[];
  calls: number;
  batches: RepoRef[][];

  constructor(responses: (Error | ((batch: RepoRef[]) => BatchResponse))[]) {
    this.responses = responses;
    this.calls = 0;
    this.batches = [];
  }

  fetchRepoStatsBatch(batch: RepoRef[]): Promise<BatchResponse> {
    this.calls += 1;
    this.batches.push([...batch]);
    const next = this.responses.shift();
    if (next instanceof Error) {
      throw next;
    }
    if (!next) {
      throw new Error("Missing mock response");
    }
    return Promise.resolve(next(batch));
  }
}

void test("fetchRepoStatsWithCache retries and falls back to cache", async () => {
  const cache = new SQLiteCache(":memory:");
  const repoOne: RepoRef = { owner: "example", name: "repo-one" };
  const repoTwo: RepoRef = { owner: "example", name: "repo-two" };
  const repos: RepoRef[] = [repoOne, repoTwo];

  cache.set(repoKey(repoTwo), 99);

  const client = new FakeGitHubClient([
    new Error("temporary failure"),
    (batch) => {
      const stats = new Map<string, { stars: number; lastCommitAt?: string | null }>();
      const [first] = batch;
      if (!first) {
        throw new Error("Missing repo");
      }
      stats.set(repoKey(first), { stars: 10, lastCommitAt: "2024-01-01T00:00:00Z" });
      return { stats };
    }
  ]);

  const result = await fetchRepoStatsWithCache(client, cache, repos, {
    batchSize: 2,
    concurrency: 1,
    retries: 1,
    retryDelayMs: 1,
    maxRetryDelayMs: 1,
    logRateLimit: false
  });

  assert.equal(client.calls, 2);
  assert.equal(result.get(repoKey(repoOne))?.stars, 10);
  assert.equal(result.get(repoKey(repoTwo))?.stars, 99);
  cache.close();
});

void test("fetchRepoStatsWithCache uses fresh cache entries", async () => {
  const cache = new SQLiteCache(":memory:");
  const repoOne: RepoRef = { owner: "example", name: "repo-one" };
  const repoTwo: RepoRef = { owner: "example", name: "repo-two" };
  const repos: RepoRef[] = [repoOne, repoTwo];

  cache.set(repoKey(repoOne), 123);

  const client = new FakeGitHubClient([
    (batch) => {
      const stats = new Map<string, { stars: number; lastCommitAt?: string | null }>();
      const [first] = batch;
      if (!first) {
        throw new Error("Missing repo");
      }
      stats.set(repoKey(first), { stars: 10, lastCommitAt: "2024-02-02T00:00:00Z" });
      return { stats };
    }
  ]);

  const result = await fetchRepoStatsWithCache(client, cache, repos, {
    batchSize: 2,
    concurrency: 1,
    retries: 0,
    logRateLimit: false,
    cacheMaxAgeSeconds: 60 * 60
  });

  assert.equal(client.calls, 1);
  assert.equal(client.batches.length, 1);
  assert.equal(repoKey(client.batches[0]![0]!), repoKey(repoTwo));
  assert.equal(result.get(repoKey(repoOne))?.stars, 123);
  assert.equal(result.get(repoKey(repoTwo))?.stars, 10);
  cache.close();
});
