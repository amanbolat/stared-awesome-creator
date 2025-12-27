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
  private readonly stars: Map<string, number>;

  fetchFileCalls: GitHubFileRef[] = [];
  updateFileCalls: UpdateCall[] = [];

  constructor(markdown: string, stars: Map<string, number>) {
    this.markdown = markdown;
    this.stars = stars;
  }

  fetchFile(ref: GitHubFileRef): Promise<string> {
    this.fetchFileCalls.push(ref);
    return Promise.resolve(this.markdown);
  }

  updateFile(ref: GitHubFileRef, content: string, message: string): Promise<void> {
    this.updateFileCalls.push({ ref, content, message });
    return Promise.resolve();
  }

  fetchStarsBatch(repos: RepoRef[]): Promise<{ stars: Map<string, number> }> {
    const result = new Map<string, number>();
    for (const repo of repos) {
      const key = repoKey(repo);
      const count = this.stars.get(key);
      if (typeof count === "number") {
        result.set(key, count);
      }
    }
    return Promise.resolve({ stars: result });
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

  const stars = new Map<string, number>([
    ["example/repo-one", 10],
    ["example/repo-two", 20]
  ]);

  const client = new FakeGitHubClient(markdown, stars);
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
    table: {
      columns: ["stars", "name", "description"],
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

    const repoTwoIndex = update.content.indexOf("| 20 | [Repo Two](https://github.com/example/repo-two) |");
    const repoOneIndex = update.content.indexOf("| 10 | [Repo One](https://github.com/example/repo-one) |");
    assert.ok(repoTwoIndex !== -1);
    assert.ok(repoOneIndex !== -1);
    assert.ok(repoTwoIndex < repoOneIndex);
  } finally {
    cache.close();
  }
});
