// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BTSContextBridgeBinding } from './context-bridge.js';

let installedBinding: BTSContextBridgeBinding | undefined;

export function getInstalledContextBridge():
  | BTSContextBridgeBinding
  | undefined {
  return installedBinding;
}

export function installContextBridgeForTesting(
  binding: BTSContextBridgeBinding
): void {
  installedBinding = binding;
}

export function resetContextBridgeForTesting(): void {
  installedBinding = undefined;
}
