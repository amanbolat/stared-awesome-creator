import type { ParsedCategory, ParsedList } from "../parsers/types.js";

type TableColumn = "stars" | "name" | "description" | "last_commit";

const DEFAULT_COLUMNS: TableColumn[] = ["stars", "name", "description", "last_commit"];
const COLUMN_LABELS: Record<TableColumn, string> = {
  stars: "Stars",
  name: "Name",
  description: "Description",
  last_commit: "Last Commit"
};
const COLUMN_ALIGN: Record<TableColumn, string> = {
  stars: "---:",
  name: "---",
  description: "---",
  last_commit: "---"
};

export function renderList(
  list: ParsedList,
  options: { columns?: TableColumn[] } = {}
): string {
  const chunks: string[] = [];
  const renderableCategories = list.categories.filter((category) => category.items.length > 0);
  const baseDepth = resolveBaseDepth(renderableCategories);
  const columns = options.columns ?? DEFAULT_COLUMNS;

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

  if (list.toc) {
    const toc = renderTableOfContents(renderableCategories, baseDepth);
    if (toc) {
      chunks.push("## Table of contents");
      chunks.push("");
      chunks.push(toc);
      chunks.push("");
    }
  }

  for (const category of renderableCategories) {
    chunks.push(renderCategory(category, baseDepth, columns));
    chunks.push("");
  }

  return chunks.join("\n").trim() + "\n";
}

function renderCategory(category: ParsedCategory, baseDepth: number, columns: TableColumn[]): string {
  const rows = category.items.map((item) => {
    const cells = columns.map((column) => renderCell(column, item));
    return `| ${cells.join(" | ")} |`;
  });
  const headingLevel = resolveHeadingLevel(category.depth, baseDepth);
  const headingPrefix = "#".repeat(headingLevel);
  const header = `| ${columns.map((column) => COLUMN_LABELS[column]).join(" | ")} |`;
  const align = `| ${columns.map((column) => COLUMN_ALIGN[column]).join(" | ")} |`;

  return [
    `${headingPrefix} ${category.title}`,
    "",
    header,
    align,
    ...rows
  ].join("\n");
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>").trim();
}

function renderTableOfContents(categories: ParsedCategory[], baseDepth: number): string | null {
  if (categories.length === 0) {
    return null;
  }
  const slugger = createSlugger();
  const lines = categories.map((category) => {
    const headingLevel = resolveHeadingLevel(category.depth, baseDepth);
    const indent = "  ".repeat(Math.max(0, headingLevel - 2));
    const slug = slugger(category.title);
    return `${indent}- [${category.title}](#${slug})`;
  });

  return lines.join("\n");
}

function renderCell(column: TableColumn, item: ParsedCategory["items"][number]): string {
  switch (column) {
    case "stars":
      return String(item.stars ?? "-");
    case "name":
      return `[${escapeTableCell(item.name)}](${item.url})`;
    case "description":
      return escapeTableCell(item.description);
    case "last_commit":
      return formatCommitDate(item.lastCommitAt);
  }
}

function formatCommitDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toISOString().slice(0, 10);
}

function resolveBaseDepth(categories: ParsedCategory[]): number {
  if (categories.length === 0) {
    return 2;
  }
  let minDepth = categories[0]?.depth ?? 2;
  for (const category of categories) {
    if (category.depth < minDepth) {
      minDepth = category.depth;
    }
  }
  return minDepth;
}

function resolveHeadingLevel(depth: number, baseDepth: number): number {
  const normalized = depth - baseDepth + 2;
  return Math.min(6, Math.max(2, normalized));
}

function createSlugger(): (value: string) => string {
  const occurrences = new Map<string, number>();

  return (value: string) => {
    const base = slugifyHeading(value);
    const count = occurrences.get(base) ?? 0;
    occurrences.set(base, count + 1);
    if (count === 0) {
      return base;
    }
    return `${base}-${count}`;
  };
}

function slugifyHeading(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  return normalized
    .replace(/[^a-z0-9 _-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
