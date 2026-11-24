# expo-qa-ota

A learning project: one Expo app, two builds, and a **self-hosted** over-the-air (OTA) update server.

- **QA build** ("OTA Demo QA"): opens on a branch picker. Testers pick a published branch, tap **Enter app**, and the app opens with that branch's code. Branches are switched only there, never inside the app.
- **Production build** ("OTA Demo"): what users install. It only gets what is on `main`.
- **Update server**: [xprem](https://www.xprem.dev/) (open source, Expo Updates protocol), running in Docker on your machine (later: your own server).

> خلاصه فارسی پایین صفحه است.

## How it works

```
git push fix/button ─► npm run publish:ota ─► xprem branch "fix-button"
                                               │
QA app      (channel "qa", branch surfing *) ──┤  picks any branch → reloads with it
Production  (channel "production" → main) ─────┘  always gets the latest "main"
```

| xprem concept | here |
|---|---|
| **branch** | one per git branch (`/` becomes `-`, so `fix/button` → `fix-button`) |
| **channel** | baked into the APK: `qa` or `production` |
| **channel → branch** | both channels point at `main` |
| **branch surfing** | enabled on `qa` only, pattern `*`. The start screen `src/BranchGate.tsx` uses `@xprem/control-center` to list and switch branches |
| **runtimeVersion** | `1.0.0` in `app.config.ts`. Updates only reach builds with the same value |

OTA updates replace **JavaScript and assets only**. If a branch adds a native module or changes native config, bump `runtimeVersion` and build new APKs. Branches built for another runtime version don't show up in the QA picker.

## Project layout

```
App.tsx                 demo screen (with a deliberate "Add to cart" bug on main)
src/Root.tsx            QA: branch picker first, then the app. Production: the app directly
src/BranchGate.tsx      QA start screen: pick a branch → Enter app
src/variant.ts          QA vs production, read from the native channel (Updates.channel)
src/BuildInfo.tsx       shows channel / branch / update id
src/UpdateBanner.tsx    production: "new version ready, tap to restart"
app.config.ts           APP_VARIANT=qa|production → name, package, channel
infra/docker-compose.yml  xprem + Postgres
infra/bootstrap.mjs     creates app, API token, certificate, channels, branch surfing
scripts/publish.mjs     publishes the current git branch
certs/certificate.pem   public key the app uses to verify updates (code signing)
.github/workflows/publish-ota.yml  CI publishing (off until configured)
```

## Setup (once)

Requirements: Node 20+, Docker, Android SDK + JDK 17, an emulator or Android phone on the same Wi-Fi.

```bash
npm install
cp infra/.env.example infra/.env   # set BASE_URL to your Mac's LAN IP, fill in the secrets
npm run infra:up                   # xprem on :3000, dashboard at http://localhost:3000/dashboard
npm run infra:bootstrap            # app + token + certificate + channels → .env.local
```

`BASE_URL` must be reachable from the phone (`ipconfig getifaddr en0`), not `localhost`. If your IP changes, update `infra/.env`, restart, re-run the bootstrap and rebuild the APKs (the URL is baked into the build).

## Build the two apps

```bash
npm run build:qa     # → builds/ota-demo-qa.apk
npm run build:prod   # → builds/ota-demo-prod.apk
adb install -r builds/ota-demo-qa.apk
adb install -r builds/ota-demo-prod.apk
```

**If Google's servers are blocked on your network** (they answer 404 even through some VPNs):
- Gradle libraries: the build scripts already pass `--init-script gradle/google-mirror.init.gradle`, which swaps Google's Maven repo for Alibaba Cloud's mirror. Drop that flag from `package.json` if you don't need it.
- Android SDK packages (Expo SDK 58 needs Build Tools 37.0.0 and Platform 37):
  ```bash
  SDK_TEST_BASE_URL=https://mirrors.cloud.tencent.com/AndroidSDK/ ~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager --install "build-tools;37.0.0" "platforms;android-37.0"
  ```
- Docker Hub: `infra/docker-compose.yml` uses `postgres:16-alpine` with `pull_policy: missing`, so an image already on your machine is enough.

Both have different package names, so they sit side by side on one phone. They're signed with the debug key, which is fine for learning but not for the Play Store.

## Day-to-day flow

1. Bug report: "Add to cart does nothing".
2. Fix it on a branch and publish it:
   ```bash
   git checkout -b fix/button
   # ...fix, commit, push to GitHub...
   npm run publish:ota          # publishes branch "fix-button"
   ```
3. QA opens the **QA app** → the start screen lists the branches → picks `fix-button` → **Enter app** → the app reloads with the fix and opens. To change branch again, close the app fully and reopen it.
   The picker lives in the JS bundle, so a branch only shows it if it was published from code that includes `src/BranchGate.tsx`.
4. QA approves → merge into `main` → publish `main`:
   ```bash
   git checkout main && git merge fix/button && git push
   npm run publish:ota
   ```
5. Production users get the update in the background on next launch. A banner offers to restart right away.

The tree must be clean to publish (every update matches a commit).

Rolling back or re-publishing an older update:
```bash
EOO_TOKEN=... npx eoas rollback --branch main --platform android
EOO_TOKEN=... npx eoas republish --branch main --platform android
```
The dashboard can do the same, and also partial rollouts (`--rollout-percentage`).

## CI (later)

`.github/workflows/publish-ota.yml` publishes every pushed branch. It stays off until the repo variable `XPREM_URL` is set. GitHub's cloud runners can't reach your laptop. Either run xprem on a real server, or register a self-hosted runner on your Mac and set `RUNNER=self-hosted`.

## Going to production for real

- Put xprem behind **HTTPS** and drop `usesCleartextTraffic` / `EOAS_ALLOW_INSECURE_UPLOAD_URLS`.
- Back up `DB_KEYS_MASTER_KEY_B64`: it encrypts the signing key, and losing it means new builds.
- Use object storage (S3/MinIO) instead of the local volume, and a real release keystore.

---

## خلاصه فارسی

- دو اپ از یه کد: **QA** (کانال `qa`) و **Production** (کانال `production`). فرقشون فقط موقع build با `APP_VARIANT` تعیین می‌شه.
- سرور آپدیت **xprem** با Docker روی سیستم خودت بالا میاد (`npm run infra:up`) و `npm run infra:bootstrap` همه‌چیز رو تنظیم می‌کنه.
- هر برنچ git با `npm run publish:ota` روی سرور منتشر می‌شه (`/` تبدیل به `-` می‌شه).
- اپ QA با صفحه‌ی انتخاب برنچ باز می‌شه: تیم QA برنچ رو انتخاب می‌کنه، «Enter app» رو می‌زنه و اپ با کد همون برنچ باز می‌شه. داخل خود اپ برنچ عوض نمی‌شه؛ برای عوض کردن، اپ رو کامل ببند و دوباره باز کن.
- بعد از تأیید QA، merge به `main` و `npm run publish:ota` روی main. کاربرهای Production دفعه بعد که اپ رو باز کنن آپدیت رو می‌گیرن.
- OTA فقط JS و asset رو عوض می‌کنه. تغییر native یعنی بالا بردن `runtimeVersion` و build جدید.
