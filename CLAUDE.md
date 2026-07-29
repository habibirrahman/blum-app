# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **Bun**, not npm (`bun.lockb` is the lockfile — use `bun install` / `bun run <script>` / `bunx <tool>`).

- Install: `bun install`
- Dev server: `bun run dev` (Vite, port 8080)
- Build: `bun run build` (type-check runs separately — see below)
- Build with type-check: `bun run build-check` (runs `type-check` and `build-only` in parallel via `run-p`)
- Dev-mode build: `bun run build-dev` (`NODE_ENV=development vite build --mode development`)
- Type-check only: `bun run type-check` (`vue-tsc --build --force`)
- Lint: `bun run lint` (ESLint only — no oxlint here, unlike the desktop repo)
- Format: `bun run format` (`prettier --write src/`)
- Unit tests: `bun run test:unit` (Vitest). Single file: `bunx vitest run src/path/to/file.spec.ts`. One existing example: `src/components/__tests__/HelloWorld.spec.ts`.
- No E2E test setup in this repo (unlike the desktop repo, which has Playwright).

### Mobile (Capacitor)

```sh
bun run build
bunx cap sync            # sync web build + plugins into native projects
bunx cap run android      # or: bunx cap run ios
```

Before a release build, manually bump the native version (`android/app/build.gradle` version code/name, `ios/App/App.xcodeproj/project.pbxproj`). iOS/Android CI release builds are defined in `codemagic.yaml` (installs Bun, `bun run build`, `bunx cap sync`, then platform-specific signing/build steps) — check that file for the exact production build pipeline rather than assuming.

## Architecture

### This is the field/session-recording companion app, not a port of the desktop app

Where the desktop repo (`blubridge-vue-3`) covers the full admin/therapist practice-management surface, this app is scoped narrowly to what a therapist needs in the field: sign in, view upcoming sessions, run/record a live session (measurements, comments, targets), manage clients and client targets, and profile. Routes live in `src/pages/*.page.vue` (lazy-loaded via dynamic `import()` in `src/router/index.ts`) — flat and manually registered like the desktop app, but there is no `src/app/**` folder-mirrors-routes convention here.

### Offline-first sync is the core architectural concern

This app must work with intermittent connectivity in the field. Key pieces, mostly in `src/stores/session.store.ts` and `src/plugins/preferences.plugin.ts`:

- **Storage**: `@capacitor/preferences` (native key-value storage) instead of `localStorage`, wrapped by `src/plugins/preferences.plugin.ts`. Access/CSRF tokens are cached in an in-memory variable after first read to avoid repeated native `Preferences.get` calls on every axios request (see comments in that file).
- **Batched persistence**: session state is collapsed into a single `session.full-store` Preferences key (`setSessionFullStore`/`getSessionFullStore`) instead of many small keys, to minimize native write calls. Session activity logs are buffered in memory and flushed via `flushSessionActivities`, not written per-action.
- **Debounced + immediate sync**: `syncSessionStore()` debounces writes; `syncSessionStoreNow()` bypasses the debounce for cases needing an immediate flush (e.g. ending a session).
- **Pending-progress queue**: mutations made while offline (comment create/update/delete, measurement updates, image duplication) are queued in `pending_progress` and replayed by `resolvePendingProgress()` once `app.network_status.connected` is true; it re-checks connectivity on every iteration and bails if the network drops mid-replay.
- **Auto-sync**: `setupAutoSync()` watches network status and also runs a periodic check (every 30s) to flush `pending_progress` when back online.
- Network status itself is tracked via `@capacitor/network`'s `Network.getStatus()`/`addListener('networkStatusChange', ...)` in `App.vue`, pushed into `useAppStore`.

When touching session recording or client data flows, assume writes may happen offline and need to survive an app restart before syncing — don't assume a request will reach the server synchronously.

### API layer differs from the desktop repo

`src/backend/axios.ts` configures the **global** `axios.defaults` (not a separate instance) and registers interceptors on the default `axios` export, then re-exports it; it's installed app-wide via `vue-axios` in `main.ts`. Some other files (stores) also `import axios from 'axios'` directly rather than importing this module — they still get the configured defaults/interceptors since axios interceptors are global here. Base URL switches on `import.meta.env.PROD`: `VITE_API_ENDPOINT_PRODUCTION` in production builds, `VITE_API_ENDPOINT` otherwise. Auth header logic mirrors the desktop app (`Authorization: Bearer`, `X-CSRF-TOKEN` on non-GET/OPTIONS) but reads tokens from `getAccessStorage()` in `preferences.plugin.ts`.

### State (Pinia)

Same Options-API convention as the desktop repo (`state`/`getters`/`actions`, stores return `{ success, data, message? }`), but stores here (`app.store.ts`, `client.store.ts`, `session.store.ts`) also own their own Preferences-backed persistence and `reset*Store()` methods, and cross-reference each other directly (e.g. `app.store.ts`'s `resetAppStore()` calls into `useSessionStore()`/`useClientStore()`) rather than going through a shared generic wrapper like the desktop repo's `useStore`.

### Native platform integration

Capacitor plugins in use: `@capacitor/camera`, `@capacitor/device`, `@capacitor/network`, `@capacitor/preferences`, `@capacitor/app`, `@capacitor-community/media`. `capacitor.config.ts` enables `CapacitorHttp` and sets Camera permissions. `App.vue` does forced-update-check logic on mount (compares native `App.getInfo()` version/build against `/api/v1/app_versions?current=true`) and blocks the app with an "Update required" sheet if outdated — relevant if changing versioning or release flow.

### Components & auto-import

- `src/components/` — shared primitives, prefixed `App*` (not `ui-*` like the desktop repo): `AppButton`, `AppTextInput`, `AppToggle`, etc.
- `src/partitions/` — feature-composed components, flatter than the desktop repo's per-feature folders (some are flat files, some grouped under `partitions/client`, `partitions/session`, `partitions/target`, `partitions/measurement`).
- Icons: `unplugin-icons` + `@iconify/vue` (Phosphor icon set `ph:*` used in `App.vue`) with `unplugin-vue-components` auto-resolving/auto-importing components — `components.d.ts` is generated, don't hand-edit it.

### Styling

Tailwind CSS **v3** here (`tailwind.config.js` + `postcss.config.js`), unlike the desktop repo's CSS-first v4 setup — check `tailwind.config.js` before assuming design tokens match the desktop app. `prettier-plugin-tailwindcss` still auto-sorts classes; Prettier config also sets `trailingComma: "none"` (desktop repo doesn't specify this explicitly).

### Build tooling notes

- Stock Vite (not `rolldown-vite` like the desktop repo).
- Linting is ESLint only (`.eslintrc.cjs`, legacy flat-config-less format) — no `oxlint` step here.
- Path alias `@` → `src/`.

## Known issue: SBT trial loss on measurement save (investigated 2026-07)

Bug report: therapists recording `Target::SkillBasedTreatment` measurements would end a session and find fewer trials persisted than were actually recorded (e.g. `session_activities` shows 17 `sbt_select_prompt` events, final measurement only has 12 trials) — with **zero `api_failed`** activity entries, i.e. every individual save reported success.

Root cause, confirmed against a real session's `session_activities` export: `updateMeasurementResults` (`session.store.ts`) always PATCHes the **entire** trial result set for a measurement (full replace, not incremental/append). `getSession()` (`session.store.ts` ~934-956), triggered by the pull-to-refresh gesture (`session_refresh` activity, "swipe up" — `SessionRecord.page.vue` `fetchSession`/`scrollListener`), does an **unconditional synchronous overwrite** of `session_measurements` from the local `this.sessions` cache (populated earlier, e.g. from the draft-sessions list — can be stale) *before* the network refetch resolves, and the subsequent offline-check branches in `getSession`/`getSessionMeasurements` are commented-out no-ops, so a failed/slow refetch leaves that stale overwrite in place uncorrected. The SBT component (`partitions/measurement/SkillBasedTreatment.vue`) reactively adopts this stale `resultsState` via its `props.measurementResults` watcher; any trial recorded after that point is saved on top of the regressed baseline, and since saves are full-replace, the next successful save permanently overwrites the server's more-complete trial set — with no error surfaced anywhere (matches the "zero `api_failed`" evidence).

In the analyzed session (~3hr recording), `session_refresh` fired 14 times, repeatedly interleaved *mid-recording* across all three SBT measurements in that session — not just at session start, which is what makes the race practically likely rather than theoretical.

Fix not yet implemented, in priority order:
1. Remove/guard the synchronous stale-cache overwrite in `getSession()` (~line 935-938) — don't replace `session_measurements` from `this.sessions.find(...)` before a fresh fetch confirms it.
2. Implement the offline checks in `getSession`/`getSessionMeasurements` (currently commented-out no-ops) so a failed/offline refetch doesn't leave a partial/stale overwrite in place.
3. Longer-term: move SBT trial writes to incremental/append (or add optimistic-concurrency/version checks) instead of full-replace, so a stale client base can't silently clobber server-confirmed trials.

(Ruled out: save failures/rollback in `onSaveCurrentTrial` — every individual save in the analyzed session succeeded; `api_success`/`api_failed` activity logging in `updateMeasurement`/`updateMeasurementResults` is already correctly tied to actual outcomes.)

## Android target API level (updated 2026-07)

Google Play requires targeting API 36 (Android 16) by 31 Aug 2026. Updated in `android/`:
- `variables.gradle`: `minSdkVersion` 22→24, `compileSdkVersion`/`targetSdkVersion` 35→36.
- `build.gradle`: AGP classpath `8.2.1`→`8.13.0`.
- `gradle/wrapper/gradle-wrapper.properties`: Gradle wrapper `8.9`→`8.13` (required minimum for AGP 8.13).

AGP 8.13 requires Android Studio Narwhal 3 Feature Drop (2025.1.3) or newer — if targeting an older Studio install without upgrading, use AGP 8.10.0 + Gradle 8.11.1 instead (AGP 8.10 is the lowest version supporting compileSdk/targetSdk 36; AGP 8.9 and below max out at API 35). `minSdkVersion` 24 drops support for Android 5.0/5.1 (API 22-23) devices.
