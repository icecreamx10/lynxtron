# `@lynx-js/lynxtron-mobile`

Android-first P0 MVP of the Lynxtron host API for NativeScript.

This package currently contains the executable JavaScript contract and a native
adapter ABI. It does not bundle the Android/iOS Lynx SDK or a NativeScript V8
runtime. A platform plugin must install `NativeLynxtronMobileAdapter` before a
`LynxWindow` is created.

Run the complete P0 lifecycle against the executable mock host:

```bash
cd src
npm --prefix packages/lynxtron-mobile run demo
```

## Public P0 API

- `LynxWindow`
- `LynxTemplateBundle`
- `LynxTemplateData`
- `LynxUpdateMeta`
- `protocol`
- `contextBridge.exposeInLynxBTS`
- `defineBTSPreload`
- `startBTSWorkerRuntime`

The native Lynx SDK's `LynxView` is an implementation detail owned by
`LynxWindow`; it is not a second public JavaScript page API.

## Main Realm

```ts
import {
  LynxTemplateData,
  LynxUpdateMeta,
  LynxWindow,
} from '@lynx-js/lynxtron-mobile';

const window = new LynxWindow({
  show: true,
  lynxPreference: {
    preloads: ['@app/device-preload'],
  },
});

window.on('ready-to-show', () => {
  window.updateMetaData(
    new LynxUpdateMeta({
      updateData: new LynxTemplateData({ ready: true }),
    })
  );
});

window.loadFile('~/assets/main.lynx.bundle');
```

## BTS preload plugin

```ts
import {
  contextBridge,
  defineBTSPreload,
} from '@lynx-js/lynxtron-mobile/context-bridge';

export default defineBTSPreload<{ namespace: string }>((context) => {
  contextBridge.exposeInLynxBTS({
    device: {
      getPlatform: () => context.platform,
    },
  });

  return {
    dispose() {
      // Remove native observers owned by this window.
    },
  };
});
```

## Worker ownership

For every `LynxWindow`, the platform adapter must:

1. create a NativeScript Worker;
2. call `startBTSWorkerRuntime()` in that worker;
3. implement `attachBTSRuntime(windowId)` by attaching a Lynx BTS context to
   the worker's current V8 isolate;
4. install `globalThis.__contextBridge` in the worker context;
5. stop accepting bridge calls, detach Lynx BTS, dispose preloads, and terminate
   the worker when the window is destroyed.

Worker messages may be used for initialization and lifecycle control. Calls
from Lynx BTS to preload exports must use the same-isolate context bridge, not
`postMessage` RPC.

## Native adapter ABI

The platform plugin installs an adapter during NativeScript startup:

```ts
import { installNativeAdapter } from '@lynx-js/lynxtron-mobile';

installNativeAdapter(nativeAdapter);
```

See the generated `NativeLynxtronMobileAdapter`,
`NativeLynxWindowHandle`, and `BTSWorkerNativeBinding` declarations for the
complete P0 boundary.
