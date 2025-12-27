import type { Parser } from "./types.js";

export class ParserRegistry {
  private parsers = new Map<string, Parser>();

  register(parser: Parser): void {
    if (this.parsers.has(parser.id)) {
      throw new Error(`Parser already registered: ${parser.id}`);
    }
    this.parsers.set(parser.id, parser);
  }

  get(id: string): Parser {
    const parser = this.parsers.get(id);
    if (!parser) {
      throw new Error(`Unknown parser: ${id}`);
    }
    return parser;
  }
}
