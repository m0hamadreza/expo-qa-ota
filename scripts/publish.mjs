#!/usr/bin/env node
// Publish the current git branch as an OTA update to the self-hosted xprem server.
//
//   npm run publish:ota                 -> branch = current git branch
//   npm run publish:ota -- --branch x   -> explicit branch name
//   npm run publish:ota -- --platform all
//
// The xprem branch gets the git branch name (with "/" turned into "-"), so QA
// sees "fix-button" in the app for the GitHub branch "fix/button".
// Publishing on "main" ships to production users (channel production -> main).
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

// .env.local (from `npm run infra:bootstrap`) holds EOO_TOKEN, XPREM_URL, XPREM_APP_ID.
const envFile = path.join(root, '.env.local');
const localEnv = fs.existsSync(envFile)
  ? Object.fromEntries(
      fs
        .readFileSync(envFile, 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    )
  : {};
const env = { ...localEnv, ...process.env };
if (!env.EOO_TOKEN) {
  console.error('EOO_TOKEN is not set. Run `npm run infra:bootstrap` first (or export it in CI).');
  process.exit(1);
}

// eoas refuses a dirty tree; say why up front.
const dirty = git('status', '--porcelain');
if (dirty) {
  console.error('Working tree is not clean. Commit (or stash) first — an update must match a commit:\n' + dirty);
  process.exit(1);
}

const gitBranch = arg('branch', process.env.GITHUB_REF_NAME ?? git('rev-parse', '--abbrev-ref', 'HEAD'));
if (gitBranch === 'HEAD') {
  console.error('Detached HEAD: pass --branch <name>.');
  process.exit(1);
}
// xprem's URLs don't accept "/" in branch names: git "fix/button" -> xprem "fix-button".
const branch = gitBranch.replaceAll('/', '-');
const platform = arg('platform', 'android');
const sha = git('rev-parse', '--short', 'HEAD');
const subject = git('log', '-1', '--format=%s');
const message = `${sha} ${subject}`;

console.log(`\n▶ Publishing "${branch}" (${message}) for ${platform} to ${env.XPREM_URL ?? '?'}\n`);

const result = spawnSync(
  'npx',
  ['eoas', 'publish', '--branch', branch, '--platform', platform, '-m', message, '--nonInteractive'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...env,
      // Same JS bundle for both builds; the variant is decided by the native channel at runtime.
      APP_VARIANT: 'production',
      // The local server is plain HTTP on the LAN IP (not loopback).
      EOAS_ALLOW_INSECURE_UPLOAD_URLS: '1',
    },
  },
);

if (result.status === 0) {
  console.log(
    branch === 'main'
      ? '\n✓ Published to main -> production users get it on their next app launch.'
      : `\n✓ Published. QA can now pick "${branch}" in the QA app (Switch branch).`,
  );
}
process.exit(result.status ?? 1);
