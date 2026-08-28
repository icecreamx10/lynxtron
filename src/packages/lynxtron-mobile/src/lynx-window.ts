// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { CancelableEvent, TypedEventEmitter } from './events.js';
import {
  getNativeAdapter,
  type NativeLynxWindowHandle,
  type NativeWindowEventName,
} from './native-adapter.js';
import { resolveResourceRequest } from './protocol.js';
import {
  getNativeTemplateBundleHandle,
  getNativeUpdateMetaValue,
  LynxTemplateBundle,
  LynxUpdateMeta,
} from './template.js';
import type {
  FrameTimings,
  LoadOptions,
  LynxPreference,
  LynxWindowConstructorOptions,
  Size,
} from './types.js';

export interface LynxBridgeInvokeEvent {
  sendReply(result?: unknown): boolean;
}

export interface LynxWindowEventMap {
  show: [];
  hide: [];
  close: [event: CancelableEvent];
  closed: [];
  focus: [];
  blur: [];
  resize: [size: Size];
  'ready-to-show': [];
  'on-first-screen': [];
  '--lynx-error': [code: number, message: string];
  'frame-timings': [timings: FrameTimings];
  foreground: [];
  background: [];
  '-lynx-invoke': [
    event: LynxBridgeInvokeEvent,
    method: string,
    params: unknown
  ];
  '-lynx-message': [method: string, params: unknown];
}

export class WindowDestroyedError extends Error {
  constructor(id: number) {
    super(`LynxWindow ${id} has been destroyed`);
    this.name = 'WindowDestroyedError';
  }
}

type WindowState = 'created' | 'shown' | 'hidden' | 'destroyed';

const windows = new Map<number, LynxWindow>();
let focusedWindow: LynxWindow | undefined;

function copyStringArray(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? [...value] : [value];
}

function normalizePreference(
  preference: LynxPreference | undefined
): LynxPreference {
  return {
    preload: copyStringArray(preference?.preload),
    preloads: preference?.preloads?.map((entry) =>
      typeof entry === 'string'
        ? entry
        : { plugin: entry.plugin, options: entry.options }
    ),
    mainThreadPreload: copyStringArray(preference?.mainThreadPreload),
  };
}

export class LynxWindow extends TypedEventEmitter<LynxWindowEventMap> {
  readonly id: number;
  readonly #nativeHandle: NativeLynxWindowHandle;
  #state: WindowState = 'created';

  constructor(options: LynxWindowConstructorOptions = {}) {
    super();

    const adapter = getNativeAdapter();
    const callbacks = {
      emit: (event: NativeWindowEventName, ...args: unknown[]) => {
        this.#handleNativeEvent(event, args);
      },
      requestClose: () => this.#requestClose(),
      invoke: (
        method: string,
        params: unknown,
        reply: (result?: unknown) => boolean
      ) => {
        const event: LynxBridgeInvokeEvent = Object.freeze({
          sendReply: reply,
        });
        this.emit('-lynx-invoke', event, method, params);
      },
      message: (method: string, params: unknown) => {
        this.emit('-lynx-message', method, params);
      },
      resolveResource: resolveResourceRequest,
    };

    this.#nativeHandle = adapter.createWindow(
      {
        show: options.show ?? true,
        parentId: options.parent?.id,
        title: options.title,
        lynxPreference: normalizePreference(options.lynxPreference),
        mobile: { ...options.mobile },
      },
      callbacks
    );
    this.id = this.#nativeHandle.id;

    if (!Number.isSafeInteger(this.id) || this.id <= 0) {
      this.#nativeHandle.destroy();
      throw new Error('Native LynxWindow returned an invalid id');
    }
    if (windows.has(this.id)) {
      this.#nativeHandle.destroy();
      throw new Error(`Duplicate native LynxWindow id: ${this.id}`);
    }
    windows.set(this.id, this);
  }

  static fromId(id: number): LynxWindow | null {
    return windows.get(id) ?? null;
  }

  static getAllWindows(): LynxWindow[] {
    return [...windows.values()];
  }

  static getFocusedWindow(): LynxWindow | null {
    return focusedWindow ?? null;
  }

  show(): void {
    this.#assertAlive();
    this.#nativeHandle.show();
  }

  hide(): void {
    this.#assertAlive();
    this.#nativeHandle.hide();
  }

  close(): void {
    this.#assertAlive();
    if (this.#requestClose()) {
      this.#nativeHandle.close();
    }
  }

  destroy(): void {
    if (this.#state === 'destroyed') {
      return;
    }
    this.#nativeHandle.destroy();
    this.#finalizeDestroy();
  }

  isDestroyed(): boolean {
    return this.#state === 'destroyed';
  }

  isVisible(): boolean {
    return this.#state === 'shown';
  }

  loadFile(path: string, options?: LoadOptions): boolean {
    this.#assertAlive();
    if (!path) {
      throw new TypeError('loadFile path must not be empty');
    }
    return this.#nativeHandle.loadFile(path, options);
  }

  loadURL(url: string, options?: LoadOptions): boolean {
    this.#assertAlive();
    if (!url) {
      throw new TypeError('loadURL url must not be empty');
    }
    return this.#nativeHandle.loadURL(url, options);
  }

  loadBundle(
    templateBundle: LynxTemplateBundle,
    options?: LoadOptions
  ): boolean {
    this.#assertAlive();
    if (!(templateBundle instanceof LynxTemplateBundle)) {
      throw new TypeError('loadBundle requires a LynxTemplateBundle instance');
    }
    return this.#nativeHandle.loadBundle(
      getNativeTemplateBundleHandle(templateBundle),
      options
    );
  }

  updateMetaData(meta: LynxUpdateMeta): boolean {
    this.#assertAlive();
    if (!(meta instanceof LynxUpdateMeta)) {
      throw new TypeError('updateMetaData requires a LynxUpdateMeta instance');
    }
    return this.#nativeHandle.updateMetaData(getNativeUpdateMetaValue(meta));
  }

  setGlobalProps(globalProps: object): boolean {
    this.#assertAlive();
    if (!globalProps || typeof globalProps !== 'object') {
      throw new TypeError('setGlobalProps expects an object');
    }
    return this.#nativeHandle.setGlobalProps(globalProps);
  }

  sendGlobalEvent(eventName: string, ...args: unknown[]): boolean {
    this.#assertAlive();
    if (!eventName) {
      throw new TypeError('sendGlobalEvent name must not be empty');
    }
    return this.#nativeHandle.sendGlobalEvent(eventName, args);
  }

  #assertAlive(): void {
    if (this.#state === 'destroyed') {
      throw new WindowDestroyedError(this.id);
    }
  }

  #requestClose(): boolean {
    if (this.#state === 'destroyed') {
      return false;
    }
    const event = new CancelableEvent();
    this.emit('close', event);
    return !event.defaultPrevented;
  }

  #finalizeDestroy(): void {
    if (this.#state === 'destroyed') {
      return;
    }
    this.#state = 'destroyed';
    windows.delete(this.id);
    if (focusedWindow === this) {
      focusedWindow = undefined;
    }
    this.emit('closed');
  }

  #handleNativeEvent(event: NativeWindowEventName, args: unknown[]): void {
    if (this.#state === 'destroyed' && event !== 'closed') {
      return;
    }

    switch (event) {
      case 'show':
        this.#state = 'shown';
        this.emit('show');
        break;
      case 'hide':
        this.#state = 'hidden';
        this.emit('hide');
        break;
      case 'focus':
        focusedWindow = this;
        this.emit('focus');
        break;
      case 'blur':
        if (focusedWindow === this) {
          focusedWindow = undefined;
        }
        this.emit('blur');
        break;
      case 'resize':
        this.emit('resize', args[0] as Size);
        break;
      case 'ready-to-show':
        this.emit('ready-to-show');
        break;
      case 'on-first-screen':
        this.emit('on-first-screen');
        break;
      case '--lynx-error':
        this.emit('--lynx-error', Number(args[0]), String(args[1] ?? ''));
        break;
      case 'frame-timings':
        this.emit('frame-timings', (args[0] ?? {}) as FrameTimings);
        break;
      case 'foreground':
        this.emit('foreground');
        break;
      case 'background':
        this.emit('background');
        break;
      case 'closed':
        this.#finalizeDestroy();
        break;
    }
  }
}

export function resetLynxWindowsForTesting(): void {
  for (const window of [...windows.values()]) {
    window.destroy();
  }
  windows.clear();
  focusedWindow = undefined;
}
