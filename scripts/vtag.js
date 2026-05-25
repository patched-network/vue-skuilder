#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const PACKAGES = [
  'common',
  'db',
  'common-ui',
  'courseware',
  'edit-ui',
  'client',
  'platform-ui',
  'standalone-ui',
  'studio-ui',
  'express',
  'mcp',
  'cli',
];

const ROOT = path.join(__dirname, '..');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit', cwd: ROOT });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    proc.on('error', reject);
  });
}

function readCurrentVersion() {
  const versions = new Map();
  for (const pkg of PACKAGES) {
    const p = path.join(ROOT, 'packages', pkg, 'package.json');
    if (!fs.existsSync(p)) continue;
    const { version } = JSON.parse(fs.readFileSync(p, 'utf8'));
    versions.set(pkg, version);
  }
  return versions;
}

function bumpVersion(version, type) {
  // Strip prerelease suffix before bumping
  const base = version.replace(/-.*$/, '');
  const [major, minor, patch] = base.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  if (type === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump type: ${type}`);
}

function applyVersion(tagString) {
  for (const pkg of PACKAGES) {
    const p = path.join(ROOT, 'packages', pkg, 'package.json');
    if (!fs.existsSync(p)) { console.error(`❌ Package not found: ${pkg}`); continue; }
    try {
      const json = JSON.parse(fs.readFileSync(p, 'utf8'));
      const old = json.version;
      json.version = tagString;
      if (!tagString.includes('-')) {
        if (json.stableVersion && json.stableVersion !== tagString)
          console.log(`  📌 stableVersion: ${json.stableVersion} → ${tagString}`);
        json.stableVersion = tagString;
      }
      fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
      console.log(`✅ ${pkg}: ${old} → ${tagString}`);
    } catch (e) {
      console.error(`❌ Failed to update ${pkg}: ${e.message}`);
    }
  }
}

async function runRelease(tagString) {
  if (tagString.startsWith('v')) {
    console.error('Version string should not start with "v".');
    process.exit(1);
  }

  console.log(`\n🏷️  Setting all packages to version: ${tagString}`);
  applyVersion(tagString);

  console.log('\n📦 Updating yarn lockfile...');
  await run('yarn', ['install']);
  console.log('✅ Yarn lockfile updated');

  console.log('\n📝 Committing changes...');
  await run('git', ['commit', '-am', `bump: version ${tagString}`]);
  console.log('✅ Changes committed');

  console.log(`\n🏷️  Creating git tag: v${tagString}`);
  await run('git', ['tag', `v${tagString}`]);
  console.log(`✅ Git tag v${tagString} created`);

  const push = await ask(`\nPush v${tagString} to trigger publish? [y/N] `);
  if (push.toLowerCase() === 'y') {
    console.log(`\n🚀 Pushing tag...`);
    await run('git', ['push', 'origin', `v${tagString}`]);
    console.log(`✅ Tag pushed — publish workflow triggered`);
  } else {
    console.log(`\nSkipped push. Run when ready:\n  git push origin v${tagString}`);
  }
}

async function main() {
  const tagString = process.argv[2];

  if (tagString) {
    await runRelease(tagString);
    return;
  }

  // Interactive mode
  const versions = readCurrentVersion();
  const uniqueVersions = [...new Set(versions.values())];

  if (uniqueVersions.length === 1) {
    console.log(`Current version: ${uniqueVersions[0]}`);
  } else {
    console.log('Packages have divergent versions:');
    for (const [pkg, v] of versions) console.log(`  ${pkg}@${v}`);
    process.exit(0);
  }

  const current = uniqueVersions[0];
  const major = bumpVersion(current, 'major');
  const minor = bumpVersion(current, 'minor');
  const patch = bumpVersion(current, 'patch');

  console.log(`\n  M) major → ${major}`);
  console.log(`  m) minor → ${minor}`);
  console.log(`  p) patch → ${patch}`);

  const choice = await ask('\nBump type [M/m/p] or enter version directly, blank to cancel: ');

  let next;
  if (choice === 'M') next = major;
  else if (choice === 'm') next = minor;
  else if (choice === 'p') next = patch;
  else if (choice === '') { console.log('Cancelled.'); return; }
  else if (/^\d+\.\d+\.\d+/.test(choice)) next = choice;
  else { console.error(`Unrecognised input: ${choice}`); process.exit(1); }

  const confirm = await ask(`\nBump ${current} → ${next}? [y/N] `);
  if (confirm.toLowerCase() !== 'y') { console.log('Cancelled.'); return; }

  await runRelease(next);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
