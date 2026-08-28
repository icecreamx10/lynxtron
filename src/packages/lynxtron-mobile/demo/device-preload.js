// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { contextBridge, defineBTSPreload } from '../dist/context-bridge.js';

export default defineBTSPreload((context) => {
  contextBridge.exposeInLynxBTS({
    device: {
      platform: context.platform,
      getWindowId: () => context.windowId,
    },
  });

  return {
    dispose() {
      console.log('[BTS preload] disposed');
    },
  };
});
