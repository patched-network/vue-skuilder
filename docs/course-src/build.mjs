#!/usr/bin/env node
// Builds the docs-site course from markdown source into a static course bundle.
//
//   node docs/course-src/build.mjs        (or: yarn docs:course)
//
// Source: docs/course-src/sections/*.md (format in docs/course-src/README.md).
// Output: docs/public/static-courses/skuilder-docs/ (manifest, chunks, indices, skuilder.json).
//
// The documents are built in an in-memory PouchDB and packed with the framework's own
// CouchDBToStaticPacker, so the output is exactly what `skuilder pack` would produce from a
// CouchDB course with the same documents. Card IDs come from the slugs in the source, so a
// rebuild keeps learners' history attached to the same cards.

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PouchDB from 'pouchdb';
import memoryAdapter from 'pouchdb-adapter-memory';
import { CouchDBToStaticPacker } from '@vue-skuilder/db/packer';

PouchDB.plugin(memoryAdapter);

const here = path.dirname(fileURLToPath(import.meta.url));
const SECTIONS_DIR = path.join(here, 'sections');
const OUT_DIR = path.resolve(here, '../public/static-courses/skuilder-docs');

const COURSE_ID = 'skuilder-docs';
const COURSE_NAME = 'vue-skuilder: a tour';
const AUTHOR = 'skuilder-docs';
const DATASHAPE = 'default.datashape.Blanks';
const QUESTION = 'default.question.BlanksCard';
const VIEW_ID = 'default.question.BlanksCard.FillInView';
const DEFAULT_ELO = 1000;

// ---------------------------------------------------------------------------
// Source parsing
// ---------------------------------------------------------------------------

function parseSection(file, text) {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!fm) throw new Error(`${file}: missing front matter`);
  const meta = {};
  for (const line of fm[1].split('\n')) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (m) meta[m[1]] = m[2].trim();
  }
  if (!meta.section) throw new Error(`${file}: front matter needs 'section'`);

  const body = text.slice(fm[0].length);
  const items = [];
  const re = /^## (intro|card) ([a-z0-9-]+)((?: \w+=\S+)*)\s*$/gm;
  const heads = [...body.matchAll(re)];
  heads.forEach((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].index : body.length;
    const md = body.slice(h.index + h[0].length, end).trim();
    const attrs = Object.fromEntries(
      h[3].trim().split(/\s+/).filter(Boolean).map((kv) => kv.split('='))
    );
    items.push({ kind: h[1], slug: h[2], md, elo: Number(attrs.elo ?? DEFAULT_ELO), file });
  });

  return {
    section: meta.section,
    title: meta.title || meta.section,
    pages: (meta.pages || '').split(',').map((p) => p.trim()).filter(Boolean),
    open: meta.open === 'true',
    items,
  };
}

// The default card type keeps only one blank's answers, and a blank that is the very last text
// of a card doesn't render (docs: Default Cards). Catch both at build time.
function lint(item) {
  const blanks = item.md.match(/\{\{[\s\S]*?\}\}/g) || [];
  const where = `${item.file} ${item.kind} ${item.slug}`;
  if (item.kind === 'intro' && blanks.length) throw new Error(`${where}: intro cards take no blanks`);
  if (item.kind === 'card' && blanks.length !== 1)
    throw new Error(`${where}: expected exactly one blank, found ${blanks.length}`);
  if (item.kind === 'card') {
    const last = item.md.lastIndexOf('}}');
    const after = item.md.slice(last + 2);
    const ownLine = /\n\s*\{\{[^\n]*\}\}\s*$/.test(item.md);
    if (!after.trim() && !ownLine)
      throw new Error(`${where}: a blank can't be the last text of a card; add punctuation`);
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const eloFor = (score, tags) => ({
  global: { score, count: 0 },
  tags: Object.fromEntries(tags.map((t) => [t, { score, count: 0 }])),
  misc: {},
});

function buildDocs(sections, contentVersion) {
  const docs = [];
  const tagged = new Map(); // tag -> card ids
  const tag = (name, cardId) => {
    if (!tagged.has(name)) tagged.set(name, []);
    tagged.get(name).push(cardId);
  };

  for (const s of sections) {
    for (const item of s.items) {
      lint(item);
      const cardId = `c-skdocs-${item.slug}`;
      const ddId = `dd-skdocs-${item.slug}`;
      const tags = [`docs:${item.kind === 'intro' ? 'intro' : 'exercise'}:${s.section}`];
      docs.push({
        _id: ddId,
        docType: 'DISPLAYABLE_DATA',
        course: COURSE_ID,
        author: AUTHOR,
        id_datashape: DATASHAPE,
        data: [{ name: 'Input', data: item.md }, { name: 'Uploads' }],
      });
      docs.push({
        _id: cardId,
        docType: 'CARD',
        course: COURSE_ID,
        author: AUTHOR,
        id_displayable_data: [ddId],
        id_view: VIEW_ID,
        elo: eloFor(item.elo, tags),
      });
      tags.forEach((t) => tag(t, cardId));
    }
  }

  for (const [name, cardIds] of tagged) {
    const [, role, section] = name.split(':');
    const title = sections.find((s) => s.section === section)?.title ?? section;
    docs.push({
      _id: `TAG-${name}`,
      docType: 'TAG',
      course: COURSE_ID,
      author: AUTHOR,
      name,
      snippet: role === 'intro' ? `Introduction: ${title}` : `Questions: ${title}`,
      wiki: '',
      taggedCards: cardIds,
    });
  }

  // The docs site registers 'docsReadingGate' (docs/.vitepress/theme/docsCourse/). An app that
  // hasn't registered it skips this strategy with a warning and serves the course ungated.
  const gateConfig = {
    sections: Object.fromEntries(
      sections.map((s) => [s.section, { title: s.title, pages: s.pages, ...(s.open ? { open: true } : {}) }])
    ),
    freshBoost: 2,
    readIntroFactor: 0.1,
  };
  docs.push({
    _id: 'NAVIGATION_STRATEGY-docs-reading-gate',
    docType: 'NAVIGATION_STRATEGY',
    course: COURSE_ID,
    author: AUTHOR,
    name: 'Docs reading gate',
    description:
      "Holds back a section's questions until the learner has read its docs page or met its intro card.",
    implementingClass: 'docsReadingGate',
    serializedData: JSON.stringify(gateConfig),
  });

  docs.push({
    _id: 'CourseConfig',
    courseID: COURSE_ID,
    name: COURSE_NAME,
    description: 'A short course on vue-skuilder itself, embedded in its documentation.',
    public: true,
    deleted: false,
    creator: AUTHOR,
    admins: [],
    moderators: [],
    dataShapes: [{ name: DATASHAPE, questionTypes: [QUESTION] }],
    questionTypes: [{ name: QUESTION, viewList: ['FillInView'], dataShapeList: [DATASHAPE] }],
    contentVersion,
  });

  return docs;
}

// The course views the packer indexes (same as packages/express/src/design-docs.ts).
const designDocs = [
  {
    _id: '_design/elo',
    views: {
      elo: {
        map: `function (doc) {
          if (doc.docType && doc.docType === 'CARD') {
            if (doc.elo && typeof(doc.elo) === 'number') { emit(doc.elo, doc._id); }
            else if (doc.elo && doc.elo.global) { emit(doc.elo.global.score, doc._id); }
            else if (doc.elo) { emit(doc.elo.score, doc._id); }
            else { emit(995 + Math.round(10 * Math.random()), doc._id); }
          }
        }`,
      },
    },
  },
  {
    _id: '_design/getTags',
    views: {
      getTags: {
        map: `function (doc) {
          if (doc.docType && doc.docType === "TAG") {
            for (var cardIndex in doc.taggedCards) {
              emit(doc.taggedCards[cardIndex], {
                docType: doc.docType, name: doc.name, snippit: doc.snippet, wiki: '', taggedCards: []
              });
            }
          }
        }`,
      },
    },
  },
  {
    _id: '_design/cardsByInexperience',
    views: {
      cardsByInexperience: {
        map: `function (doc) {
          if (doc.docType && doc.docType === 'CARD') {
            if (doc.elo && doc.elo.global && typeof doc.elo.global.count == 'number') {
              emit(doc.elo.global.count, doc.elo);
            } else if (doc.elo && typeof doc.elo == 'number') { emit(0, doc.elo); }
            else { emit(0, 995 + Math.floor(10 * Math.random())); }
          }
        }`,
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

const fsAdapter = {
  readFile: (p) => fs.readFile(p, 'utf8'),
  readBinary: (p) => fs.readFile(p),
  exists: (p) => fs.access(p).then(() => true, () => false),
  stat: async (p) => {
    const s = await fs.stat(p);
    return { isFile: () => s.isFile(), isDirectory: () => s.isDirectory(), size: s.size };
  },
  readdir: (p) => fs.readdir(p),
  ensureDir: (p) => fs.mkdir(p, { recursive: true }),
  writeFile: (p, d) => fs.writeFile(p, d),
  writeJson: (p, d, o) => fs.writeFile(p, JSON.stringify(d, null, o?.spaces ?? 0)),
  joinPath: (...ps) => path.join(...ps),
  dirname: (p) => path.dirname(p),
  basename: (p) => path.basename(p),
  isAbsolute: (p) => path.isAbsolute(p),
};

async function main() {
  const files = (await fs.readdir(SECTIONS_DIR)).filter((f) => f.endsWith('.md')).sort();
  const sources = await Promise.all(files.map((f) => fs.readFile(path.join(SECTIONS_DIR, f), 'utf8')));
  const contentVersion = createHash('sha1').update(sources.join('\0')).digest('hex').slice(0, 12);
  const sections = files.map((f, i) => parseSection(f, sources[i]));

  const slugs = sections.flatMap((s) => s.items.map((i) => i.slug));
  const dup = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dup) throw new Error(`duplicate slug: ${dup}`);

  const docs = buildDocs(sections, contentVersion);
  const db = new PouchDB(`skdocs-${Date.now()}`, { adapter: 'memory' });
  await db.bulkDocs([...designDocs, ...docs]);

  await fs.rm(OUT_DIR, { recursive: true, force: true });
  const packer = new CouchDBToStaticPacker({ includeAttachments: false });
  const { manifest, filesWritten } = await packer.packCourseToFiles(db, COURSE_ID, OUT_DIR, fsAdapter);

  await fs.writeFile(
    path.join(OUT_DIR, 'skuilder.json'),
    JSON.stringify(
      {
        name: '@skuilder/docs-course',
        version: '0.1.0',
        description: 'A short course on vue-skuilder, embedded in its documentation.',
        content: { type: 'static', manifest: './manifest.json' },
      },
      null,
      2
    ) + '\n'
  );
  await db.destroy();

  const counts = sections.map((s) => `${s.section}: ${s.items.length}`).join(', ');
  console.log(
    `[docs-course] ${manifest.documentCount} documents, ${filesWritten + 1} files, ` +
      `content ${contentVersion} -> ${path.relative(process.cwd(), OUT_DIR)}\n[docs-course] ${counts}`
  );
}

main().catch((e) => {
  console.error('[docs-course] build failed:', e.message ?? e);
  process.exit(1);
});
