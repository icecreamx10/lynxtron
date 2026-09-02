// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Dialogs } from '@nativescript/core';
import { LynxWindow, installNativeAdapter } from '@lynx-js/lynxtron-mobile';

const state = {
  callbacks: null,
  nativeListener: null,
  nativeView: null,
  pageReady: false,
  starting: false,
  window: null,
};

let adapterInstalled = false;
let nextWindowId = 1;

function log(message) {
  console.log(`[LYNXTRON_SHELL_MOBILE_ANDROID] ${message}`);
}

function host() {
  return org.lynxtron.mobile.demo.LynxtronLynxHost;
}

function normalizeAssetPath(path) {
  return path.replace(/^app:\/\//, '').replace(/^asset:\/\/\//, '');
}

function toJavaBytes(bytes) {
  const result = Array.create('byte', bytes.byteLength);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    const value = bytes[index];
    result[index] = value > 127 ? value - 256 : value;
  }
  return result;
}

function createAndroidAdapter() {
  return {
    platform: 'android',
    createTemplateBundle(bytes) {
      const copy = new Uint8Array(bytes);
      return {
        bytes: copy,
        isValid: () => copy.byteLength > 0,
        getErrorMessage: () => (copy.byteLength ? '' : 'empty bundle'),
      };
    },
    createWindow(options, callbacks) {
      if (!state.nativeView) {
        throw new Error('Native LynxView has not been attached');
      }

      const id = nextWindowId++;
      const nativeView = state.nativeView;
      let destroyed = false;
      state.callbacks = callbacks;
      log(`native.createWindow #${id} (${options.mobile.presentation})`);

      const alive = () => {
        if (destroyed) {
          throw new Error(`window #${id} destroyed`);
        }
      };
      const renderData = (loadOptions) =>
        JSON.stringify(loadOptions?.data ?? {});

      return {
        id,
        show() {
          alive();
          host().show(nativeView);
          callbacks.emit('show');
          callbacks.emit('foreground');
        },
        hide() {
          alive();
          host().hide(nativeView);
          callbacks.emit('background');
          callbacks.emit('hide');
        },
        close() {
          alive();
          host().destroy(nativeView);
          destroyed = true;
          callbacks.emit('closed');
        },
        destroy() {
          if (!destroyed) {
            host().destroy(nativeView);
            destroyed = true;
          }
        },
        loadFile(path, loadOptions) {
          alive();
          host().renderAsset(
            nativeView,
            normalizeAssetPath(path),
            renderData(loadOptions)
          );
          return true;
        },
        loadURL(url, loadOptions) {
          alive();
          if (!url.startsWith('asset:///') && !url.startsWith('app://')) {
            return false;
          }
          host().renderAsset(
            nativeView,
            normalizeAssetPath(url),
            renderData(loadOptions)
          );
          return true;
        },
        loadBundle(bundle, loadOptions) {
          alive();
          if (!bundle.isValid()) {
            return false;
          }
          host().renderBytes(
            nativeView,
            toJavaBytes(bundle.bytes),
            renderData(loadOptions),
            'app://memory.lynx.bundle'
          );
          return true;
        },
        updateMetaData(meta) {
          alive();
          if (meta.updateData) {
            host().updateData(nativeView, JSON.stringify(meta.updateData));
          }
          if (meta.globalProps) {
            host().updateGlobalProps(
              nativeView,
              JSON.stringify(meta.globalProps)
            );
          }
          return true;
        },
        setGlobalProps(props) {
          alive();
          host().updateGlobalProps(nativeView, JSON.stringify(props));
          return true;
        },
        sendGlobalEvent(name, args) {
          alive();
          host().sendGlobalEvent(nativeView, name, JSON.stringify(args));
          return true;
        },
      };
    },
  };
}

function parseParams(paramsJson) {
  try {
    return JSON.parse(paramsJson);
  } catch {
    return {};
  }
}

function startShellWindow() {
  if (!state.pageReady || !state.nativeView || state.starting || state.window) {
    return;
  }

  state.starting = true;
  const window = new LynxWindow({
    show: false,
    title: 'Lynxtron Shell Mobile',
    mobile: { presentation: 'embedded' },
  });
  state.window = window;

  window.on('-lynx-invoke', async (event, method, params) => {
    log(`bridge.call ${method}`);
    if (method === 'showDialog') {
      await Dialogs.alert({
        title: 'Lynxtron Mobile',
        message: String(params?.message ?? ''),
        okButtonText: 'OK',
      });
      event.sendReply({ ok: true });
      return;
    }
    event.sendReply({ error: `Unsupported mobile bridge method: ${method}` });
  });
  window.on('-lynx-message', (method) => log(`bridge.send ${method}`));
  window.on('ready-to-show', () => log('event ready-to-show'));
  window.on('on-first-screen', () => log('event on-first-screen'));
  window.on('--lynx-error', (code, message) =>
    log(`event --lynx-error ${code}: ${message}`)
  );

  window.show();
  window.loadFile('app://main.lynx.bundle', {
    data: { platform: 'mobile', host: 'NativeScript' },
  });
}

export function createLynxView(args) {
  state.nativeListener = new org.lynxtron.mobile.demo.LynxtronLynxHost.Listener(
    {
      onPageStart(url) {
        log(`native.onPageStart ${url}`);
      },
      onRuntimeReady() {
        log('native.onRuntimeReady');
      },
      onLoadSuccess() {
        log('native.onLoadSuccess');
        state.callbacks?.emit('ready-to-show');
      },
      onFirstScreen() {
        log('native.onFirstScreen');
        state.callbacks?.emit('on-first-screen');
      },
      onError(code, message) {
        log(`native.onError ${code}: ${message}`);
        state.callbacks?.emit('--lynx-error', code, message);
      },
      onBridgeCall(method, paramsJson, callback) {
        const reply = (result) => {
          callback.invoke(result ?? null);
          return true;
        };
        state.callbacks?.invoke(method, parseParams(paramsJson), reply);
      },
      onBridgeSend(method, paramsJson) {
        state.callbacks?.message(method, parseParams(paramsJson));
      },
      onDestroyed() {
        log('native.onDestroyed');
      },
    }
  );

  state.nativeView = host().create(args.context, state.nativeListener);
  args.view = state.nativeView;
  startShellWindow();
}

export function onNavigatingTo(args) {
  const page = args.object;
  state.pageReady = true;
  state.starting = false;

  if (!adapterInstalled) {
    installNativeAdapter(createAndroidAdapter());
    adapterInstalled = true;
  }

  startShellWindow();
  page.on('unloaded', () => {
    state.window?.destroy();
    state.callbacks = null;
    state.nativeView = null;
    state.pageReady = false;
    state.starting = false;
    state.window = null;
  });
}
