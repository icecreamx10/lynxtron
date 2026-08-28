// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

type Listener<Args extends unknown[]> = (...args: Args) => void;

type EventArgs<
  Events extends object,
  Key extends keyof Events
> = Events[Key] extends unknown[] ? Events[Key] : never;

export class TypedEventEmitter<Events extends object> {
  readonly #listeners = new Map<string, Set<Listener<unknown[]>>>();

  on<Key extends keyof Events & string>(
    event: Key,
    listener: Listener<EventArgs<Events, Key>>
  ): this {
    let listeners = this.#listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(event, listeners);
    }
    listeners.add(listener as Listener<unknown[]>);
    return this;
  }

  once<Key extends keyof Events & string>(
    event: Key,
    listener: Listener<EventArgs<Events, Key>>
  ): this {
    const wrapped: Listener<EventArgs<Events, Key>> = (...args) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  off<Key extends keyof Events & string>(
    event: Key,
    listener: Listener<EventArgs<Events, Key>>
  ): this {
    const listeners = this.#listeners.get(event);
    listeners?.delete(listener as Listener<unknown[]>);
    if (listeners?.size === 0) {
      this.#listeners.delete(event);
    }
    return this;
  }

  removeAllListeners<Key extends keyof Events & string>(event?: Key): this {
    if (event === undefined) {
      this.#listeners.clear();
    } else {
      this.#listeners.delete(event);
    }
    return this;
  }

  protected emit<Key extends keyof Events & string>(
    event: Key,
    ...args: EventArgs<Events, Key>
  ): boolean {
    const listeners = this.#listeners.get(event);
    if (!listeners?.size) {
      return false;
    }
    for (const listener of [...listeners]) {
      listener(...args);
    }
    return true;
  }
}

export class CancelableEvent {
  #defaultPrevented = false;

  get defaultPrevented(): boolean {
    return this.#defaultPrevented;
  }

  preventDefault(): void {
    this.#defaultPrevented = true;
  }
}
