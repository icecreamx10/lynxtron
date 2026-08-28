// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { fromObject } from '@nativescript/core';
import {
  LynxTemplateBundle,
  LynxTemplateData,
  LynxUpdateMeta,
  LynxWindow,
  installNativeAdapter,
} from '@lynx-js/lynxtron-mobile';

let nextWindowId = 1;

function createDemoAdapter(appendLog) {
  return {
    platform: 'android',
    createTemplateBundle(bytes) {
      return {
        isValid: () => bytes.byteLength > 0,
        getErrorMessage: () => (bytes.byteLength ? '' : 'empty bundle'),
      };
    },
    createWindow(options, callbacks) {
      const id = nextWindowId++;
      appendLog(`native.createWindow #${id}`);
      appendLog(`presentation=${options.mobile.presentation}`);

      let destroyed = false;
      const alive = () => {
        if (destroyed) {
          throw new Error(`window #${id} destroyed`);
        }
      };

      return {
        id,
        show() {
          alive();
          callbacks.emit('show');
          callbacks.emit('foreground');
        },
        hide() {
          alive();
          callbacks.emit('background');
          callbacks.emit('hide');
        },
        close() {
          alive();
          destroyed = true;
          callbacks.emit('closed');
        },
        destroy() {
          if (!destroyed) {
            destroyed = true;
            callbacks.emit('closed');
          }
        },
        loadFile(path) {
          alive();
          appendLog(`loadFile ${path}`);
          setTimeout(() => {
            callbacks.emit('ready-to-show');
            callbacks.emit('on-first-screen');
          }, 80);
          return true;
        },
        loadURL(url) {
          alive();
          appendLog(`loadURL ${url}`);
          return true;
        },
        loadBundle(bundle) {
          alive();
          appendLog(`loadBundle valid=${bundle.isValid()}`);
          return bundle.isValid();
        },
        updateMetaData(meta) {
          alive();
          appendLog(`updateMetaData count=${meta.updateData?.count}`);
          return true;
        },
        setGlobalProps(props) {
          alive();
          appendLog(`setGlobalProps theme=${props.theme}`);
          return true;
        },
        sendGlobalEvent(name) {
          alive();
          appendLog(`sendGlobalEvent ${name}`);
          return true;
        },
      };
    },
  };
}

export function onNavigatingTo(args) {
  const page = args.object;
  const lines = [];
  const viewModel = fromObject({
    status: 'Starting P0 runtime…',
    log: '',
  });
  page.bindingContext = viewModel;

  const appendLog = (message) => {
    lines.push(message);
    viewModel.set('log', lines.join('\n'));
    console.log(`[LYNXTRON_MOBILE_DEMO] ${message}`);
  };

  installNativeAdapter(createDemoAdapter(appendLog));

  const window = new LynxWindow({
    show: false,
    mobile: { presentation: 'embedded' },
    lynxPreference: { preloads: ['@app/device-preload'] },
  });

  window.on('show', () => appendLog('event show'));
  window.on('foreground', () => appendLog('event foreground'));
  window.on('ready-to-show', () => appendLog('event ready-to-show'));
  window.on('on-first-screen', () => {
    appendLog('event on-first-screen');
    viewModel.set('status', `P0 running · LynxWindow #${window.id}`);
  });

  window.show();
  window.loadFile('app://main.lynx.bundle');

  const bundle = new LynxTemplateBundle(
    new Uint8Array([0x4c, 0x59, 0x4e, 0x58])
  );
  window.loadBundle(bundle);
  window.updateMetaData(
    new LynxUpdateMeta({
      updateData: new LynxTemplateData({ count: 1 }),
    })
  );
  window.setGlobalProps({ theme: 'dark' });
  window.sendGlobalEvent('android-demo-ready');

  page.on('unloaded', () => window.destroy());
}
