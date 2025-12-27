export type ParsedItem = {
  name: string;
  url: string;
  description: string;
  stars?: number | null;
};

export type ParsedCategory = {
  title: string;
  items: ParsedItem[];
};

export type ParsedList = {
  title?: string;
  categories: ParsedCategory[];
};

export type ParserOptions = {
  headingDepths?: number[];
};

export type Parser = {
  id: string;
  parse(markdown: string, options: ParserOptions): ParsedList;
};
