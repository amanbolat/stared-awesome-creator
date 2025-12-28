import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const DEFAULT_CACHE_PATH = "/var/lib/stared-awesome-creator/cache.db";

export class SQLiteCache {
  private db: Database.Database;

  private getStmt: Database.Statement<[string]>;
  private setStmt: Database.Statement<[string, number, string | null, number]>;

  constructor(cachePath: string) {
    ensureDir(path.dirname(cachePath));
    this.db = new Database(cachePath);

    this.db.pragma("journal_mode = WAL");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS stars_cache (repo TEXT PRIMARY KEY, stars INTEGER NOT NULL, last_commit_at TEXT, updated_at INTEGER NOT NULL)"
    );
    ensureColumn(this.db, "stars_cache", "last_commit_at", "TEXT");

    this.getStmt = this.db.prepare(
      "SELECT stars, last_commit_at, updated_at FROM stars_cache WHERE repo = ?"
    );
    this.setStmt = this.db.prepare(
      "INSERT INTO stars_cache (repo, stars, last_commit_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(repo) DO UPDATE SET stars = excluded.stars, last_commit_at = excluded.last_commit_at, updated_at = excluded.updated_at"
    );
  }

  get(repoKey: string): number | null {
    const entry = this.getEntry(repoKey);
    if (!entry) {
      return null;
    }
    return entry.stars;
  }

  getEntry(repoKey: string): { stars: number; lastCommitAt: string | null; updatedAt: number } | null {
    const row = this.getStmt.get(repoKey) as
      | { stars: number; last_commit_at: string | null; updated_at: number }
      | undefined;
    if (!row) {
      return null;
    }
    return { stars: row.stars, lastCommitAt: row.last_commit_at, updatedAt: row.updated_at };
  }

  set(repoKey: string, stars: number, lastCommitAt: string | null = null): void {
    const now = Math.floor(Date.now() / 1000);
    this.setStmt.run(repoKey, stars, lastCommitAt, now);
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

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (info.some((item) => item.name === column)) {
    return;
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
