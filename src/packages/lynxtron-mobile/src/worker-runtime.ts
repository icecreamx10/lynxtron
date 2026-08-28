// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BTSPreloadDefinition } from './context-bridge.js';
import type {
  MobilePlatform,
  PreloadPluginDescriptor,
  PreloadPluginReference,
} from './types.js';

export interface BTSWorkerNativeBinding {
  /**
   * Attaches a Lynx BTS context to the current NativeScript worker isolate.
   * The binding must also install globalThis.__contextBridge.
   */
  attachBTSRuntime(windowId: number): void | Promise<void>;
  detachBTSRuntime(windowId: number): void | Promise<void>;
}

interface WorkerNativeGlobal {
  __lynxtronMobileWorkerNative?: BTSWorkerNativeBinding;
}

export interface BTSWorkerInitRequest {
  windowId: number;
  platform: MobilePlatform;
  preloads: PreloadPluginReference[];
}

interface PreloadModuleNamespace {
  default?: unknown;
  preload?: unknown;
}

export interface BTSWorkerRuntime {
  readonly windowId: number;
  dispose(): Promise<void>;
}

function normalizeReference(
  reference: PreloadPluginReference
): PreloadPluginDescriptor {
  return typeof reference === 'string' ? { plugin: reference } : reference;
}

function isPreloadDefinition(
  value: unknown
): value is BTSPreloadDefinition<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { kind?: unknown }).kind === 'lynxtron-bts-preload' &&
    typeof (value as { setup?: unknown }).setup === 'function'
  );
}

async function importPreloadDefinition(
  plugin: string
): Promise<BTSPreloadDefinition<unknown>> {
  const namespace = (await import(plugin)) as PreloadModuleNamespace;
  const definition = namespace.default ?? namespace.preload;
  if (!isPreloadDefinition(definition)) {
    throw new TypeError(
      `BTS preload plugin ${plugin} must export a defineBTSPreload() definition`
    );
  }
  return definition;
}

export async function startBTSWorkerRuntime(
  request: BTSWorkerInitRequest,
  nativeBinding: BTSWorkerNativeBinding = (globalThis as WorkerNativeGlobal)
    .__lynxtronMobileWorkerNative as BTSWorkerNativeBinding
): Promise<BTSWorkerRuntime> {
  if (!nativeBinding) {
    throw new Error(
      'Lynxtron worker native binding is unavailable in this NativeScript worker'
    );
  }
  if (!Number.isSafeInteger(request.windowId) || request.windowId <= 0) {
    throw new TypeError('BTS worker requires a valid windowId');
  }

  const abortController = new AbortController();
  const registrations: Array<{ dispose?(): void | Promise<void> }> = [];
  let attached = false;
  let disposed = false;

  const dispose = async (): Promise<void> => {
    if (disposed) {
      return;
    }
    disposed = true;
    abortController.abort();

    const errors: unknown[] = [];
    for (const registration of registrations.reverse()) {
      try {
        await registration.dispose?.();
      } catch (error) {
        errors.push(error);
      }
    }
    if (attached) {
      try {
        await nativeBinding.detachBTSRuntime(request.windowId);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, 'Failed to dispose Lynxtron BTS worker');
    }
  };

  try {
    await nativeBinding.attachBTSRuntime(request.windowId);
    attached = true;

    for (const reference of request.preloads) {
      const descriptor = normalizeReference(reference);
      const definition = await importPreloadDefinition(descriptor.plugin);
      const registration = await definition.setup({
        windowId: request.windowId,
        platform: request.platform,
        options: descriptor.options,
        signal: abortController.signal,
      });
      if (registration?.dispose) {
        registrations.push(registration);
      }
    }
  } catch (error) {
    try {
      await dispose();
    } catch (disposeError) {
      throw new AggregateError(
        [error, disposeError],
        'Failed to start and clean up Lynxtron BTS worker'
      );
    }
    throw error;
  }

  return Object.freeze({
    windowId: request.windowId,
    dispose,
  });
}
