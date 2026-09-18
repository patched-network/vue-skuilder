/**
 * Test matrix for assets/courseValidateDocUpdate.js against a REAL CouchDB.
 *
 * The validate_doc_update function runs inside CouchDB's SpiderMonkey (ES5),
 * so unit-testing it in Node proves little. This script creates a scratch
 * course DB on the local dev couch, installs the validator, seeds a CARD doc
 * as admin, then exercises the dynamic-card-ELO rules as a non-admin user.
 *
 * Prereqs: a couch with admin `admin`/`password` (local: `yarn couchdb:start`
 * at repo root). The non-admin user `test`/`test` is created if missing.
 * Runs in CI (ci-pkg-express.yml) against the workflow's couch.
 *
 * Usage (from packages/express):
 *   npx tsx scripts/test-course-validator.ts
 *
 * Env overrides: COUCH_URL, COUCH_ADMIN, COUCH_ADMIN_PW, COUCH_USER, COUCH_USER_PW
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COUCH_URL = process.env.COUCH_URL ?? 'http://localhost:5984';
const ADMIN = { name: process.env.COUCH_ADMIN ?? 'admin', pw: process.env.COUCH_ADMIN_PW ?? 'password' };
const USER = { name: process.env.COUCH_USER ?? 'test', pw: process.env.COUCH_USER_PW ?? 'test' };
const DB = 'coursedb-validator-test';

const validatorSource = readFileSync(join(__dirname, '..', 'assets', 'courseValidateDocUpdate.js'), 'utf-8');

type Cred = { name: string; pw: string };
type Doc = Record<string, unknown> & { _id: string; _rev?: string };

async function req(cred: Cred, method: string, path: string, body?: unknown) {
  const res = await fetch(`${COUCH_URL}/${path}`, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${cred.name}:${cred.pw}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

async function getDoc(cred: Cred, id: string): Promise<Doc> {
  const r = await req(cred, 'GET', `${DB}/${encodeURIComponent(id)}`);
  if (r.status !== 200) throw new Error(`GET ${id} -> ${r.status} ${JSON.stringify(r.json)}`);
  return r.json as Doc;
}

async function put(cred: Cred, doc: Doc) {
  return req(cred, 'PUT', `${DB}/${encodeURIComponent(doc._id)}`, doc);
}

// ---- fixtures ---------------------------------------------------------------

const CARD_ID = 'c-test-card-1';
const TAG_A = 'gpc:exercise:a-AE';
const TAG_B = 'ui:missing-letters';

function freshCard(): Doc {
  return {
    _id: CARD_ID,
    course: 'ExampleCourse',
    docType: 'CARD',
    id_displayable_data: ['dd-test-card-1'],
    id_view: 'ExampleCourse.question.MissingLetters.MissingLettersView',
    elo: {
      global: { score: 1405, count: 3 },
      tags: {
        [TAG_A]: { score: 1404, count: 3 },
        [TAG_B]: { score: 1408, count: 0 },
      },
      misc: {},
    },
    seedElo: {
      global: { score: 1405, count: 0 },
      tags: {
        [TAG_A]: { score: 1404, count: 0 },
        [TAG_B]: { score: 1408, count: 0 },
      },
      misc: {},
    },
    author: 'content-pipeline-v1',
    sourceRef: 'gen:content-pipeline-v1',
  };
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// ---- harness ----------------------------------------------------------------

type Expect = { status: number; reasonIncludes?: string };
const results: { name: string; pass: boolean; detail: string }[] = [];

async function check(name: string, run: () => Promise<{ status: number; json: any }>, expect: Expect) {
  const r = await run();
  const reason: string = r.json?.reason ?? '';
  let pass = r.status === expect.status;
  if (pass && expect.reasonIncludes) pass = reason.includes(expect.reasonIncludes);
  results.push({
    name,
    pass,
    detail: `${r.status}${reason ? ' ' + reason : ''}${pass ? '' : `  (expected ${expect.status}${expect.reasonIncludes ? ' ~ "' + expect.reasonIncludes + '"' : ''})`}`,
  });
}

/** Reset the card as admin so each case starts from a known state. */
async function resetCard(): Promise<Doc> {
  const existing = await req(ADMIN, 'GET', `${DB}/${encodeURIComponent(CARD_ID)}`);
  const doc = freshCard();
  if (existing.status === 200) doc._rev = (existing.json as Doc)._rev;
  const r = await put(ADMIN, doc);
  if (r.status !== 201) throw new Error(`admin reset failed: ${r.status} ${JSON.stringify(r.json)}`);
  return getDoc(USER, CARD_ID);
}

/** A realistic one-step elo update touching global + TAG_A (TAG_B untouched). */
function stepped(doc: Doc, dScore = -12): Doc {
  const d = clone(doc);
  const elo: any = d.elo;
  elo.global = { score: elo.global.score + dScore, count: elo.global.count + 1 };
  elo.tags[TAG_A] = { score: elo.tags[TAG_A].score + dScore, count: elo.tags[TAG_A].count + 1 };
  return d;
}

async function main() {
  // Ensure the non-admin user exists (CI couch starts with only the admin).
  // Idempotent: a 409 means it is already there.
  const userDocId = `_users/org.couchdb.user:${USER.name}`;
  const mk = await req(ADMIN, 'PUT', userDocId, {
    name: USER.name,
    password: USER.pw,
    roles: [],
    type: 'user',
  });
  if (mk.status !== 201 && mk.status !== 409) {
    throw new Error(`could not create non-admin user ${USER.name}: ${mk.status} ${JSON.stringify(mk.json)}`);
  }

  // sanity: non-admin user must authenticate and not be admin
  const sess = await req(USER, 'GET', '_session');
  if (sess.status !== 200 || sess.json?.userCtx?.name !== USER.name) {
    throw new Error(`non-admin user ${USER.name} cannot authenticate: ${sess.status} ${JSON.stringify(sess.json)}`);
  }
  if ((sess.json.userCtx.roles as string[]).includes('_admin')) throw new Error(`${USER.name} is an admin; test is meaningless`);

  // scratch DB
  await req(ADMIN, 'DELETE', DB);
  const create = await req(ADMIN, 'PUT', DB);
  if (create.status !== 201) throw new Error(`create ${DB}: ${create.status} ${JSON.stringify(create.json)}`);
  // members: [] => any authenticated user can read/write (matches LP prod _security)
  await req(ADMIN, 'PUT', `${DB}/_security`, {
    admins: { names: [], roles: ['_admin'] },
    members: { names: [], roles: [] },
  });
  const dd = await put(ADMIN, { _id: '_design/_auth', validate_doc_update: validatorSource });
  if (dd.status !== 201) throw new Error(`install validator: ${dd.status} ${JSON.stringify(dd.json)}`);

  try {
    // 1. elo-only write within bounds -> 201
    let doc = await resetCard();
    await check('1. elo-only bounded step (global + one tag, other tag untouched)', () => put(USER, stepped(doc)), { status: 201 });

    // 1b. max-magnitude step (exactly 64) -> 201
    doc = await resetCard();
    await check('1b. score delta exactly 64', () => put(USER, stepped(doc, 64)), { status: 201 });

    // 1c. key order shuffled on the round trip -> 201
    doc = await resetCard();
    {
      const s = stepped(doc);
      const shuffled: Doc = { _id: s._id } as Doc;
      for (const k of Object.keys(s).reverse()) shuffled[k] = s[k];
      await check('1c. elo-only step with reversed key order', () => put(USER, shuffled), { status: 201 });
    }

    // 2. elo + another field changed -> forbidden (elo-only message, not the author rule)
    doc = await resetCard();
    {
      const s = stepped(doc);
      s.sourceRef = 'tampered';
      await check('2a. elo step + sourceRef changed', () => put(USER, s), {
        status: 403,
        reasonIncludes: 'only the elo field may change (field "sourceRef"',
      });
    }
    doc = await resetCard();
    {
      const s = stepped(doc);
      (s.seedElo as any).global.score = 1;
      await check('2b. elo step + seedElo changed', () => put(USER, s), {
        status: 403,
        reasonIncludes: 'only the elo field may change (field "seedElo"',
      });
    }
    doc = await resetCard();
    {
      const s = stepped(doc);
      s.author = USER.name; // try to claim authorship
      await check('2c. elo step + author changed to self', () => put(USER, s), {
        status: 403,
        reasonIncludes: 'only the elo field may change (field "author"',
      });
    }
    doc = await resetCard();
    {
      const s = stepped(doc);
      s.extraField = 1;
      await check('2d. elo step + new field added', () => put(USER, s), {
        status: 403,
        reasonIncludes: 'only the elo field may change (field "extraField"',
      });
    }
    doc = await resetCard();
    {
      const s = clone(doc);
      s.sourceRef = 'tampered'; // no elo change at all
      await check('2e. non-elo field changed, elo untouched', () => put(USER, s), {
        status: 403,
        reasonIncludes: 'only the elo field may change',
      });
    }

    // 3. score delta 65 -> forbidden
    doc = await resetCard();
    await check('3. global score delta 65', () => put(USER, stepped(doc, 65)), {
      status: 403,
      reasonIncludes: 'elo.global: score may move at most 64',
    });
    doc = await resetCard();
    {
      const s = stepped(doc);
      (s.elo as any).tags[TAG_A].score += 100;
      await check('3b. tag score delta > 64', () => put(USER, s), {
        status: 403,
        reasonIncludes: `elo.tags["${TAG_A}"]: score may move at most 64`,
      });
    }

    // 4. count +2 -> forbidden
    doc = await resetCard();
    {
      const s = stepped(doc);
      (s.elo as any).global.count += 1;
      await check('4. global count +2', () => put(USER, s), {
        status: 403,
        reasonIncludes: 'elo.global: count must increment by exactly 1',
      });
    }

    // 5. count unchanged, score moved (stale retry after lost MVCC race) -> forbidden
    doc = await resetCard();
    {
      const s = stepped(doc);
      (s.elo as any).global.count -= 1;
      await check('5. global score moved, count unchanged (stale retry)', () => put(USER, s), {
        status: 403,
        reasonIncludes: 'elo.global: count must increment by exactly 1',
      });
    }

    // 6. new tag entry with count 1 -> 201; count 3 -> forbidden; far from global -> forbidden
    doc = await resetCard();
    {
      const s = stepped(doc);
      (s.elo as any).tags['gpc:exercise:t-T'] = { score: (doc.elo as any).global.score + 20, count: 1 };
      await check('6a. new tag entry count 1, near global', () => put(USER, s), { status: 201 });
    }
    doc = await resetCard();
    {
      const s = stepped(doc);
      (s.elo as any).tags['gpc:exercise:t-T'] = { score: (doc.elo as any).global.score + 20, count: 3 };
      await check('6b. new tag entry count 3', () => put(USER, s), {
        status: 403,
        reasonIncludes: 'a new tag rank must have count 1',
      });
    }
    doc = await resetCard();
    {
      const s = stepped(doc);
      (s.elo as any).tags['gpc:exercise:t-T'] = { score: 1000, count: 1 };
      await check('6c. new tag entry count 1 but 405 from global', () => put(USER, s), {
        status: 403,
        reasonIncludes: 'must start within 64 of the card global score',
      });
    }

    // 7. removing a tag entry -> forbidden
    doc = await resetCard();
    {
      const s = stepped(doc);
      delete (s.elo as any).tags[TAG_B];
      await check('7. tag entry removed', () => put(USER, s), {
        status: 403,
        reasonIncludes: `elo.tags["${TAG_B}"] may not be removed`,
      });
    }

    // 7b. misc changed -> forbidden
    doc = await resetCard();
    {
      const s = stepped(doc);
      (s.elo as any).misc = { x: { score: 1, count: 1 } };
      await check('7b. elo.misc changed', () => put(USER, s), { status: 403, reasonIncludes: 'elo.misc may not change' });
    }

    // 7c. extra field on an existing tag rank -> forbidden
    doc = await resetCard();
    {
      const s = stepped(doc);
      (s.elo as any).tags[TAG_A].recent = [];
      await check('7c. extra field added to a tag rank', () => put(USER, s), {
        status: 403,
        reasonIncludes: 'only score and count may change (field "recent")',
      });
    }

    // 7d. malformed elo (number) -> forbidden
    doc = await resetCard();
    {
      const s = clone(doc);
      s.elo = 1400;
      await check('7d. elo replaced by a number', () => put(USER, s), {
        status: 403,
        reasonIncludes: 'must have the CourseElo shape',
      });
    }

    // 8. non-CARD doc elo-only write -> forbidden (author rule)
    {
      const tag: Doc = {
        _id: 'TAG-gpc:exercise:a-AE',
        course: 'x',
        docType: 'TAG',
        name: TAG_A,
        taggedCards: [CARD_ID],
        author: 'content-pipeline-v1',
        elo: { global: { score: 1000, count: 0 }, tags: {}, misc: {} },
      };
      const r = await put(ADMIN, tag);
      if (r.status !== 201) throw new Error('seed TAG failed');
      const t = await getDoc(USER, tag._id);
      (t.elo as any).global = { score: 1010, count: 1 };
      await check('8. non-CARD (TAG) doc, elo-only bounded step', () => put(USER, t), {
        status: 403,
        reasonIncludes: 'You can only modify your own documents',
      });
    }

    // 8b. non-admin creating a card with someone else's author -> forbidden (unchanged rule)
    await check(
      '8b. non-admin creates doc with foreign author',
      () => put(USER, { ...freshCard(), _id: 'c-new-card' }),
      { status: 403, reasonIncludes: 'Document author must match your username' }
    );

    // 9. admin writes anything -> 201
    doc = await resetCard();
    {
      const s = clone(doc);
      s.sourceRef = 'admin-edit';
      (s.elo as any).global = { score: 5, count: 99 };
      delete (s.elo as any).tags[TAG_B];
      await check('9. admin: arbitrary edit incl. wild elo', () => put(ADMIN, s), { status: 201 });
    }
  } finally {
    const del = await req(ADMIN, 'DELETE', DB);
    console.log(`\ncleanup: DELETE ${DB} -> ${del.status}`);
  }

  // ---- report
  const width = Math.max(...results.map((r) => r.name.length));
  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
