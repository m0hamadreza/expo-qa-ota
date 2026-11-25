import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export type Variant = 'development' | 'qa' | 'production';

/**
 * Which build is running. In a release build this comes from the native
 * channel baked into the APK, so the same OTA bundle behaves as QA inside the
 * QA app and as production inside the production app. In dev (no channel)
 * fall back to APP_VARIANT via app.config.ts `extra.variant`.
 */
export const variant: Variant =
  Updates.channel === 'qa' || Updates.channel === 'production'
    ? Updates.channel
    : ((Constants.expoConfig?.extra?.variant as Variant | undefined) ?? 'production');

export const isQA = variant === 'qa';
