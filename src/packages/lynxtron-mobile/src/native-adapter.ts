// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  LoadOptions,
  LynxPreference,
  MobilePlatform,
  MobileWindowOptions,
  ResourceRequest,
  ResourceResponse,
} from './types.js';
import {
  getInstalledNativeAdapter,
  setInstalledNativeAdapter,
} from './native-adapter-state.js';

export type NativeWindowEventName =
  | 'show'
  | 'hide'
  | 'focus'
  | 'blur'
  | 'resize'
  | 'ready-to-show'
  | 'on-first-screen'
  | '--lynx-error'
  | 'frame-timings'
  | 'foreground'
  | 'background'
  | 'closed';

export interface NativeTemplateBundleHandle {
  isValid(): boolean;
  getErrorMessage(): string;
}

export interface NativeLynxWindowOptions {
  show: boolean;
  parentId?: number;
  title?: string;
  lynxPreference: LynxPreference;
  mobile: MobileWindowOptions;
}

export interface NativeLynxWindowCallbacks {
  emit(event: NativeWindowEventName, ...args: unknown[]): void;
  requestClose(): boolean;
  invoke(
    method: string,
    params: unknown,
    reply: (result?: unknown) => boolean
  ): void;
  message(method: string, params: unknown): void;
  resolveResource(
    request: ResourceRequest
  ): Promise<ResourceResponse | undefined>;
}

export interface NativeLynxWindowHandle {
  readonly id: number;

  show(): void;
  hide(): void;
  close(): void;
  destroy(): void;

  loadFile(path: string, options?: LoadOptions): boolean;
  loadURL(url: string, options?: LoadOptions): boolean;
  loadBundle(
    bundle: NativeTemplateBundleHandle,
    options?: LoadOptions
  ): boolean;
  updateMetaData(meta: { updateData?: object; globalProps?: object }): boolean;
  setGlobalProps(globalProps: object): boolean;
  sendGlobalEvent(eventName: string, args: unknown[]): boolean;
}

export interface NativeLynxtronMobileAdapter {
  readonly platform: MobilePlatform;

  createTemplateBundle(bytes: Uint8Array): NativeTemplateBundleHandle;
  createWindow(
    options: NativeLynxWindowOptions,
    callbacks: NativeLynxWindowCallbacks
  ): NativeLynxWindowHandle;
}

interface NativeAdapterGlobal {
  __lynxtronMobileNative?: NativeLynxtronMobileAdapter;
}

/**
 * Installs the platform adapter supplied by the NativeScript/N-API plugin.
 */
export function installNativeAdapter(
  adapter: NativeLynxtronMobileAdapter
): void {
  const installedAdapter = getInstalledNativeAdapter();
  if (installedAdapter && installedAdapter !== adapter) {
    throw new Error('A Lynxtron Mobile native adapter is already installed');
  }
  setInstalledNativeAdapter(adapter);
}

export function getNativeAdapter(): NativeLynxtronMobileAdapter {
  const globalAdapter = (globalThis as NativeAdapterGlobal)
    .__lynxtronMobileNative;
  const adapter = getInstalledNativeAdapter() ?? globalAdapter;
  if (!adapter) {
    throw new Error(
      'Lynxtron Mobile native adapter is unavailable. Install the NativeScript platform plugin before using LynxWindow.'
    );
  }
  return adapter;
}
