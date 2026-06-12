# blum-app

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
bun install
```

### Compile and Hot-Reload for Development

```sh
bun run dev
```

### Type-Check, Compile and Minify for Production

```sh
bun run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
bun run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
bun run lint
```

## Project Mobile Setup

```sh
bunx cap sync
```

### Run [Android Mobile](https://capacitorjs.com/docs/android)

```sh
bunx cap run android
```

### Run [iOS Mobile](https://capacitorjs.com/docs/ios)

```sh
bunx cap run ios
```

### Reload

```sh
bun run build
bunx cap sync
bunx cap run android
bunx cap run ios
```

### Build APK

manual: update version code and version name
:: build.gradle
:: project.pbxproj

```sh
bun run build
```

Android

```sh
bunx cap sync
bunx cap copy android
bunx cap open android
```

iOS

```sh
bunx cap sync
bunx cap copy ios
bunx cap open ios
```
