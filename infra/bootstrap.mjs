#!/usr/bin/env node
// One-time setup of the local xprem server through its HTTP API
// (the same calls the dashboard makes). Safe to re-run.
//
//   1. log in as the admin from infra/.env
//   2. create the app "expo-qa-ota" (signing keys stored in the DB)
//   3. download the code-signing certificate -> certs/certificate.pem
//   4. create an API token for publishing -> .env.local (EOO_TOKEN)
//   5. create branch "main" and channels:  production -> main,  qa -> main
//   6. enable branch surfing on "qa" for every branch ("*")
//
// Usage: npm run infra:bootstrap
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_NAME = 'expo-qa-ota';
const SERVER = process.env.XPREM_LOCAL_URL ?? 'http://localhost:3000';

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
}

function writeEnvFile(file, values) {
  const current = readEnvFile(file);
  const merged = { ...current, ...values };
  fs.writeFileSync(
    file,
    Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n',
    { mode: 0o600 },
  );
}

const infraEnv = readEnvFile(path.join(root, 'infra/.env'));
if (!infraEnv.ADMIN_EMAIL || !infraEnv.ADMIN_PASSWORD) {
  console.error('infra/.env is missing ADMIN_EMAIL / ADMIN_PASSWORD (copy infra/.env.example).');
  process.exit(1);
}

let token;
async function api(method, url, body, { text = false, okStatuses = [] } = {}) {
  const res = await fetch(SERVER + url, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && !okStatuses.includes(res.status)) {
    throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`);
  }
  if (!res.ok) return null;
  if (text) return res.text();
  const raw = await res.text();
  return raw ? JSON.parse(raw) : null;
}

// 1. login
const loginRes = await fetch(`${SERVER}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ email: infraEnv.ADMIN_EMAIL, password: infraEnv.ADMIN_PASSWORD }),
});
if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status} ${await loginRes.text()}`);
token = (await loginRes.json()).token;
console.log('✓ logged in');

// 2. app
const apps = await api('GET', '/api/apps');
const list = Array.isArray(apps) ? apps : (apps?.apps ?? apps?.items ?? []);
let app = list.find((a) => a.name === APP_NAME);
let appId = app?.appId ?? app?.id;
if (!appId) {
  const created = await api('POST', '/api/apps', { name: APP_NAME, keysConfig: { mode: 'database' } });
  appId = created.appId;
  console.log(`✓ created app ${APP_NAME}`);
} else {
  console.log(`✓ app ${APP_NAME} already exists`);
}
const scope = `/api/apps/${encodeURIComponent(appId)}`;

// 3. certificate
const cert = await api('GET', `${scope}/certificate`, undefined, { text: true });
fs.mkdirSync(path.join(root, 'certs'), { recursive: true });
fs.writeFileSync(path.join(root, 'certs/certificate.pem'), cert);
console.log('✓ certs/certificate.pem written');

// 4. API token (only once; the server never shows it again)
const localEnvFile = path.join(root, '.env.local');
const localEnv = readEnvFile(localEnvFile);
if (!localEnv.EOO_TOKEN) {
  const { apiKey } = await api('POST', `${scope}/apiKeys`, { name: 'local-publish' });
  writeEnvFile(localEnvFile, { EOO_TOKEN: apiKey });
  console.log('✓ API token saved to .env.local (EOO_TOKEN)');
} else {
  console.log('✓ EOO_TOKEN already in .env.local');
}

// The app config needs these at build/export time.
const lanUrl = infraEnv.BASE_URL ?? 'http://localhost:3000';
writeEnvFile(localEnvFile, { XPREM_APP_ID: appId, XPREM_URL: lanUrl });
console.log(`✓ XPREM_APP_ID / XPREM_URL (${lanUrl}) saved to .env.local`);

// 5. branch + channels
await api('POST', `${scope}/branches`, { branchName: 'main' }, { okStatuses: [400, 409] });
const channels = (await api('GET', `${scope}/channels`)) ?? [];
const channelList = Array.isArray(channels) ? channels : (channels.channels ?? []);
for (const name of ['production', 'qa']) {
  if (channelList.some((c) => c.releaseChannelName === name)) {
    console.log(`✓ channel ${name} already exists`);
    continue;
  }
  await api('POST', `${scope}/channels`, { channelName: name, branchName: 'main' });
  console.log(`✓ channel ${name} -> main`);
}

// 6. branch surfing on qa only
await api('PUT', `${scope}/channels/qa/branch-surfing`, { enabled: true, pattern: '*' });
console.log('✓ branch surfing enabled on channel "qa" (pattern "*")');

console.log(`\nDashboard: ${SERVER}/dashboard  (login with ADMIN_EMAIL / ADMIN_PASSWORD from infra/.env)`);
