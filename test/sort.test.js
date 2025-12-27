import test from "node:test";
import assert from "node:assert/strict";

import { sortItemsByStars } from "../dist/utils/sort.js";

test("sortItemsByStars orders by stars desc then name", () => {
  const items = [
    { name: "Bravo", stars: 5 },
    { name: "Alpha", stars: 5 },
    { name: "Charlie", stars: null },
    { name: "Delta", stars: 10 }
  ];

  sortItemsByStars(items);

  assert.deepEqual(
    items.map((item) => item.name),
    ["Delta", "Alpha", "Bravo", "Charlie"]
  );
});
