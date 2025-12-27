export type RepoRef = {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
};

export type TableConfig = {
  columns: ["stars", "name", "description"];
  sort: "stars_desc";
};

export type ParserOptions = {
  headingDepths?: number[];
};

export type ListConfig = {
  id: string;
  name?: string;
  source: RepoRef;
  output?: RepoRef;
  parser: string;
  parserOptions?: ParserOptions;
  table?: TableConfig;
};

export type DefaultsConfig = {
  source?: Partial<RepoRef>;
  output?: Partial<RepoRef> & { repoSuffix?: string };
  parser?: string;
  parserOptions?: ParserOptions;
  table?: TableConfig;
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
};

export type ResolvedConfig = {
  version: number;
  defaults: Required<DefaultsConfig>;
  list: ResolvedListConfig;
};
