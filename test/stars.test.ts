import test from "node:test";
import assert from "node:assert/strict";

import { SQLiteCache } from "../src/cache/sqlite.ts";
import { fetchStarsWithCache } from "../src/github/stars.ts";
import { repoKey, type RepoRef } from "../src/utils/github.ts";

type BatchResponse = {
  stars: Map<string, number>;
};

class FakeGitHubClient {
  responses: (Error | ((batch: RepoRef[]) => BatchResponse))[];
  calls: number;

  constructor(responses: (Error | ((batch: RepoRef[]) => BatchResponse))[]) {
    this.responses = responses;
    this.calls = 0;
  }

  fetchStarsBatch(batch: RepoRef[]): Promise<BatchResponse> {
    this.calls += 1;
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

void test("fetchStarsWithCache retries and falls back to cache", async () => {
  const cache = new SQLiteCache(":memory:");
  const repoOne: RepoRef = { owner: "example", name: "repo-one" };
  const repoTwo: RepoRef = { owner: "example", name: "repo-two" };
  const repos: RepoRef[] = [repoOne, repoTwo];

  cache.set(repoKey(repoTwo), 99);

  const client = new FakeGitHubClient([
    new Error("temporary failure"),
    (batch) => {
      const stars = new Map<string, number>();
      const [first] = batch;
      if (!first) {
        throw new Error("Missing repo");
      }
      stars.set(repoKey(first), 10);
      return { stars };
    }
  ]);

  const result = await fetchStarsWithCache(client, cache, repos, {
    batchSize: 2,
    concurrency: 1,
    retries: 1,
    retryDelayMs: 1,
    maxRetryDelayMs: 1,
    logRateLimit: false
  });

  assert.equal(client.calls, 2);
  assert.equal(result.get(repoKey(repoOne)), 10);
  assert.equal(result.get(repoKey(repoTwo)), 99);
  cache.close();
});
