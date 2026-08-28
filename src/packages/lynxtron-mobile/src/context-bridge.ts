// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MobilePlatform } from './types.js';
import { getInstalledContextBridge } from './context-bridge-state.js';

export interface BTSContextBridgeBinding {
  exposeInLynxBTS(apis: Record<string, unknown>): void;
}

interface ContextBridgeGlobal {
  __contextBridge?: BTSContextBridgeBinding;
}

function getBinding(): BTSContextBridgeBinding {
  const globalBinding = (globalThis as ContextBridgeGlobal).__contextBridge;
  const binding = getInstalledContextBridge() ?? globalBinding;
  if (!binding || typeof binding.exposeInLynxBTS !== 'function') {
    throw new Error(
      'Lynxtron BTS context bridge is unavailable. This module must run inside an attached Lynxtron NativeScript worker.'
    );
  }
  return binding;
}

export interface ContextBridge {
  exposeInLynxBTS(apis: Record<string, unknown>): void;
}

export const contextBridge: ContextBridge = Object.freeze({
  exposeInLynxBTS(apis: Record<string, unknown>): void {
    if (!apis || typeof apis !== 'object') {
      throw new TypeError('exposeInLynxBTS expects an API object');
    }
    getBinding().exposeInLynxBTS(apis);
  },
});

export interface BTSPreloadContext<Options = unknown> {
  readonly windowId: number;
  readonly platform: MobilePlatform;
  readonly options: Options;
  readonly signal: AbortSignal;
}

export interface BTSPreloadRegistration {
  dispose?(): void | Promise<void>;
}

export interface BTSPreloadDefinition<Options = unknown> {
  readonly kind: 'lynxtron-bts-preload';
  readonly setup: (
    context: BTSPreloadContext<Options>
  ) => void | BTSPreloadRegistration | Promise<void | BTSPreloadRegistration>;
}

export function defineBTSPreload<Options = unknown>(
  setup: BTSPreloadDefinition<Options>['setup']
): BTSPreloadDefinition<Options> {
  if (typeof setup !== 'function') {
    throw new TypeError('defineBTSPreload expects a setup function');
  }
  return Object.freeze({
    kind: 'lynxtron-bts-preload' as const,
    setup,
  });
}
