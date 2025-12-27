import test from "node:test";
import assert from "node:assert/strict";

import { SQLiteCache } from "../dist/cache/sqlite.js";
import { fetchStarsWithCache } from "../dist/github/stars.js";
import { repoKey } from "../dist/utils/github.js";

class FakeGitHubClient {
  constructor(responses) {
    this.responses = responses;
    this.calls = 0;
  }

  async fetchStarsBatch(batch) {
    this.calls += 1;
    const next = this.responses.shift();
    if (next instanceof Error) {
      throw next;
    }
    return next(batch);
  }
}

test("fetchStarsWithCache retries and falls back to cache", async () => {
  const cache = new SQLiteCache(":memory:");
  const repos = [
    { owner: "example", name: "repo-one" },
    { owner: "example", name: "repo-two" }
  ];

  cache.set(repoKey(repos[1]), 99);

  const client = new FakeGitHubClient([
    new Error("temporary failure"),
    (batch) => {
      const stars = new Map();
      stars.set(repoKey(batch[0]), 10);
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
  assert.equal(result.get(repoKey(repos[0])), 10);
  assert.equal(result.get(repoKey(repos[1])), 99);
  cache.close();
});
