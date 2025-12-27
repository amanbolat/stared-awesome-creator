import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import type { Heading, List, ListItem, Root, RootContent } from "mdast";

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
    const tree = unified().use(remarkParse).parse(markdown) as Root;
    const headingDepths = options.headingDepths ?? DEFAULT_HEADING_DEPTHS;

    const categories: ParsedCategory[] = [];
    let currentCategory: ParsedCategory | null = null;
    let title: string | undefined;

    for (const node of tree.children) {
      if (node.type === "heading") {
        const heading = node as Heading;
        const text = toString(heading).trim();
        if (heading.depth === 1 && !title) {
          title = text;
        }
        if (headingDepths.includes(heading.depth)) {
          currentCategory = { title: text, items: [] };
          categories.push(currentCategory);
        }
        continue;
      }

      if (node.type === "list" && currentCategory) {
        const list = node as List;
        const items = extractListItems(list);
        if (items.length > 0) {
          currentCategory.items.push(...items);
        }
      }
    }

    return { title, categories };
  }
};

function extractListItems(list: List): ParsedItem[] {
  const results: ParsedItem[] = [];

  for (const listItem of list.children ?? []) {
    const item = extractItem(listItem as ListItem);
    if (item) {
      results.push(item);
    }
  }

  return results;
}

function extractItem(listItem: ListItem): ParsedItem | null {
  let linkUrl: string | null = null;
  let linkText: string | null = null;

  visit(listItem, "link", (node) => {
    if (linkUrl) {
      return;
    }
    linkUrl = (node as any).url;
    linkText = toString(node as any).trim();
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
    (child) => child.type === "paragraph"
  ) as RootContent | undefined;

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

  const match = text.match(/\s[-:]\s(.+)/);
  if (match?.[1]) {
    return match[1].trim();
  }

  return "";
}

function stripSeparator(value: string): string {
  return value.replace(/^[-:|]+\s*/, "").trim();
}
