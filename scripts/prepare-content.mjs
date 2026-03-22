#!/usr/bin/env node
/**
 * Pre-build content preparation script.
 *
 * Reads from:
 *   - .generated/schemas/   (output of generate-schema-docs.sh)
 *   - .generated/examples/  (output of generate-example-docs.py)
 *   - .generated/data/      (output of resolve-story.py)
 *   - spec/                 (README, CONTRIBUTING, CODE_OF_CONDUCT, LICENSE)
 *   - content/              (website-owned content like scope.md)
 *
 * Writes to:
 *   - src/content/schemas/   (Astro content collection)
 *   - src/content/examples/  (Astro content collection)
 *   - src/content/pages/     (Astro content collection)
 *   - public/data/           (resolved JSON for graph visualization)
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
  readdirSync,
} from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SPEC_ROOT = join(REPO_ROOT, 'spec');
const GENERATED_DIR = join(REPO_ROOT, '.generated');
const CONTENT_SOURCE = join(REPO_ROOT, 'content');
const CONTENT_DIR = join(REPO_ROOT, 'src', 'content');
const PUBLIC_DIR = join(REPO_ROOT, 'public');

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function readFile(path) {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

// ── Schema metadata ──────────────────────────────────────────────
const SCHEMA_META = {
  story: {
    title: 'Story Schema',
    description: 'Root document of a Story as Code project.',
    category: 'root',
    order: 0,
  },
  world: {
    title: 'World Schema',
    description: 'The world graph — ground truth of the story universe.',
    category: 'world',
    order: 10,
  },
  'time-system': {
    title: 'Time System Schema',
    description: 'Defines how time works in this world.',
    category: 'world',
    order: 11,
  },
  node: {
    title: 'Node Schema',
    description: 'An entity in the world graph.',
    category: 'world',
    order: 12,
  },
  edge: {
    title: 'Edge Schema',
    description: 'A relationship between nodes.',
    category: 'world',
    order: 13,
  },
  frame: {
    title: 'Frame Schema',
    description: 'An alternative timeline or branch.',
    category: 'world',
    order: 14,
  },
  constraint: {
    title: 'Constraint Schema',
    description: 'A world rule with scope filters and severity levels.',
    category: 'world',
    order: 15,
  },
  narrative: {
    title: 'Narrative Schema',
    description: 'The narrative layer — storytelling perspective on the world.',
    category: 'narrative',
    order: 20,
  },
  lens: {
    title: 'Lens Schema',
    description:
      'Narrative perspective — filters and interprets world content.',
    category: 'narrative',
    order: 21,
  },
  format: {
    title: 'Format Schema',
    description:
      'Output format definition with structural hierarchy and pacing rules.',
    category: 'narrative',
    order: 22,
  },
  beat: {
    title: 'Beat Schema',
    description:
      'A story beat — selects world elements and adds dramaturgical structure.',
    category: 'narrative',
    order: 23,
  },
  device: {
    title: 'Device Schema',
    description: 'A narrative device — rhetorical connection between beats.',
    category: 'narrative',
    order: 24,
  },
  thread: {
    title: 'Thread Schema',
    description: 'A thematic thread — horizontal chaining across storylines.',
    category: 'narrative',
    order: 25,
  },
  'variant-meta': {
    title: 'Variant Meta Schema',
    description: 'Parallel world version metadata.',
    category: 'narrative',
    order: 26,
  },
  definitions: {
    title: 'Definitions Schema',
    description: 'Reusable tag and type definitions.',
    category: 'definitions',
    order: 30,
  },
  tag: {
    title: 'Tag Schema',
    description: 'A tag definition for categorization.',
    category: 'definitions',
    order: 31,
  },
  type: {
    title: 'Type Schema',
    description: 'A type definition for extensible classification.',
    category: 'definitions',
    order: 32,
  },
  value: {
    title: 'Value Definition Schema',
    description: 'Defines the meaning of a controlled vocabulary value.',
    category: 'definitions',
    order: 33,
  },
  derivation: {
    title: 'Derivation Schema',
    description:
      'The derivation layer — compiled output linked to world and narrative elements.',
    category: 'derivation',
    order: 40,
  },
  rendering: {
    title: 'Rendering Schema',
    description:
      'A specific text output — one lens, one format, structured content.',
    category: 'derivation',
    order: 41,
  },
  section: {
    title: 'Section Schema',
    description:
      'A structural unit of derived text — recursive hierarchy mirroring the Format structure.',
    category: 'derivation',
    order: 42,
  },
  passage: {
    title: 'Passage Schema',
    description:
      'A unit of prose text within a section — the leaf content of a rendering.',
    category: 'derivation',
    order: 43,
  },
  'derivation-meta': {
    title: 'Derivation Meta Schema',
    description: 'Validation contract for a compiled output.',
    category: 'derivation',
    order: 44,
  },
};

// ── 1. Schema pages ──────────────────────────────────────────────
function prepareSchemas() {
  const outDir = join(CONTENT_DIR, 'schemas');
  ensureDir(outDir);

  for (const [slug, meta] of Object.entries(SCHEMA_META)) {
    const generatedPath = join(GENERATED_DIR, 'schemas', `${slug}.md`);
    const generated = readFile(generatedPath);

    const frontmatter = [
      '---',
      `title: "${meta.title}"`,
      `description: "${meta.description.replace(/"/g, '\\"')}"`,
      `category: "${meta.category}"`,
      `order: ${meta.order}`,
      '---',
      '',
    ].join('\n');

    let content = frontmatter;
    content += `${meta.description}\n\n`;

    if (generated) {
      const genContent = generated.replace(/^# Schema Docs\n*/, '');
      content += genContent;
    } else {
      content +=
        '*Schema reference documentation will be generated during build.*\n';
    }

    writeFileSync(join(outDir, `${slug}.md`), content);
  }

  console.log(`✓ ${Object.keys(SCHEMA_META).length} schema pages prepared`);
}

// ── 2. Example pages ─────────────────────────────────────────────
function prepareExamples() {
  const outDir = join(CONTENT_DIR, 'examples');
  ensureDir(outDir);

  const generatedDir = join(GENERATED_DIR, 'examples');
  if (!existsSync(generatedDir)) {
    console.log(
      '⚠ No generated example docs found (run generate-example-docs.py first)',
    );
    return;
  }

  const files = readdirSync(generatedDir).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const slug = basename(file, '.md');
    let content = readFileSync(join(generatedDir, file), 'utf-8');

    const titleMatch = content.match(/^# (.+)$/m);
    const title = titleMatch
      ? titleMatch[1]
      : slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const lines = content.split('\n');
    let desc = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        desc = trimmed.substring(0, 160);
        break;
      }
    }

    const frontmatter = [
      '---',
      `title: "${title.replace(/"/g, '\\"')}"`,
      `description: "${desc.replace(/"/g, '\\"')}"`,
      'hasGraph: true',
      '---',
      '',
    ].join('\n');

    content = content.replace(/^# .+\n*/, '');

    writeFileSync(join(outDir, `${slug}.md`), frontmatter + content);
  }

  console.log(`✓ ${files.length} example pages prepared`);
}

// ── 3. Standalone pages ──────────────────────────────────────────
function prepareStandalonePages() {
  const outDir = join(CONTENT_DIR, 'pages');
  ensureDir(outDir);

  // Scope (from website's own content/)
  const scope = readFile(join(CONTENT_SOURCE, 'scope.md'));
  if (scope) {
    let content = scope.replace(/^# .+\n*/, '');
    writeFileSync(
      join(outDir, 'scope.md'),
      [
        '---',
        'title: "Scope & Boundaries"',
        'description: "What the Story as Code specification covers — and what it intentionally leaves to other layers."',
        '---',
        '',
        content,
      ].join('\n'),
    );
  }

  // Contributing (from spec)
  const contributing = readFile(join(SPEC_ROOT, 'CONTRIBUTING.md'));
  if (contributing) {
    writeFileSync(
      join(outDir, 'contributing.md'),
      [
        '---',
        'title: "Contributing"',
        'description: "How to participate in the development of the Story as Code specification."',
        '---',
        '',
        contributing.replace(/^# .+\n*/, ''),
      ].join('\n'),
    );
  }

  // Code of Conduct (from spec)
  const coc = readFile(join(SPEC_ROOT, 'CODE_OF_CONDUCT.md'));
  if (coc) {
    writeFileSync(
      join(outDir, 'code-of-conduct.md'),
      [
        '---',
        'title: "Code of Conduct"',
        'description: "Contributor Covenant Code of Conduct for the Story as Code project."',
        '---',
        '',
        coc.replace(/^# .+\n*/, ''),
      ].join('\n'),
    );
  }

  // License (from spec)
  const license = readFile(join(SPEC_ROOT, 'LICENSE'));
  if (license) {
    writeFileSync(
      join(outDir, 'license.md'),
      [
        '---',
        'title: "License"',
        'description: "Apache License 2.0"',
        '---',
        '',
        '```',
        license,
        '```',
      ].join('\n'),
    );
  }

  console.log('✓ Standalone pages prepared');
}

// ── 4. Resolved JSON data ────────────────────────────────────────
function copyResolvedData() {
  const dataDir = join(PUBLIC_DIR, 'data');
  ensureDir(dataDir);

  const srcDir = join(GENERATED_DIR, 'data');
  if (!existsSync(srcDir)) {
    console.log('⚠ No resolved data found (run resolve-story.py first)');
    return;
  }

  const files = readdirSync(srcDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    copyFileSync(join(srcDir, file), join(dataDir, file));
  }
  console.log(`✓ ${files.length} resolved JSON files copied`);
}

// ── Main ─────────────────────────────────────────────────────────
console.log('Preparing content for Astro...\n');

prepareSchemas();
prepareExamples();
prepareStandalonePages();
copyResolvedData();

console.log('\nContent preparation complete.');
