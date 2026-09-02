# Lynxtron Front Package

A minimal npm package that distributes the Lynxtron runtime and exposes TypeScript type definitions with a simple CLI entry.

## Installation & Usage
- Requires Node.js `^22.18.0 || ^24.0.0 || ^26.0.0`
- Install:

```bash
npm install @lynx-js/lynxtron
# or
pnpm add @lynx-js/lynxtron
```

- CLI:

```bash
npx lynxtron <args>
```

Package installation always downloads the DevTool-enabled runtime, and the CLI runs it by default. Release and DevTool binaries use the same npm package version. To explicitly run the production runtime on demand:

```bash
npx lynxtron --lynxtron-runtime=release <args>
```

`LYNXTRON_RUNTIME_VARIANT=release` provides the same CLI override; it does not change what npm postinstall downloads. Missing selected runtimes are downloaded on demand and stored separately under `dist/release` or `dist/devtool`. `LYNXTRON_BINARY_URL` can point installation or lazy download at a custom runtime archive.

- Fuse CLI:

```bash
npx lynxtron-fuses read
npx lynxtron-fuses write runAsNode=off embeddedAsarIntegrityValidation=on onlyLoadAppFromAsar=on
npx lynxtron-fuses read --app "C:\\path\\to\\lynxtron"
npx lynxtron-fuses write --binary "C:\\path\\to\\lynxtron.exe" nodeOptions=off
```

When `--app` points at a packaged app, Lynxtron prefers the real runtime binary:
- macOS: `Contents/Frameworks/Lynxtron Framework.framework/Lynxtron Framework`
- Windows: `lynxtron.dll`

- Fuse API:

```js
import { flipFuses, FuseV1Options, FuseVersion, getCurrentFuses } from '@lynx-js/lynxtron/fuses';

await flipFuses('/Applications/Lynxtron.app', {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
});

console.log(await getCurrentFuses('/Applications/Lynxtron.app'));
console.log(await getCurrentFuses('C:\\path\\to\\lynxtron'));
```

## Files (excluding `apis/`)
- `package.json` — ESM config (`type: "module"`), `bin` entry, `types` entry, `postinstall`, dependencies, publish `files`.
- `fuses.js` — Reads and flips Lynxtron fuse bytes embedded in the packaged runtime.
- `fuses-cli.js` — CLI wrapper for reading and writing fuse values.
- `install.js` — Postinstall script that downloads the DevTool runtime by default.
- `runtime-manager.js` — Downloads and isolates `release` and `devtool` runtimes under `dist/<variant>/`.
- `lynxtron_bin.js` — Resolves the default DevTool executable path.
- `utils/env-config.js` — Resolves platform, arch and version; builds the executable filename for each OS.
- `utils/download.js` — Download helper using `node-fetch` with timeout and single-write to disk.
- `scripts/scan-cjk-comments.js` — Dev utility to scan Chinese comments outside `front` (not published).

## Type Definitions
- Types entry: `./apis/lynxtron.d.ts`

## Multi-Environment Support

Lynxtron supports both **Desktop** (Node.js/Electron) and **Web** (Browser) environments. To ensure compatibility, use the correct import paths:

- **Main Process (Desktop)**: `import { app, LynxWindow } from '@lynx-js/lynxtron'`
- **Web Host (Browser)**: `import { setupSymmetricHost } from '@lynx-js/lynxtron/web-host'`
- **Worker / Preload (Cross-Platform)**: `import { contextBridge } from '@lynx-js/lynxtron/context-bridge'`

### Context Bridge
When writing code that runs in the Lynx Background Thread (e.g., preload scripts or adapters), always import `contextBridge` from the subpath to ensure the correct implementation is loaded for the target environment (Native Module for Desktop, Polyfill for Web).

```typescript
import { contextBridge } from '@lynx-js/lynxtron/context-bridge';

contextBridge.exposeInLynxBTS({
  // ...
});
```
