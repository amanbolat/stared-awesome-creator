import test from "node:test";
import assert from "node:assert/strict";

import { SQLiteCache } from "../src/cache/sqlite.ts";
import type { ResolvedListConfig } from "../src/config/types.ts";
import type { GitHubFileRef } from "../src/github/client.ts";
import { createParserRegistry } from "../src/parsers/index.ts";
import { runWorkflow, type GitHubClientLike } from "../src/workflow.ts";
import { repoKey, type RepoRef } from "../src/utils/github.ts";

type UpdateCall = {
  ref: GitHubFileRef;
  content: string;
  message: string;
};

class FakeGitHubClient implements GitHubClientLike {
  private readonly markdown: string;
  private readonly stats: Map<string, { stars: number; lastCommitAt?: string | null }>;

  fetchFileCalls: GitHubFileRef[] = [];
  updateFileCalls: UpdateCall[] = [];

  constructor(markdown: string, stats: Map<string, { stars: number; lastCommitAt?: string | null }>) {
    this.markdown = markdown;
    this.stats = stats;
  }

  fetchFile(ref: GitHubFileRef): Promise<string> {
    this.fetchFileCalls.push(ref);
    return Promise.resolve(this.markdown);
  }

  updateFile(ref: GitHubFileRef, content: string, message: string): Promise<void> {
    this.updateFileCalls.push({ ref, content, message });
    return Promise.resolve();
  }

  fetchRepoStatsBatch(
    repos: RepoRef[]
  ): Promise<{ stats: Map<string, { stars: number; lastCommitAt?: string | null }> }> {
    const result = new Map<string, { stars: number; lastCommitAt?: string | null }>();
    for (const repo of repos) {
      const key = repoKey(repo);
      const entry = this.stats.get(key);
      if (entry) {
        result.set(key, entry);
      }
    }
    return Promise.resolve({ stats: result });
  }
}

void test("workflow fetches source README, stars, and updates destination", async () => {
  const markdown = [
    "# Awesome Demo",
    "",
    "## Tools",
    "- [Repo One](https://github.com/example/repo-one) - First tool",
    "- [Repo Two](https://github.com/example/repo-two) - Second tool"
  ].join("\n");

  const stats = new Map<string, { stars: number; lastCommitAt?: string | null }>([
    ["example/repo-one", { stars: 10, lastCommitAt: "2024-02-02T00:00:00Z" }],
    ["example/repo-two", { stars: 20, lastCommitAt: "2024-03-03T00:00:00Z" }]
  ]);

  const client = new FakeGitHubClient(markdown, stats);
  const cache = new SQLiteCache(":memory:");
  const list: ResolvedListConfig = {
    id: "awesome-demo",
    name: "Awesome Demo",
    source: {
      owner: "source",
      repo: "awesome-demo",
      branch: "main",
      path: "README.md"
    },
    output: {
      owner: "dest",
      repo: "awesome-demo-with-stars",
      branch: "main",
      path: "README.md"
    },
    parser: "default",
    parserOptions: {
      headingDepths: [2, 3],
      ignoreHeadings: []
    },
    cache: {
      ttlSeconds: 60 * 60
    },
    toc: false,
    table: {
      columns: ["stars", "name", "description", "last_commit"],
      sort: "stars_desc"
    }
  };

  try {
    await runWorkflow({
      list,
      parserRegistry: createParserRegistry(),
      client,
      cache,
      dryRun: false,
      outputDir: "out"
    });

    assert.equal(client.fetchFileCalls.length, 1);
    assert.deepEqual(client.fetchFileCalls[0], {
      owner: "source",
      repo: "awesome-demo",
      branch: "main",
      path: "README.md"
    });

    assert.equal(client.updateFileCalls.length, 1);
    const update = client.updateFileCalls[0];
    if (!update) {
      throw new Error("Missing update call");
    }
    assert.equal(update.ref.owner, "dest");
    assert.equal(update.ref.repo, "awesome-demo-with-stars");
    assert.equal(update.ref.path, "README.md");
    assert.equal(update.message, "chore: update awesome-demo stars");
    assert.ok(update.content.startsWith("# Awesome Demo"));

    const repoTwoIndex = update.content.indexOf(
      "| 20 | [Repo Two](https://github.com/example/repo-two) | Second tool | 2024-03-03 |"
    );
    const repoOneIndex = update.content.indexOf(
      "| 10 | [Repo One](https://github.com/example/repo-one) | First tool | 2024-02-02 |"
    );
    assert.ok(repoTwoIndex !== -1);
    assert.ok(repoOneIndex !== -1);
    assert.ok(repoTwoIndex < repoOneIndex);
  } finally {
    cache.close();
  }
});
