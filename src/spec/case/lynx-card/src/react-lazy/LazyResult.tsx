// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useEffect } from '@lynx-js/react';

export default function LazyResult() {
  useEffect(() => {
    const bridge = (NativeModules as any).bridge as any;
    bridge.send('lazy_bundle_loaded', {
      marker: 'react-lazy-local-async-bundle',
    });
  }, []);

  return <text>Lazy bundle loaded</text>;
}
