import type { ParsedCategory, ParsedList } from "../parsers/types.js";

const DEFAULT_ALIGN = "| ---: | --- | --- |";

export function renderList(list: ParsedList): string {
  const chunks: string[] = [];

  if (list.header !== undefined) {
    const header = list.header.trim();
    if (header) {
      chunks.push(header);
      chunks.push("");
    }
  } else if (list.title) {
    chunks.push(`# ${list.title}`);
    chunks.push("");
  }

  for (const category of list.categories) {
    if (category.items.length === 0) {
      continue;
    }
    chunks.push(renderCategory(category));
    chunks.push("");
  }

  return chunks.join("\n").trim() + "\n";
}

function renderCategory(category: ParsedCategory): string {
  const rows = category.items.map((item) => {
    const stars = item.stars ?? "-";
    const name = `[${escapeTableCell(item.name)}](${item.url})`;
    const description = escapeTableCell(item.description);
    return `| ${stars} | ${name} | ${description} |`;
  });

  return [
    `## ${category.title}`,
    "",
    "| Stars | Name | Description |",
    DEFAULT_ALIGN,
    ...rows
  ].join("\n");
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>").trim();
}
