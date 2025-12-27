import { z } from "zod";

const repoSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().min(1).optional(),
  path: z.string().min(1).optional()
});

const tableSchema = z.object({
  columns: z.tuple([
    z.literal("stars"),
    z.literal("name"),
    z.literal("description")
  ]),
  sort: z.literal("stars_desc")
});

const parserOptionsSchema = z.object({
  headingDepths: z.array(z.number().int().min(1).max(6)).optional(),
  ignoreHeadings: z.array(z.string().min(1)).optional()
});

const cacheSchema = z.object({
  ttlSeconds: z.number().int().min(1)
});

const defaultsSchema = z.object({
  source: repoSchema.partial().optional(),
  output: repoSchema
    .partial()
    .extend({ repoSuffix: z.string().min(1).optional() })
    .optional(),
  parser: z.string().min(1).optional(),
  parserOptions: parserOptionsSchema.optional(),
  table: tableSchema.optional(),
  cache: cacheSchema.optional(),
  toc: z.boolean().optional()
});

const listSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  header: z.string().min(1).optional(),
  toc: z.boolean().optional(),
  source: repoSchema,
  output: repoSchema.partial().optional(),
  parser: z.string().min(1).optional(),
  parserOptions: parserOptionsSchema.optional(),
  table: tableSchema.optional(),
  cache: cacheSchema.optional()
});

export const configSchema = z.object({
  version: z.number().int().min(1),
  defaults: defaultsSchema.optional(),
  list: listSchema
});

export type ConfigSchema = z.infer<typeof configSchema>;
