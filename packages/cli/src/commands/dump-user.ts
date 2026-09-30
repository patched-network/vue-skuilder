import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { showUserError, showUserMessage } from '@vue-skuilder/common';
import { fetchLearnerDump, type LearnerDump } from '@vue-skuilder/db/diagnostics';

export function createDumpUserCommand(): Command {
  return new Command('dump-user')
    .description("Dump a learner's records for one course to a JSON file, for offline diagnosis")
    .argument('<username>', 'Learner whose user DB to read')
    .requiredOption('-c, --course <courseId>', 'Course id (the coursedb-<id> suffix)')
    .option('-s, --server <url>', 'CouchDB base URL', 'http://localhost:5984')
    .option('--admin-user <name>', 'CouchDB admin username', 'admin')
    .option(
      '-p, --password <password>',
      'CouchDB admin password (else $COUCHDB_PASSWORD, else --password-file)'
    )
    .option('--password-file <path>', 'Read the admin password from this file')
    .option('--cards <scope>', 'Course cards to include: touched | all | none', 'touched')
    .option(
      '-o, --out <path>',
      'Output file, or a directory for the default name (userdb-<username>-<stamp>.json)',
      '.'
    )
    .option('--attachments', 'Inline user-DB attachments as base64')
    .action(dumpUser);
}

interface DumpUserOptions {
  course: string;
  server: string;
  adminUser: string;
  password?: string;
  passwordFile?: string;
  cards: string;
  out: string;
  attachments?: boolean;
}

function resolvePassword(options: DumpUserOptions): string | undefined {
  if (options.password) return options.password;
  if (process.env.COUCHDB_PASSWORD) return process.env.COUCHDB_PASSWORD;
  if (options.passwordFile) return readFileSync(options.passwordFile, 'utf-8').trim();
  return undefined;
}

/** 2026-09-30T1412Z: sortable and filename-safe. */
function stamp(iso: string): string {
  return iso.slice(0, 16).replace(':', '') + 'Z';
}

function resolveOutPath(out: string, username: string, fetchedAt: string): string {
  const name = `userdb-${username}-${stamp(fetchedAt)}.json`;
  const isDir = out.endsWith('/') || (existsSync(out) && statSync(out).isDirectory());
  return resolve(isDir ? join(out, name) : out);
}

function countByPrefix(ids: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const prefix = id.startsWith('_design/') ? '_design' : id.split(/[-_:]/)[0];
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function printSummary(dump: LearnerDump): void {
  for (const [prefix, n] of countByPrefix(dump.docs.map((d) => d._id))) {
    showUserMessage(chalk.gray(`  ${String(n).padStart(5)}  ${prefix}`));
  }
  const tombstones = dump.tombstones ?? [];
  showUserMessage(chalk.gray(`tombstones: ${tombstones.length}`));
  for (const [prefix, n] of countByPrefix(tombstones.map((t) => t.id))) {
    showUserMessage(chalk.gray(`  ${String(n).padStart(5)}  ${prefix}`));
  }
  if (dump.course) {
    const c = dump.course;
    showUserMessage(
      chalk.gray(
        `course: ${c.courseId} (${c.scope}): ${c.cards.length} cards, ` +
          `${c.displayableData.length} data docs, ${c.tags.length} tags`
      )
    );
  }
  const sessions = dump.docs
    .filter((d) => d._id.startsWith('SESSION::') && d.courseId === dump.courseId)
    .map((d) => ({ start: String(d.startTime ?? ''), status: String(d.status ?? '?') }))
    .sort((a, b) => a.start.localeCompare(b.start));
  if (sessions.length) {
    const byStatus = new Map<string, number>();
    for (const s of sessions) byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);
    const statuses = [...byStatus].map(([k, v]) => `${v} ${k}`).join(', ');
    const first = sessions[0].start.slice(0, 10);
    const last = sessions[sessions.length - 1].start.slice(0, 10);
    showUserMessage(chalk.gray(`sessions: ${sessions.length} (${statuses}), ${first} .. ${last}`));
  }
}

export async function dumpUser(username: string, options: DumpUserOptions): Promise<void> {
  const password = resolvePassword(options);
  if (!password) {
    showUserError(
      chalk.red('No admin password: pass -p, set COUCHDB_PASSWORD, or use --password-file')
    );
    process.exit(2);
  }
  if (!['touched', 'all', 'none'].includes(options.cards)) {
    showUserError(chalk.red(`--cards must be touched, all, or none (got ${options.cards})`));
    process.exit(2);
  }

  showUserMessage(chalk.cyan(`Dumping ${username} / ${options.course} from ${options.server}`));
  try {
    const dump = await fetchLearnerDump({
      couchUrl: options.server,
      username,
      courseId: options.course,
      auth: { kind: 'basic', username: options.adminUser, password },
      cards: options.cards as 'touched' | 'all' | 'none',
      attachments: options.attachments === true,
    });
    const outPath = resolveOutPath(options.out, username, dump.fetchedAt);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(dump, null, 2));
    showUserMessage(chalk.green(`Wrote ${outPath}`));
    printSummary(dump);
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } };
    const cause = err.cause ? `: ${err.cause.code ?? err.cause.message}` : '';
    showUserError(chalk.red(`${err.message}${cause}`));
    process.exit(1);
  }
}
