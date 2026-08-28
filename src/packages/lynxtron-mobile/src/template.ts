// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  getNativeAdapter,
  type NativeTemplateBundleHandle,
} from './native-adapter.js';
import type { BinaryLike } from './types.js';

const templateBundleHandles = new WeakMap<
  LynxTemplateBundle,
  NativeTemplateBundleHandle
>();

function copyBytes(input: BinaryLike): Uint8Array {
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input.slice(0));
  }
  return new Uint8Array(
    input.buffer.slice(
      input.byteOffset,
      input.byteOffset + input.byteLength
    ) as ArrayBuffer
  );
}

export class LynxTemplateBundle {
  constructor(buffer: BinaryLike) {
    templateBundleHandles.set(
      this,
      getNativeAdapter().createTemplateBundle(copyBytes(buffer))
    );
  }

  isValid(): boolean {
    return getNativeTemplateBundleHandle(this).isValid();
  }

  getErrorMessage(): string {
    return getNativeTemplateBundleHandle(this).getErrorMessage();
  }
}

export function getNativeTemplateBundleHandle(
  bundle: LynxTemplateBundle
): NativeTemplateBundleHandle {
  const handle = templateBundleHandles.get(bundle);
  if (!handle) {
    throw new TypeError('Invalid LynxTemplateBundle instance');
  }
  return handle;
}

export class LynxTemplateData<Value extends object = Record<string, unknown>> {
  readonly #value: Value;

  constructor(value: Value) {
    this.#value = value;
  }

  toObject(): Value {
    return this.#value;
  }
}

export class LynxUpdateMeta {
  updateData?: LynxTemplateData;
  globalProps?: LynxTemplateData;

  constructor(init?: {
    updateData?: LynxTemplateData;
    globalProps?: LynxTemplateData;
  }) {
    this.updateData = init?.updateData;
    this.globalProps = init?.globalProps;
  }
}

export function getNativeUpdateMetaValue(meta: LynxUpdateMeta): {
  updateData?: object;
  globalProps?: object;
} {
  return {
    updateData: meta.updateData?.toObject(),
    globalProps: meta.globalProps?.toObject(),
  };
}
