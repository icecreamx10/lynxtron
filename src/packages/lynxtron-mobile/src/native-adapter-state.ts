// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { NativeLynxtronMobileAdapter } from './native-adapter.js';

let installedAdapter: NativeLynxtronMobileAdapter | undefined;

export function getInstalledNativeAdapter():
  | NativeLynxtronMobileAdapter
  | undefined {
  return installedAdapter;
}

export function setInstalledNativeAdapter(
  adapter: NativeLynxtronMobileAdapter | undefined
): void {
  installedAdapter = adapter;
}

export function resetNativeAdapterForTesting(): void {
  installedAdapter = undefined;
}
