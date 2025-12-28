export type RepoRef = {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
};

export type TableConfig = {
  columns: ["stars", "name", "description", "last_commit"];
  sort: "stars_desc";
};

export type ParserOptions = {
  headingDepths?: number[];
  ignoreHeadings?: string[];
};

export type CacheConfig = {
  ttlSeconds: number;
};

export type ListConfig = {
  id: string;
  name?: string;
  source: RepoRef;
  output?: RepoRef;
  parser: string;
  parserOptions?: ParserOptions;
  table?: TableConfig;
  cache?: CacheConfig;
  header?: string;
  toc?: boolean;
};

export type DefaultsConfig = {
  source?: Partial<RepoRef>;
  output?: Partial<RepoRef> & { repoSuffix?: string };
  parser?: string;
  parserOptions?: ParserOptions;
  table?: TableConfig;
  cache?: CacheConfig;
  toc?: boolean;
};

export type RawConfig = {
  version: number;
  defaults?: DefaultsConfig;
  list: ListConfig;
};

export type ResolvedListConfig = Omit<ListConfig, "output" | "parser" | "parserOptions" | "table" | "source"> & {
  source: RepoRef;
  output: RepoRef;
  parser: string;
  parserOptions: ParserOptions;
  table: TableConfig;
  cache: CacheConfig;
  header?: string;
  toc: boolean;
};

export type ResolvedConfig = {
  version: number;
  defaults: Required<DefaultsConfig>;
  list: ResolvedListConfig;
};
