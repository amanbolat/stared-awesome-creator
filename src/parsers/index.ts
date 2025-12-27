import { ParserRegistry } from "./registry.js";
import { defaultParser } from "./default.js";

export function createParserRegistry(): ParserRegistry {
  const registry = new ParserRegistry();
  registry.register(defaultParser);
  return registry;
}
