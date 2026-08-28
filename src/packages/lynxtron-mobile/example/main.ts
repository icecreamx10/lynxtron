// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  LynxTemplateData,
  LynxUpdateMeta,
  LynxWindow,
  protocol,
} from '../src/index.js';

protocol.handle('app', async (request) => {
  const response = await fetch(request.url.replace('app://', 'https://'));
  return {
    url: request.url,
    statusCode: response.status,
    data: await response.arrayBuffer(),
  };
});

const window = new LynxWindow({
  show: true,
  lynxPreference: {
    preloads: [
      {
        plugin: '@app/device-preload',
        options: { includeModel: true },
      },
    ],
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
