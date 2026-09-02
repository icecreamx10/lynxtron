// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

interface EchoProvider {
  echo(message: string): string;
}

interface SymmetricNodeModule extends Partial<EchoProvider> {
  exposed?: Partial<EchoProvider>;
}

interface RetouchNativeGate0Module {
  greeting(): string;
}

interface LynxNapiModuleLoader {
  load(name: string): unknown;
}

interface LynxWithNapiLoader {
  getModuleLoader(): LynxNapiModuleLoader;
}

export function greetingFromRetouchNative(): string {
  'background only';

  const loader = (lynx as unknown as LynxWithNapiLoader).getModuleLoader();
  const module = loader.load('RetouchNative') as RetouchNativeGate0Module;
  if (typeof module?.greeting !== 'function') {
    throw new Error('RetouchNative.greeting is unavailable');
  }
  return module.greeting();
}

export function echoFromHost(message: string): string {
  'background only';

  const nodejs = NativeModules.nodejs as SymmetricNodeModule;
  const echo = nodejs.exposed?.echo ?? nodejs.echo;
  if (typeof echo !== 'function') {
    throw new Error('The current host does not provide nodejs.echo');
  }
  return echo(message);
}

export function showHostDialog(message: string, callback: () => void): void {
  'background only';

  NativeModules.bridge.call('showDialog', { message }, callback);
}
