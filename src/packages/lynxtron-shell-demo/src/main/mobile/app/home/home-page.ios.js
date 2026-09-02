// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Dialogs } from '@nativescript/core';
import { LynxWindow, installNativeAdapter } from '@lynx-js/lynxtron-mobile';

const state = {
  callbacks: null,
  nativeHost: null,
  nativeListener: null,
  nativeView: null,
  pageReady: false,
  starting: false,
  window: null,
};

let adapterInstalled = false;
let nextWindowId = 1;

function log(message) {
  console.log(`[LYNXTRON_SHELL_MOBILE_IOS] ${message}`);
}

function normalizeAssetPath(path) {
  return path.replace(/^app:\/\//, '').replace(/^asset:\/\/\//, '');
}

function parseParams(paramsJSON) {
  try {
    return JSON.parse(paramsJSON);
  } catch {
    return {};
  }
}

function toNSData(bytes) {
  const data = NSData.dataWithData(bytes.buffer);
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return data;
  }
  return data.subdataWithRange(NSMakeRange(bytes.byteOffset, bytes.byteLength));
}

function createIOSAdapter() {
  return {
    platform: 'ios',
    createTemplateBundle(bytes) {
      const copy = new Uint8Array(bytes);
      return {
        bytes: copy,
        isValid: () => copy.byteLength > 0,
        getErrorMessage: () => (copy.byteLength ? '' : 'empty bundle'),
      };
    },
    createWindow(options, callbacks) {
      if (!state.nativeHost || !state.nativeView) {
        throw new Error('Native iOS LynxView has not been attached');
      }

      const id = nextWindowId++;
      const nativeHost = state.nativeHost;
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
          nativeHost.show();
          callbacks.emit('show');
          callbacks.emit('foreground');
        },
        hide() {
          alive();
          nativeHost.hide();
          callbacks.emit('background');
          callbacks.emit('hide');
        },
        close() {
          alive();
          nativeHost.destroy();
          destroyed = true;
          callbacks.emit('closed');
        },
        destroy() {
          if (!destroyed) {
            nativeHost.destroy();
            destroyed = true;
          }
        },
        loadFile(path, loadOptions) {
          alive();
          return nativeHost.renderAssetDataJSON(
            normalizeAssetPath(path),
            renderData(loadOptions)
          );
        },
        loadURL(url, loadOptions) {
          alive();
          if (!url.startsWith('asset:///') && !url.startsWith('app://')) {
            return false;
          }
          return nativeHost.renderAssetDataJSON(
            normalizeAssetPath(url),
            renderData(loadOptions)
          );
        },
        loadBundle(bundle, loadOptions) {
          alive();
          if (!bundle.isValid()) {
            return false;
          }
          return nativeHost.renderBytesDataJSONUrl(
            toNSData(bundle.bytes),
            renderData(loadOptions),
            'app://memory.lynx.bundle'
          );
        },
        updateMetaData(meta) {
          alive();
          if (meta.updateData) {
            nativeHost.updateDataJSON(JSON.stringify(meta.updateData));
          }
          if (meta.globalProps) {
            nativeHost.updateGlobalPropsJSON(JSON.stringify(meta.globalProps));
          }
          return true;
        },
        setGlobalProps(props) {
          alive();
          return nativeHost.updateGlobalPropsJSON(JSON.stringify(props));
        },
        sendGlobalEvent(name, args) {
          alive();
          return nativeHost.sendGlobalEventArgsJSON(name, JSON.stringify(args));
        },
      };
    },
  };
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
    data: { platform: 'mobile', host: 'NativeScript iOS' },
  });
}

function destroyShellWindow() {
  state.window?.destroy();
  state.callbacks = null;
  state.nativeHost = null;
  state.nativeListener = null;
  state.nativeView = null;
  state.pageReady = false;
  state.starting = false;
  state.window = null;
}

const IOSListener = NSObject.extend(
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
    onErrorMessage(code, message) {
      log(`native.onError ${code}: ${message}`);
      state.callbacks?.emit('--lynx-error', code, message);
    },
    onBridgeCallParamsJSONCallback(method, paramsJSON, callback) {
      const reply = (result) => {
        callback(result ?? null);
        return true;
      };
      state.callbacks?.invoke(method, parseParams(paramsJSON), reply);
    },
    onBridgeSendParamsJSON(method, paramsJSON) {
      state.callbacks?.message(method, parseParams(paramsJSON));
    },
    onDestroyed() {
      log('native.onDestroyed');
    },
  },
  {
    name: 'LynxtronShellIOSListener',
    protocols: [LynxtronIOSHostListener],
  }
);

export function createLynxView(args) {
  state.nativeListener = IOSListener.new();
  state.nativeHost = LynxtronIOSHost.alloc().initWithListener(
    state.nativeListener
  );
  const screenBounds = UIScreen.mainScreen.bounds;
  state.nativeView = state.nativeHost.createViewWithFrame(screenBounds);
  args.view = state.nativeView;
  startShellWindow();
}

export function onNavigatingTo(args) {
  const page = args.object;
  state.pageReady = true;
  state.starting = false;

  if (!adapterInstalled) {
    installNativeAdapter(createIOSAdapter());
    adapterInstalled = true;
  }

  startShellWindow();
  if (!page.__lynxtronLifecycleBound) {
    page.__lynxtronLifecycleBound = true;
    page.on('loaded', () => {
      state.pageReady = true;
      state.window?.show();
      startShellWindow();
    });
    page.on('unloaded', () => {
      state.window?.hide();
      state.pageReady = false;
    });
    page.on('navigatedFrom', (event) => {
      if (event.isBackNavigation) {
        destroyShellWindow();
      }
    });
  }
}
