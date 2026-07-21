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
