import { defaultParser } from "./default.js";
import type { Parser, ParserOptions } from "./types.js";

export const awesomeRustParser = createProfileParser("awesome-rust", {
  headingDepths: [2, 3],
  ignoreHeadings: ["Table of contents"]
});

export const awesomeZigParser = createProfileParser("awesome-zig", {
  headingDepths: [2, 3],
  ignoreHeadings: ["Contents"]
});

export const awesomePostgresParser = createProfileParser("awesome-postgres", {
  headingDepths: [3],
  ignoreHeadings: ["Contents"]
});

function createProfileParser(id: string, defaults: ParserOptions): Parser {
  return {
    id,
    parse(markdown: string, options: ParserOptions): ReturnType<typeof defaultParser.parse> {
      const merged = mergeOptions(defaults, options);
      return defaultParser.parse(markdown, merged);
    }
  };
}

function mergeOptions(defaults: ParserOptions, overrides: ParserOptions): ParserOptions {
  return {
    headingDepths: overrides.headingDepths ?? defaults.headingDepths,
    ignoreHeadings: mergeIgnoreHeadings(defaults.ignoreHeadings, overrides.ignoreHeadings)
  };
}

function mergeIgnoreHeadings(
  defaults: string[] | undefined,
  overrides: string[] | undefined
): string[] | undefined {
  if (!defaults && !overrides) {
    return undefined;
  }
  return [...(defaults ?? []), ...(overrides ?? [])];
}
