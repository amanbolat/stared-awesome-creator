import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import type { Link, List, ListItem, Paragraph } from "mdast";

import type {
  ParsedCategory,
  ParsedItem,
  ParsedList,
  Parser,
  ParserOptions
} from "./types.js";

const DEFAULT_HEADING_DEPTHS = [2, 3];

export const defaultParser: Parser = {
  id: "default",
  parse(markdown: string, options: ParserOptions): ParsedList {
    const tree = unified().use(remarkParse).parse(markdown);
    const headingDepths = options.headingDepths ?? DEFAULT_HEADING_DEPTHS;
    const ignoreHeadings = new Set(
      (options.ignoreHeadings ?? []).map((heading) => normalizeHeading(heading))
    );

    const categories: ParsedCategory[] = [];
    let currentCategory: ParsedCategory | null = null;
    let title: string | undefined;

    for (const node of tree.children) {
      if (node.type === "heading") {
        const heading = node;
        const text = toString(heading).trim();
        if (heading.depth === 1 && !title) {
          title = text;
        }
        if (headingDepths.includes(heading.depth)) {
          if (ignoreHeadings.has(normalizeHeading(text))) {
            currentCategory = null;
            continue;
          }
          currentCategory = { title: text, items: [] };
          categories.push(currentCategory);
        }
        continue;
      }

      if (node.type === "list" && currentCategory) {
        const list = node;
        const items = extractListItems(list);
        if (items.length > 0) {
          currentCategory.items.push(...items);
        }
      }
    }

    return { title, categories };
  }
};

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase();
}

function extractListItems(list: List): ParsedItem[] {
  const results: ParsedItem[] = [];

  for (const listItem of list.children) {
    const item = extractItem(listItem);
    if (item) {
      results.push(item);
    }
  }

  return results;
}

function extractItem(listItem: ListItem): ParsedItem | null {
  let linkUrl: string | null = null;
  let linkText: string | null = null;

  visit(listItem, "link", (node: Link) => {
    if (linkUrl) {
      return;
    }
    linkUrl = node.url;
    linkText = toString(node).trim();
  });

  if (!linkUrl || !linkText) {
    return null;
  }

  const description = extractDescription(listItem, linkText);

  return {
    name: linkText,
    url: linkUrl,
    description
  };
}

function extractDescription(listItem: ListItem, linkText: string): string {
  const paragraph = listItem.children.find(
    (child): child is Paragraph => child.type === "paragraph"
  );

  if (!paragraph) {
    return "";
  }

  const text = toString(paragraph).trim();
  if (!text) {
    return "";
  }

  if (text.toLowerCase().startsWith(linkText.toLowerCase())) {
    const rest = text.slice(linkText.length).trim();
    return stripSeparator(rest);
  }

  const match = /\s[-:]\s(.+)/.exec(text);
  if (match?.[1]) {
    return match[1].trim();
  }

  return "";
}

function stripSeparator(value: string): string {
  return value.replace(/^[-:|]+\s*/, "").trim();
}
