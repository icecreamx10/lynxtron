// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { contextBridge, defineBTSPreload } from '../src/context-bridge.js';

export default defineBTSPreload<{ includeModel?: boolean }>((context) => {
  contextBridge.exposeInLynxBTS({
    device: {
      platform: context.platform,
      includesModel: context.options.includeModel === true,
    },
  });
});
