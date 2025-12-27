import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const DEFAULT_CACHE_PATH = "/var/lib/stared-awesome-creator/cache.db";

export class SQLiteCache {
  private db: Database.Database;

  private getStmt: Database.Statement<[string]>;
  private setStmt: Database.Statement<[string, number, number]>;

  constructor(cachePath: string) {
    ensureDir(path.dirname(cachePath));
    this.db = new Database(cachePath);

    this.db.pragma("journal_mode = WAL");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS stars_cache (repo TEXT PRIMARY KEY, stars INTEGER NOT NULL, updated_at INTEGER NOT NULL)"
    );

    this.getStmt = this.db.prepare(
      "SELECT stars, updated_at FROM stars_cache WHERE repo = ?"
    );
    this.setStmt = this.db.prepare(
      "INSERT INTO stars_cache (repo, stars, updated_at) VALUES (?, ?, ?) ON CONFLICT(repo) DO UPDATE SET stars = excluded.stars, updated_at = excluded.updated_at"
    );
  }

  get(repoKey: string): number | null {
    const row = this.getStmt.get(repoKey) as { stars: number; updated_at: number } | undefined;
    if (!row) {
      return null;
    }
    return row.stars;
  }

  set(repoKey: string, stars: number): void {
    const now = Math.floor(Date.now() / 1000);
    this.setStmt.run(repoKey, stars, now);
  }

  close(): void {
    this.db.close();
  }
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
