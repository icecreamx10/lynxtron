// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { fromObject } from '@nativescript/core';
import {
  LynxWindow,
  installNativeAdapter,
} from '@lynx-js/lynxtron-mobile';

const state = {
  callbacks: null,
  lines: [],
  nativeListener: null,
  nativeView: null,
  pageReady: false,
  starting: false,
  viewModel: null,
  window: null,
};

let adapterInstalled = false;
let nextWindowId = 1;

function appendLog(message) {
  state.lines.push(message);
  state.viewModel?.set('log', state.lines.join('\n'));
  console.log(`[LYNXTRON_MOBILE_DEMO] ${message}`);
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

function createRealAndroidAdapter() {
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
      appendLog(`native.createWindow #${id}`);
      appendLog(`presentation=${options.mobile.presentation}`);

      const alive = () => {
        if (destroyed) {
          throw new Error(`window #${id} destroyed`);
        }
      };
      const renderOptions = (loadOptions) =>
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
          const assetPath = normalizeAssetPath(path);
          appendLog(`LynxView.renderTemplateUrl ${assetPath}`);
          host().renderAsset(nativeView, assetPath, renderOptions(loadOptions));
          return true;
        },
        loadURL(url, loadOptions) {
          alive();
          if (!url.startsWith('asset:///') && !url.startsWith('app://')) {
            appendLog(`loadURL unsupported by asset provider: ${url}`);
            return false;
          }
          host().renderAsset(
            nativeView,
            normalizeAssetPath(url),
            renderOptions(loadOptions)
          );
          return true;
        },
        loadBundle(bundle, loadOptions) {
          alive();
          if (!bundle.isValid()) {
            return false;
          }
          appendLog(
            `LynxView.renderTemplateWithBaseUrl ${bundle.bytes.byteLength}b`
          );
          host().renderBytes(
            nativeView,
            toJavaBytes(bundle.bytes),
            renderOptions(loadOptions),
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
            host().updateGlobalProps(nativeView, JSON.stringify(meta.globalProps));
          }
          appendLog('LynxView.updateMetaData');
          return true;
        },
        setGlobalProps(props) {
          alive();
          host().updateGlobalProps(nativeView, JSON.stringify(props));
          appendLog('LynxView.updateGlobalProps');
          return true;
        },
        sendGlobalEvent(name, args) {
          alive();
          host().sendGlobalEvent(nativeView, name, JSON.stringify(args));
          appendLog(`LynxView.sendGlobalEvent ${name}`);
          return true;
        },
      };
    },
  };
}

function startLynxWindow() {
  if (!state.pageReady || !state.nativeView || state.starting || state.window) {
    return;
  }

  state.starting = true;
  appendLog('page and native LynxView ready');

  const window = new LynxWindow({
    show: false,
    mobile: { presentation: 'embedded' },
    lynxPreference: { preloads: ['@app/device-preload'] },
  });
  state.window = window;

  window.on('show', () => appendLog('event show'));
  window.on('foreground', () => appendLog('event foreground'));
  window.on('ready-to-show', () => appendLog('event ready-to-show'));
  window.on('--lynx-error', (code, message) => {
    state.viewModel?.set('status', `Lynx error ${code}`);
    appendLog(`event --lynx-error ${message}`);
  });
  window.on('on-first-screen', () => {
    appendLog('event on-first-screen');
    state.viewModel?.set(
      'status',
      `Real LynxView rendered · Window #${window.id}`
    );
  });

  window.show();
  window.loadFile('app://main.lynx.bundle', {
    data: {
      runtime: 'Lynxtron Mobile',
      engine: 'Lynx Android source build (DEPS.lynx)',
    },
  });
}

export function createLynxView(args) {
  state.nativeListener = new org.lynxtron.mobile.demo.LynxtronLynxHost.Listener({
    onPageStart(url) {
      appendLog(`native.onPageStart ${url}`);
    },
    onRuntimeReady() {
      appendLog('native.onRuntimeReady');
    },
    onLoadSuccess() {
      appendLog('native.onLoadSuccess');
      state.callbacks?.emit('ready-to-show');
    },
    onFirstScreen() {
      appendLog('native.onFirstScreen');
      state.callbacks?.emit('on-first-screen');
    },
    onError(code, message) {
      appendLog(`native.onError ${code}: ${message}`);
      state.callbacks?.emit('--lynx-error', code, message);
    },
    onDestroyed() {
      appendLog('native.onDestroyed');
    },
  });

  state.nativeView = host().create(args.context, state.nativeListener);
  args.view = state.nativeView;
  appendLog('real com.lynx.tasm.LynxView attached');
  startLynxWindow();
}

export function onNavigatingTo(args) {
  const page = args.object;
  state.lines = [];
  state.pageReady = true;
  state.starting = false;
  state.viewModel = fromObject({
    status: 'Starting real Lynx runtime…',
    log: '',
  });
  page.bindingContext = state.viewModel;

  if (!adapterInstalled) {
    installNativeAdapter(createRealAndroidAdapter());
    adapterInstalled = true;
  }

  startLynxWindow();

  page.on('unloaded', () => {
    state.window?.destroy();
    state.callbacks = null;
    state.nativeView = null;
    state.pageReady = false;
    state.starting = false;
    state.window = null;
  });
}
