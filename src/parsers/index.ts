import { ParserRegistry } from "./registry.js";
import { defaultParser } from "./default.js";
import {
  awesomePostgresParser,
  awesomeRustParser,
  awesomeZigParser
} from "./profiles.js";

export function createParserRegistry(): ParserRegistry {
  const registry = new ParserRegistry();
  registry.register(defaultParser);
  registry.register(awesomeRustParser);
  registry.register(awesomeZigParser);
  registry.register(awesomePostgresParser);
  return registry;
}
