#!/usr/bin/env node
/**
 * Pre-build content preparation script.
 *
 * Bridges the existing Python-generated docs into Astro content collections:
 * 1. Schema pages: merges hand-written wrapper + generated reference
 * 2. Example pages: copies generated markdown with frontmatter
 * 3. Standalone pages: copies with frontmatter
 * 4. Root files: processes README, CONTRIBUTING, CODE_OF_CONDUCT, LICENSE
 * 5. Resolved JSON: copies to public/data/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SPEC_ROOT = join(REPO_ROOT, 'spec');
const DOCS_DIR = join(SPEC_ROOT, 'docs');
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
  'story':           { title: 'Story Schema',           description: 'Root document of a Story as Code project.',                            category: 'root',        order: 0  },
  'world':           { title: 'World Schema',           description: 'The world graph — ground truth of the story universe.',                category: 'world',       order: 10 },
  'time-system':     { title: 'Time System Schema',     description: 'Defines how time works in this world.',                                category: 'world',       order: 11 },
  'node':            { title: 'Node Schema',            description: 'An entity in the world graph.',                                        category: 'world',       order: 12 },
  'edge':            { title: 'Edge Schema',            description: 'A relationship between nodes.',                                        category: 'world',       order: 13 },
  'frame':           { title: 'Frame Schema',           description: 'An alternative timeline or branch.',                                   category: 'world',       order: 14 },
  'constraint':      { title: 'Constraint Schema',      description: 'A world rule with scope filters and severity levels.',                  category: 'world',       order: 15 },
  'narrative':       { title: 'Narrative Schema',       description: 'The narrative layer — storytelling perspective on the world.',           category: 'narrative',   order: 20 },
  'lens':            { title: 'Lens Schema',            description: 'Narrative perspective — filters and interprets world content.',          category: 'narrative',   order: 21 },
  'format':          { title: 'Format Schema',          description: 'Output format definition with structural hierarchy and pacing rules.',   category: 'narrative',   order: 22 },
  'beat':            { title: 'Beat Schema',            description: 'A story beat — selects world elements and adds dramaturgical structure.',category: 'narrative',   order: 23 },
  'device':          { title: 'Device Schema',          description: 'A narrative device — rhetorical connection between beats.',              category: 'narrative',   order: 24 },
  'thread':          { title: 'Thread Schema',          description: 'A thematic thread — horizontal chaining across storylines.',             category: 'narrative',   order: 25 },
  'variant-meta':    { title: 'Variant Meta Schema',    description: 'Parallel world version metadata.',                                      category: 'narrative',   order: 26 },
  'definitions':     { title: 'Definitions Schema',     description: 'Reusable tag and type definitions.',                                    category: 'definitions', order: 30 },
  'tag':             { title: 'Tag Schema',             description: 'A tag definition for categorization.',                                  category: 'definitions', order: 31 },
  'type':            { title: 'Type Schema',            description: 'A type definition for extensible classification.',                      category: 'definitions', order: 32 },
  'derivation-meta': { title: 'Derivation Meta Schema', description: 'Validation contract for a compiled output.',                            category: 'derivation',  order: 40 },
};

// ── 1. Schema pages ──────────────────────────────────────────────
function prepareSchemas() {
  const outDir = join(CONTENT_DIR, 'schemas');
  ensureDir(outDir);

  for (const [slug, meta] of Object.entries(SCHEMA_META)) {
    // Read hand-written wrapper (first two lines: # Title + description)
    const wrapperPath = join(DOCS_DIR, 'schemas', `${slug}.md`);
    const wrapper = readFile(wrapperPath);

    // Read generated reference
    const generatedPath = join(DOCS_DIR, 'schemas', 'generated', `${slug}.md`);
    const generated = readFile(generatedPath);

    // Extract description from wrapper (second non-empty line)
    let desc = meta.description;
    if (wrapper) {
      const lines = wrapper.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('{%') && !l.includes('include-markdown'));
      if (lines.length > 0) desc = lines[0].trim();
    }

    // Build frontmatter
    const frontmatter = [
      '---',
      `title: "${meta.title}"`,
      `description: "${desc.replace(/"/g, '\\"')}"`,
      `category: "${meta.category}"`,
      `order: ${meta.order}`,
      '---',
      '',
    ].join('\n');

    // Merge: description + generated reference (skip first "# Schema Docs" heading from generated)
    let content = frontmatter;
    content += `${desc}\n\n`;

    if (generated) {
      // Strip the first "# Schema Docs" line if present
      const genContent = generated.replace(/^# Schema Docs\n*/, '');
      content += genContent;
    } else {
      content += '*Schema reference documentation will be generated during build.*\n';
    }

    writeFileSync(join(outDir, `${slug}.md`), content);
  }

  console.log(`✓ ${Object.keys(SCHEMA_META).length} schema pages prepared`);
}

// ── 2. Schema index (hand-written, no include-markdown) ──────────
function prepareSchemaIndex() {
  const outDir = join(CONTENT_DIR, 'schemas');
  ensureDir(outDir);

  const indexContent = readFile(join(DOCS_DIR, 'schemas', 'index.md'));
  if (!indexContent) return;

  // Rewrite links from relative MkDocs to Astro paths
  let processed = indexContent
    .replace(/\(story\.md\)/g, '(/schemas/story/)')
    .replace(/\(world\.md\)/g, '(/schemas/world/)')
    .replace(/\(time-system\.md\)/g, '(/schemas/time-system/)')
    .replace(/\(node\.md\)/g, '(/schemas/node/)')
    .replace(/\(edge\.md\)/g, '(/schemas/edge/)')
    .replace(/\(frame\.md\)/g, '(/schemas/frame/)')
    .replace(/\(constraint\.md\)/g, '(/schemas/constraint/)')
    .replace(/\(narrative\.md\)/g, '(/schemas/narrative/)')
    .replace(/\(lens\.md\)/g, '(/schemas/lens/)')
    .replace(/\(format\.md\)/g, '(/schemas/format/)')
    .replace(/\(beat\.md\)/g, '(/schemas/beat/)')
    .replace(/\(device\.md\)/g, '(/schemas/device/)')
    .replace(/\(thread\.md\)/g, '(/schemas/thread/)')
    .replace(/\(variant-meta\.md\)/g, '(/schemas/variant-meta/)')
    .replace(/\(definitions\.md\)/g, '(/schemas/definitions/)')
    .replace(/\(tag\.md\)/g, '(/schemas/tag/)')
    .replace(/\(type\.md\)/g, '(/schemas/type/)')
    .replace(/\(derivation-meta\.md\)/g, '(/schemas/derivation-meta/)');

  const frontmatter = [
    '---',
    'title: "Schemas"',
    'description: "Schema reference for the Story as Code specification."',
    '---',
    '',
  ].join('\n');

  // Remove the first heading (we render it in the page)
  processed = processed.replace(/^# Schemas\n*/, '');

  writeFileSync(join(outDir, '_index.md'), frontmatter + processed);
  console.log('✓ Schema index prepared');
}

// ── 3. Example pages ─────────────────────────────────────────────
function prepareExamples() {
  const outDir = join(CONTENT_DIR, 'examples');
  ensureDir(outDir);

  const generatedDir = join(DOCS_DIR, 'examples', 'generated');
  if (!existsSync(generatedDir)) {
    console.log('⚠ No generated example docs found (run generate-example-docs.py first)');
    return;
  }

  const files = readdirSync(generatedDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const slug = basename(file, '.md');
    let content = readFileSync(join(generatedDir, file), 'utf-8');

    // Extract title from first heading
    const titleMatch = content.match(/^# (.+)$/m);
    const title = titleMatch ? titleMatch[1] : slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Extract description (first non-heading, non-empty line)
    const lines = content.split('\n');
    let desc = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        desc = trimmed.substring(0, 160);
        break;
      }
    }

    // Convert pymdownx ??? syntax to HTML <details>/<summary>
    content = content.replace(
      /\?\?\? example "([^"]+)"\n\n((?:    .*\n?)*)/g,
      (_, title, body) => {
        const unindented = body.replace(/^    /gm, '');
        return `<details>\n<summary>${title}</summary>\n\n${unindented}\n</details>\n`;
      }
    );

    const frontmatter = [
      '---',
      `title: "${title.replace(/"/g, '\\"')}"`,
      `description: "${desc.replace(/"/g, '\\"')}"`,
      'hasGraph: true',
      '---',
      '',
    ].join('\n');

    // Remove the first heading (rendered by page template)
    content = content.replace(/^# .+\n*/, '');

    writeFileSync(join(outDir, `${slug}.md`), frontmatter + content);
  }

  console.log(`✓ ${files.length} example pages prepared`);
}

// ── 4. Standalone pages ──────────────────────────────────────────
function prepareStandalonePages() {
  const outDir = join(CONTENT_DIR, 'pages');
  ensureDir(outDir);

  // Scope
  const scope = readFile(join(DOCS_DIR, 'scope.md'));
  if (scope) {
    let content = scope.replace(/^# .+\n*/, '');
    // Fix schema links
    content = content.replace(/\(schemas\/constraint\.md\)/g, '(/schemas/constraint/)');
    content = content.replace(/\(schemas\/derivation-meta\.md\)/g, '(/schemas/derivation-meta/)');

    writeFileSync(join(outDir, 'scope.md'), [
      '---',
      'title: "Scope & Boundaries"',
      'description: "What the Story as Code specification covers — and what it intentionally leaves to other layers."',
      '---',
      '',
      content,
    ].join('\n'));
  }

  // Contributing
  const contributing = readFile(join(SPEC_ROOT, 'CONTRIBUTING.md'));
  if (contributing) {
    writeFileSync(join(outDir, 'contributing.md'), [
      '---',
      'title: "Contributing"',
      'description: "How to participate in the development of the Story as Code specification."',
      '---',
      '',
      contributing.replace(/^# .+\n*/, ''),
    ].join('\n'));
  }

  // Code of Conduct
  const coc = readFile(join(SPEC_ROOT, 'CODE_OF_CONDUCT.md'));
  if (coc) {
    writeFileSync(join(outDir, 'code-of-conduct.md'), [
      '---',
      'title: "Code of Conduct"',
      'description: "Contributor Covenant Code of Conduct for the Story as Code project."',
      '---',
      '',
      coc.replace(/^# .+\n*/, ''),
    ].join('\n'));
  }

  // License
  const license = readFile(join(SPEC_ROOT, 'LICENSE'));
  if (license) {
    writeFileSync(join(outDir, 'license.md'), [
      '---',
      'title: "License"',
      'description: "Apache License 2.0"',
      '---',
      '',
      '```',
      license,
      '```',
    ].join('\n'));
  }

  console.log('✓ Standalone pages prepared');
}

// ── 5. Resolved JSON data ────────────────────────────────────────
function copyResolvedData() {
  const dataDir = join(PUBLIC_DIR, 'data');
  ensureDir(dataDir);

  const srcDir = join(DOCS_DIR, 'assets', 'data');
  if (!existsSync(srcDir)) {
    console.log('⚠ No resolved data found (run resolve-story.py first)');
    return;
  }

  const files = readdirSync(srcDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    copyFileSync(join(srcDir, file), join(dataDir, file));
  }
  console.log(`✓ ${files.length} resolved JSON files copied`);
}

// ── Main ─────────────────────────────────────────────────────────
console.log('Preparing content for Astro...\n');

prepareSchemas();
prepareSchemaIndex();
prepareExamples();
prepareStandalonePages();
copyResolvedData();

console.log('\nContent preparation complete.');
