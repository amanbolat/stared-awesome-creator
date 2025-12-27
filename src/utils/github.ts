export type RepoRef = {
  owner: string;
  name: string;
};

export function parseGitHubRepo(url: string): RepoRef | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") {
      return null;
    }

    const parts = parsed.pathname
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length < 2) {
      return null;
    }

    const [owner, name] = parts;
    if (!owner || !name) {
      return null;
    }
    return { owner, name: name.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

export function repoKey(repo: RepoRef): string {
  return `${repo.owner}/${repo.name}`;
}

export function isGitHubRepoUrl(url: string): boolean {
  return parseGitHubRepo(url) !== null;
}
