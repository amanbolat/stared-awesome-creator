import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";

import type { RepoRef } from "../utils/github.js";
import type { RepoStats } from "./stars.js";

export type GitHubFileRef = {
  owner: string;
  repo: string;
  branch?: string;
  path: string;
};

export type RateLimitInfo = {
  remaining: number;
  resetAt: string;
  cost?: number;
};

type GraphQLRepoResult = {
  stargazerCount: number;
  defaultBranchRef?: {
    target?: {
      committedDate?: string;
    } | null;
  } | null;
};

type GraphQLRateLimit = {
  remaining: number;
  resetAt: string;
  cost?: number | null;
};

type GraphQLResponse = {
  rateLimit?: GraphQLRateLimit | null;
} & Record<string, GraphQLRepoResult | GraphQLRateLimit | null | undefined>;

function isRepoResult(
  value: GraphQLRepoResult | GraphQLRateLimit | null | undefined
): value is GraphQLRepoResult {
  return Boolean(value && typeof value === "object" && "stargazerCount" in value);
}

export class GitHubClient {
  private rest: Octokit;
  private readonly graphqlWithAuth: typeof graphql;

  constructor(token: string) {
    this.rest = new Octokit({ auth: token });
    this.graphqlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${token}`
      }
    });
  }

  async fetchFile(ref: GitHubFileRef): Promise<string> {
    const response = await this.rest.repos.getContent({
      owner: ref.owner,
      repo: ref.repo,
      path: ref.path,
      ref: ref.branch
    });

    if (Array.isArray(response.data) || response.data.type !== "file") {
      throw new Error(`Expected file at ${ref.owner}/${ref.repo}:${ref.path}`);
    }

    const content = response.data.content ?? "";
    const encoding = response.data.encoding ?? "base64";
    if (encoding !== "base64") {
      throw new Error(`Unsupported content encoding: ${encoding}`);
    }

    return Buffer.from(content, "base64").toString("utf-8");
  }

  async updateFile(ref: GitHubFileRef, content: string, message: string): Promise<void> {
    let sha: string | undefined;

    try {
      const existing = await this.rest.repos.getContent({
        owner: ref.owner,
        repo: ref.repo,
        path: ref.path,
        ref: ref.branch
      });

      if (Array.isArray(existing.data) || existing.data.type !== "file") {
        throw new Error(`Expected file at ${ref.owner}/${ref.repo}:${ref.path}`);
      }

      sha = existing.data.sha;
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    await this.rest.repos.createOrUpdateFileContents({
      owner: ref.owner,
      repo: ref.repo,
      path: ref.path,
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      sha,
      branch: ref.branch
    });
  }

  async fetchRepoStatsBatch(
    repos: RepoRef[]
  ): Promise<{ stats: Map<string, RepoStats>; rateLimit?: RateLimitInfo }> {
    if (repos.length === 0) {
      return { stats: new Map() };
    }

    const fields = repos
      .map((repo, index) => {
        const alias = `repo${index}`;
        const owner = JSON.stringify(repo.owner);
        const name = JSON.stringify(repo.name);
        return `${alias}: repository(owner: ${owner}, name: ${name}) { stargazerCount defaultBranchRef { target { ... on Commit { committedDate } } } }`;
      })
      .join("\n");

    const query = `query {\n${fields}\nrateLimit { remaining resetAt cost }\n}`;

    const data = await this.graphqlWithAuth<GraphQLResponse>(query);
    const stats = new Map<string, RepoStats>();

    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      if (!key.startsWith("repo")) {
        continue;
      }
      const value = data[key];
      if (!isRepoResult(value)) {
        continue;
      }
      const index = Number.parseInt(key.replace("repo", ""), 10);
      const repo = repos[index];
      if (!repo) {
        continue;
      }
      stats.set(`${repo.owner}/${repo.name}`, {
        stars: value.stargazerCount,
        lastCommitAt: extractCommitDate(value)
      });
    }

    const rateLimit = data.rateLimit
      ? {
          remaining: data.rateLimit.remaining,
          resetAt: data.rateLimit.resetAt,
          cost: data.rateLimit.cost ?? undefined
        }
      : undefined;

    return { stats, rateLimit };
  }
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return "status" in error && (error as { status?: number }).status === 404;
}

function extractCommitDate(value: GraphQLRepoResult): string | null {
  const target = value.defaultBranchRef?.target;
  if (!target || typeof target !== "object") {
    return null;
  }
  if (!("committedDate" in target)) {
    return null;
  }
  const committedDate = (target as { committedDate?: string }).committedDate;
  return committedDate ?? null;
}
