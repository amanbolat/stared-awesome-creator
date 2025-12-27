import test from "node:test";
import assert from "node:assert/strict";

import { renderList } from "../src/renderer/table.ts";

void test("renderList skips empty categories and formats tables", () => {
  const output = renderList({
    title: "Sample",
    categories: [
      { title: "Empty", items: [] },
      {
        title: "Tools",
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
        items: [
          { name: "Repo", url: "https://github.com/example/repo", description: "Useful tool", stars: 42 }
        ]
      }
    ]
  });

  assert.ok(output.startsWith("# Custom Title"));
  assert.ok(!output.startsWith("# Sample"));
});
