/// <reference types="node" />
import type { ConfigContext, ExpoConfig } from 'expo/config';
import fs from 'node:fs';
import path from 'node:path';

// Three native builds from one codebase:
//   APP_VARIANT=development -> "OTA Demo Dev", local Metro server
//   APP_VARIANT=qa          -> "OTA Demo QA", channel "qa"  (branch surfing allowed)
//   APP_VARIANT=production  -> "OTA Demo",    channel "production" (served "main" only)
const appVariant = process.env.APP_VARIANT;
const variant = appVariant === 'qa' || appVariant === 'development' ? appVariant : 'production';
const IS_QA = variant === 'qa';
const IS_DEV = variant === 'development';
const appIdentifier = `dev.example.expoqaota${IS_DEV ? '.dev' : IS_QA ? '.qa' : ''}`;

// eoas runs `expo export` with EXPO_NO_DOTENV=1, so read .env.local ourselves
// (written by `npm run infra:bootstrap`). Real env vars win.
function localEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const file = path.join(__dirname, '.env.local');
  if (!fs.existsSync(file)) return undefined;
  const line = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim();
}

const XPREM_URL = localEnv('XPREM_URL') ?? 'http://localhost:3000';
const XPREM_APP_ID = localEnv('XPREM_APP_ID') ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'OTA Demo Dev' : IS_QA ? 'OTA Demo QA' : 'OTA Demo',
  slug: 'expo-qa-ota',
  scheme: IS_DEV ? 'expoqaota-dev' : IS_QA ? 'expoqaota-qa' : 'expoqaota',
  version: '1.0.0',
  // Bump this whenever native code changes (new native package, SDK upgrade...).
  // Updates are only served to builds with the exact same runtimeVersion.
  runtimeVersion: '1.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  android: {
    package: appIdentifier,
    adaptiveIcon: {
      backgroundColor: IS_QA ? '#FFE8CC' : '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: appIdentifier,
  },
  web: { favicon: './assets/favicon.png' },
  updates: IS_DEV ? { enabled: false } : {
    url: `${XPREM_URL}/manifest`,
    enabled: true,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
    // All three keys must exist at build time (branch surfing overrides them at runtime).
    // expo-channel-name is a literal per variant, never an env var.
    requestHeaders: {
      'expo-channel-name': IS_QA ? 'qa' : 'production',
      'expo-app-id': XPREM_APP_ID,
      'xprem-branch': '',
    },
    codeSigningCertificate: process.env.DISABLE_CODE_SIGNING ? undefined : './certs/certificate.pem',
    codeSigningMetadata: process.env.DISABLE_CODE_SIGNING
      ? undefined
      : { keyid: 'main', alg: 'rsa-v1_5-sha256' },
  },
  plugins: [
    'expo-router',
    [
      'expo-build-properties',
      {
        // The local update server is plain HTTP. Remove once it is behind HTTPS.
        android: { usesCleartextTraffic: true },
      },
    ],
  ],
  extra: {
    // Only a fallback for dev mode: in a release build the real variant is the
    // native channel (Updates.channel), because this object is baked into each
    // OTA bundle at export time and is shared by both builds.
    variant,
     eas: {
      projectId: 'e268b275-24e8-4c66-a500-38b40f37eb70',
    },
    
  },
});
