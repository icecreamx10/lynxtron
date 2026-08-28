// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { contextBridge, defineBTSPreload } from '../dist/context-bridge.js';

export default defineBTSPreload((context) => {
  globalThis.__lynxtronWorkerFixture = {
    setup: true,
    disposed: false,
    context,
  };
  contextBridge.exposeInLynxBTS({ fixture: { windowId: context.windowId } });
  return {
    dispose() {
      globalThis.__lynxtronWorkerFixture.disposed = true;
    },
  };
});
