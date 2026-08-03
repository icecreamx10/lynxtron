// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { lazy, Suspense } from '@lynx-js/react';

const LazyResult = lazy(() => import('./LazyResult.js'));

export default function App() {
  return (
    <view>
      <Suspense fallback={<text>Loading lazy bundle</text>}>
        <LazyResult />
      </Suspense>
    </view>
  );
}
