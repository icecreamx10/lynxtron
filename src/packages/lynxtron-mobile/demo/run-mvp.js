// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  LynxTemplateBundle,
  LynxTemplateData,
  LynxUpdateMeta,
  LynxWindow,
  installNativeAdapter,
  protocol,
} from '../dist/index.js';
import { installContextBridgeForTesting } from '../dist/testing.js';
import { startBTSWorkerRuntime } from '../dist/worker-runtime.js';

let nextWindowId = 1;

const nativeAdapter = {
  platform: 'android',

  createTemplateBundle(bytes) {
    return {
      isValid: () => bytes.byteLength > 0,
      getErrorMessage: () => (bytes.byteLength > 0 ? '' : 'empty bundle'),
    };
  },

  createWindow(options, callbacks) {
    const id = nextWindowId++;
    console.log(`[native mock] create LynxWindow #${id}`, {
      presentation: options.mobile.presentation ?? 'embedded',
      preloads: options.lynxPreference.preloads,
    });

    let destroyed = false;
    const ensureAlive = () => {
      if (destroyed) {
        throw new Error(`Native window ${id} is destroyed`);
      }
    };

    return {
      id,
      show() {
        ensureAlive();
        callbacks.emit('show');
        callbacks.emit('foreground');
      },
      hide() {
        ensureAlive();
        callbacks.emit('background');
        callbacks.emit('hide');
      },
      close() {
        ensureAlive();
        destroyed = true;
        callbacks.emit('closed');
      },
      destroy() {
        if (!destroyed) {
          destroyed = true;
          callbacks.emit('closed');
        }
      },
      loadFile(path, loadOptions) {
        ensureAlive();
        console.log('[native mock] loadFile', path, loadOptions);
        queueMicrotask(() => {
          callbacks.emit('ready-to-show');
          callbacks.emit('on-first-screen');
        });
        return true;
      },
      loadURL(url, loadOptions) {
        ensureAlive();
        console.log('[native mock] loadURL', url, loadOptions);
        return true;
      },
      loadBundle(bundle, loadOptions) {
        ensureAlive();
        console.log('[native mock] loadBundle', {
          valid: bundle.isValid(),
          loadOptions,
        });
        return bundle.isValid();
      },
      updateMetaData(meta) {
        ensureAlive();
        console.log('[native mock] updateMetaData', meta);
        return true;
      },
      setGlobalProps(globalProps) {
        ensureAlive();
        console.log('[native mock] setGlobalProps', globalProps);
        return true;
      },
      sendGlobalEvent(eventName, args) {
        ensureAlive();
        console.log('[native mock] sendGlobalEvent', eventName, args);
        return true;
      },
    };
  },
};

installNativeAdapter(nativeAdapter);

const exposed = {};
installContextBridgeForTesting({
  exposeInLynxBTS(apis) {
    Object.assign(exposed, apis);
    console.log('[context bridge] exposed', Object.keys(apis));
  },
});

protocol.handle('app', (request) => ({
  url: request.url,
  statusCode: 200,
  data: new TextEncoder().encode('mock resource'),
}));

const window = new LynxWindow({
  show: false,
  mobile: { presentation: 'embedded' },
  lynxPreference: {
    preloads: ['./device-preload.js'],
  },
});

window.on('show', () => console.log('[JS] show'));
window.on('foreground', () => console.log('[JS] foreground'));
window.on('ready-to-show', () => console.log('[JS] ready-to-show'));
window.on('on-first-screen', () => console.log('[JS] on-first-screen'));
window.on('closed', () => console.log('[JS] closed'));

const preloadURL = new URL('./device-preload.js', import.meta.url).href;
const workerRuntime = await startBTSWorkerRuntime(
  {
    windowId: window.id,
    platform: 'android',
    preloads: [preloadURL],
  },
  {
    attachBTSRuntime(windowId) {
      console.log(`[worker mock] attach Lynx BTS for window #${windowId}`);
    },
    detachBTSRuntime(windowId) {
      console.log(`[worker mock] detach Lynx BTS for window #${windowId}`);
    },
  }
);

window.show();
window.loadFile('app://main.lynx.bundle', {
  data: { route: 'home' },
});

await Promise.resolve();

const bundle = new LynxTemplateBundle(new Uint8Array([0x4c, 0x59, 0x4e, 0x58]));
window.loadBundle(bundle);
window.updateMetaData(
  new LynxUpdateMeta({
    updateData: new LynxTemplateData({ count: 1 }),
  })
);
window.setGlobalProps({ theme: 'dark' });
window.sendGlobalEvent('mvp-ready', { ok: true });

console.log('[Lynx BTS mock] device.platform =', exposed.device.platform);
console.log(
  '[Lynx BTS mock] device.getWindowId() =',
  exposed.device.getWindowId()
);

await workerRuntime.dispose();
window.destroy();

console.log('[MVP] completed successfully');
