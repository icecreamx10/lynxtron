// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type MobilePlatform = 'android' | 'ios';

export type BinaryLike = ArrayBuffer | ArrayBufferView;

export interface Size {
  width: number;
  height: number;
}

export interface LoadOptions {
  data?: object;
  globalProps?: object;
}

export interface PreloadPluginDescriptor {
  plugin: string;
  options?: Record<string, unknown>;
}

export type PreloadPluginReference = string | PreloadPluginDescriptor;

export interface LynxPreference {
  /**
   * Compatibility entry for a BTS preload module bundled with the app.
   */
  preload?: string | string[];

  /**
   * NativeScript capability plugins loaded in the per-window BTS worker.
   */
  preloads?: PreloadPluginReference[];

  /**
   * Low-level MTS artifact. The native adapter decides how it is loaded.
   */
  mainThreadPreload?: string | string[];
}

export interface MobileWindowOptions {
  presentation?: 'embedded' | 'push' | 'modal';
  container?: unknown;
  android?: Record<string, unknown>;
  ios?: Record<string, unknown>;
}

export interface LynxWindowConstructorOptions {
  show?: boolean;
  parent?: LynxWindowReference;
  title?: string;
  lynxPreference?: LynxPreference;
  mobile?: MobileWindowOptions;
}

export interface LynxWindowReference {
  readonly id: number;
}

export interface ResourceRequest {
  resourceType: string;
  scheme: string;
  url: string;
}

export interface ResourceResponse {
  url: string;
  statusCode: number;
  data: BinaryLike;
  headers?: Record<string, string>;
}

export type ProtocolHandler = (
  request: ResourceRequest
) => ResourceResponse | Promise<ResourceResponse> | false | undefined;

export interface ProtocolRewriteRequest {
  scheme: string;
  url: string;
}

export type ProtocolRequestRewriter = (
  request: ProtocolRewriteRequest
) => string | false | undefined;

export interface FrameTimings {
  [key: string]: unknown;
}

export interface LynxErrorDetails {
  code: number;
  message: string;
}
