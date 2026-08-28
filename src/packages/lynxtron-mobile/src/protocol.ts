// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  ProtocolHandler,
  ProtocolRequestRewriter,
  ResourceRequest,
  ResourceResponse,
} from './types.js';

function normalizeScheme(scheme: string): string {
  return scheme.trim().replace(/:$/, '').toLowerCase();
}

function schemeFromURL(url: string, fallback: string): string {
  const separator = url.indexOf(':');
  if (separator <= 0) {
    return fallback;
  }
  return normalizeScheme(url.slice(0, separator));
}

class ProtocolRegistry {
  readonly #handlers = new Map<string, ProtocolHandler>();
  #rewriter: ProtocolRequestRewriter | undefined;

  handle(scheme: string, handler: ProtocolHandler): void {
    const normalized = normalizeScheme(scheme);
    if (!normalized) {
      throw new TypeError('Protocol scheme must not be empty');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('Protocol handler must be a function');
    }
    this.#handlers.set(normalized, handler);
  }

  unhandle(scheme: string): void {
    this.#handlers.delete(normalizeScheme(scheme));
  }

  isProtocolHandled(scheme: string): boolean {
    return this.#handlers.has(normalizeScheme(scheme));
  }

  setRequestRewriter(
    handler: ProtocolRequestRewriter | null | undefined
  ): void {
    if (handler != null && typeof handler !== 'function') {
      throw new TypeError('Protocol request rewriter must be a function');
    }
    this.#rewriter = handler ?? undefined;
  }

  async resolve(
    originalRequest: ResourceRequest
  ): Promise<ResourceResponse | undefined> {
    let request = {
      ...originalRequest,
      scheme: normalizeScheme(originalRequest.scheme),
    };

    if (this.#rewriter) {
      const rewrittenURL = this.#rewriter({
        scheme: request.scheme,
        url: request.url,
      });
      if (rewrittenURL === false) {
        return undefined;
      }
      if (typeof rewrittenURL === 'string') {
        request = {
          ...request,
          url: rewrittenURL,
          scheme: schemeFromURL(rewrittenURL, request.scheme),
        };
      }
    }

    const handler = this.#handlers.get(request.scheme);
    if (!handler) {
      return undefined;
    }
    const response = await handler(request);
    return response === false ? undefined : response;
  }

  resetForTesting(): void {
    this.#handlers.clear();
    this.#rewriter = undefined;
  }
}

const registry = new ProtocolRegistry();

export const protocol = Object.freeze({
  handle: registry.handle.bind(registry),
  unhandle: registry.unhandle.bind(registry),
  isProtocolHandled: registry.isProtocolHandled.bind(registry),
  setRequestRewriter: registry.setRequestRewriter.bind(registry),
});

export function resolveResourceRequest(
  request: ResourceRequest
): Promise<ResourceResponse | undefined> {
  return registry.resolve(request);
}

export function resetProtocolForTesting(): void {
  registry.resetForTesting();
}
