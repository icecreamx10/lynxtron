// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import {
  LynxTemplateBundle,
  LynxTemplateData,
  LynxUpdateMeta,
  LynxWindow,
  WindowDestroyedError,
  installNativeAdapter,
  protocol,
} from '../dist/index.js';
import { contextBridge, defineBTSPreload } from '../dist/context-bridge.js';
import {
  installContextBridgeForTesting,
  resetContextBridgeForTesting,
  resetLynxWindowsForTesting,
  resetNativeAdapterForTesting,
  resetProtocolForTesting,
} from '../dist/testing.js';
import { startBTSWorkerRuntime } from '../dist/worker-runtime.js';

class MockTemplateBundle {
  constructor(bytes) {
    this.bytes = bytes;
  }

  isValid() {
    return this.bytes.byteLength > 0;
  }

  getErrorMessage() {
    return this.isValid() ? '' : 'empty bundle';
  }
}

class MockNativeAdapter {
  platform = 'android';
  nextId = 1;
  records = [];

  createTemplateBundle(bytes) {
    return new MockTemplateBundle(bytes);
  }

  createWindow(options, callbacks) {
    const record = {
      id: this.nextId++,
      options,
      callbacks,
      calls: [],
      destroyed: false,
    };
    this.records.push(record);

    return {
      id: record.id,
      show: () => {
        record.calls.push(['show']);
        callbacks.emit('show');
      },
      hide: () => {
        record.calls.push(['hide']);
        callbacks.emit('hide');
      },
      close: () => {
        record.calls.push(['close']);
        record.destroyed = true;
        callbacks.emit('closed');
      },
      destroy: () => {
        record.calls.push(['destroy']);
        record.destroyed = true;
        callbacks.emit('closed');
      },
      loadFile: (path, loadOptions) => {
        record.calls.push(['loadFile', path, loadOptions]);
        return true;
      },
      loadURL: (url, loadOptions) => {
        record.calls.push(['loadURL', url, loadOptions]);
        return true;
      },
      loadBundle: (bundle, loadOptions) => {
        record.calls.push(['loadBundle', bundle, loadOptions]);
        return bundle.isValid();
      },
      updateMetaData: (meta) => {
        record.calls.push(['updateMetaData', meta]);
        return true;
      },
      setGlobalProps: (globalProps) => {
        record.calls.push(['setGlobalProps', globalProps]);
        return true;
      },
      sendGlobalEvent: (eventName, args) => {
        record.calls.push(['sendGlobalEvent', eventName, args]);
        return true;
      },
    };
  }
}

let adapter;

beforeEach(() => {
  adapter = new MockNativeAdapter();
  installNativeAdapter(adapter);
});

afterEach(() => {
  resetLynxWindowsForTesting();
  resetProtocolForTesting();
  resetContextBridgeForTesting();
  resetNativeAdapterForTesting();
  delete globalThis.__lynxtronWorkerFixture;
});

test('LynxWindow exposes the P0 load and lifecycle surface', () => {
  const window = new LynxWindow({
    show: false,
    lynxPreference: {
      preload: './preload.js',
      preloads: ['@app/device-preload'],
    },
  });
  const record = adapter.records[0];

  assert.equal(LynxWindow.fromId(window.id), window);
  assert.deepEqual(LynxWindow.getAllWindows(), [window]);
  assert.deepEqual(record.options.lynxPreference.preload, ['./preload.js']);

  let shown = 0;
  window.on('show', () => shown++);
  window.show();
  assert.equal(shown, 1);
  assert.equal(window.isVisible(), true);

  assert.equal(
    window.loadFile('~/assets/main.lynx.bundle', {
      data: { route: 'home' },
    }),
    true
  );
  assert.equal(window.loadURL('https://example.com/main.lynx.bundle'), true);

  const bundle = new LynxTemplateBundle(new Uint8Array([1, 2, 3]));
  assert.equal(bundle.isValid(), true);
  assert.equal(window.loadBundle(bundle), true);

  const meta = new LynxUpdateMeta({
    updateData: new LynxTemplateData({ count: 1 }),
  });
  assert.equal(window.updateMetaData(meta), true);
  assert.equal(window.setGlobalProps({ theme: 'dark' }), true);
  assert.equal(window.sendGlobalEvent('route-changed', 'settings'), true);

  window.destroy();
  assert.equal(window.isDestroyed(), true);
  assert.equal(LynxWindow.fromId(window.id), null);
  assert.throws(() => window.loadFile('another.bundle'), WindowDestroyedError);
});

test('close is cancelable and destruction is idempotent', () => {
  const window = new LynxWindow({ show: false });
  const record = adapter.records[0];
  const preventClose = (event) => event.preventDefault();

  window.on('close', preventClose);
  window.close();
  assert.equal(record.destroyed, false);

  window.off('close', preventClose);
  window.close();
  assert.equal(record.destroyed, true);
  assert.equal(window.isDestroyed(), true);

  window.destroy();
  assert.equal(
    record.calls.filter(([method]) => method === 'destroy').length,
    0
  );
});

test('protocol rewrites and resolves resources for the native adapter', async () => {
  const window = new LynxWindow({ show: false });
  const { callbacks } = adapter.records[0];

  protocol.setRequestRewriter(({ url }) => url.replace('asset://', 'app://'));
  protocol.handle('app', (request) => ({
    url: request.url,
    statusCode: 200,
    data: new Uint8Array([7, 8, 9]),
  }));

  const response = await callbacks.resolveResource({
    resourceType: 'bundle',
    scheme: 'asset',
    url: 'asset://main.lynx.bundle',
  });

  assert.equal(response.url, 'app://main.lynx.bundle');
  assert.deepEqual([...new Uint8Array(response.data.buffer)], [7, 8, 9]);
  window.destroy();
});

test('BTS preload exposes APIs and disposes window-owned state', async () => {
  const exposed = [];
  let disposed = false;
  installContextBridgeForTesting({
    exposeInLynxBTS(apis) {
      exposed.push(apis);
    },
  });

  const definition = defineBTSPreload((context) => {
    contextBridge.exposeInLynxBTS({
      device: {
        platform: context.platform,
        namespace: context.options.namespace,
      },
    });
    return {
      dispose() {
        disposed = true;
      },
    };
  });

  const abortController = new AbortController();
  const registration = await definition.setup({
    windowId: 1,
    platform: 'android',
    options: { namespace: 'demo' },
    signal: abortController.signal,
  });

  assert.deepEqual(exposed, [
    { device: { platform: 'android', namespace: 'demo' } },
  ]);
  await registration.dispose();
  assert.equal(disposed, true);
});

test('BTS worker attaches Lynx to the worker isolate and disposes in order', async () => {
  const lifecycle = [];
  const exposed = [];
  installContextBridgeForTesting({
    exposeInLynxBTS(apis) {
      exposed.push(apis);
    },
  });

  const nativeBinding = {
    attachBTSRuntime(windowId) {
      lifecycle.push(['attach', windowId]);
    },
    detachBTSRuntime(windowId) {
      lifecycle.push([
        'detach',
        windowId,
        globalThis.__lynxtronWorkerFixture.disposed,
      ]);
    },
  };

  const pluginURL = new URL('./worker-preload.fixture.js', import.meta.url)
    .href;
  const runtime = await startBTSWorkerRuntime(
    {
      windowId: 42,
      platform: 'android',
      preloads: [{ plugin: pluginURL, options: { mode: 'mvp' } }],
    },
    nativeBinding
  );

  assert.deepEqual(lifecycle, [['attach', 42]]);
  assert.deepEqual(exposed, [{ fixture: { windowId: 42 } }]);
  assert.equal(globalThis.__lynxtronWorkerFixture.context.options.mode, 'mvp');

  await runtime.dispose();
  assert.deepEqual(lifecycle, [
    ['attach', 42],
    ['detach', 42, true],
  ]);
});
