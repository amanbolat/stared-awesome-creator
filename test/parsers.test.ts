import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createParserRegistry } from "../src/parsers/index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

async function loadFixture(name) {
  return await fs.readFile(path.join(fixturesDir, name), "utf-8");
}

test("awesome-rust parser skips table of contents and finds categories", async () => {
  const registry = createParserRegistry();
  const parser = registry.get("awesome-rust");
  const markdown = await loadFixture("awesome-rust.md");
  const parsed = parser.parse(markdown, {});

  assert.ok(parsed.categories.length > 0);
  assert.ok(!parsed.categories.some((cat) => cat.title.toLowerCase() === "table of contents"));

  const audio = parsed.categories.find((cat) => cat.title === "Audio and Music");
  assert.ok(audio);
  const dano = audio.items.find((item) => item.name === "dano");
  assert.ok(dano);
  assert.equal(dano.url, "https://github.com/kimono-koans/dano");
});

test("awesome-zig parser ignores contents and captures tool categories", async () => {
  const registry = createParserRegistry();
  const parser = registry.get("awesome-zig");
  const markdown = await loadFixture("awesome-zig.md");
  const parsed = parser.parse(markdown, {});

  assert.ok(!parsed.categories.some((cat) => cat.title.toLowerCase() === "contents"));

  const editors = parsed.categories.find((cat) => cat.title === "Text Editors");
  assert.ok(editors);
  assert.ok(editors.items.length > 0);
});

test("awesome-postgres parser captures depth-3 categories only", async () => {
  const registry = createParserRegistry();
  const parser = registry.get("awesome-postgres");
  const markdown = await loadFixture("awesome-postgres.md");
  const parsed = parser.parse(markdown, {});

  assert.ok(!parsed.categories.some((cat) => cat.title.toLowerCase() === "contents"));

  const ha = parsed.categories.find((cat) => cat.title === "High-Availability");
  assert.ok(ha);
  assert.ok(ha.items.length > 0);
});
