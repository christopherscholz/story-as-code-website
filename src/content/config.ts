import { defineCollection, z } from 'astro:content';

const schemas = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['root', 'world', 'narrative', 'definitions', 'derivation']),
    order: z.number(),
  }),
});

const examples = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    hasGraph: z.boolean().default(true),
  }),
});

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { schemas, examples, pages };
