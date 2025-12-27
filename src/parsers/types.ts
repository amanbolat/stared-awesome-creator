export type ParsedItem = {
  name: string;
  url: string;
  description: string;
  stars?: number | null;
};

export type ParsedCategory = {
  title: string;
  depth: number;
  items: ParsedItem[];
};

export type ParsedList = {
  title?: string;
  header?: string;
  toc?: boolean;
  categories: ParsedCategory[];
};

export type ParserOptions = {
  headingDepths?: number[];
  ignoreHeadings?: string[];
};

export type Parser = {
  id: string;
  parse(markdown: string, options: ParserOptions): ParsedList;
};
