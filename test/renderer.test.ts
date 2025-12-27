import test from "node:test";
import assert from "node:assert/strict";

import { renderList } from "../src/renderer/table.ts";

void test("renderList skips empty categories and formats tables", () => {
  const output = renderList({
    title: "Sample",
    categories: [
      { title: "Empty", depth: 2, items: [] },
      {
        title: "Tools",
        depth: 2,
        items: [
          { name: "Repo", url: "https://github.com/example/repo", description: "Useful tool", stars: 42 }
        ]
      }
    ]
  });

  assert.ok(!output.includes("## Empty"));
  assert.ok(output.includes("| 42 | [Repo](https://github.com/example/repo) | Useful tool |"));
  assert.ok(output.startsWith("# Sample"));
});

void test("renderList uses header override", () => {
  const output = renderList({
    title: "Sample",
    header: "# Custom Title\n\nCustom intro.",
    categories: [
      {
        title: "Tools",
        depth: 2,
        items: [
          { name: "Repo", url: "https://github.com/example/repo", description: "Useful tool", stars: 42 }
        ]
      }
    ]
  });

  assert.ok(output.startsWith("# Custom Title"));
  assert.ok(!output.startsWith("# Sample"));
});

void test("renderList includes a table of contents with nested headings", () => {
  const output = renderList({
    title: "Sample",
    toc: true,
    categories: [
      {
        title: "Applications",
        depth: 2,
        items: [
          { name: "Repo A", url: "https://github.com/example/a", description: "First", stars: 5 }
        ]
      },
      {
        title: "Audio and Music",
        depth: 3,
        items: [
          { name: "Repo B", url: "https://github.com/example/b", description: "Second", stars: 3 }
        ]
      }
    ]
  });

  assert.ok(output.includes("## Table of contents"));
  assert.ok(output.includes("- [Applications](#applications)"));
  assert.ok(output.includes("  - [Audio and Music](#audio-and-music)"));
});
