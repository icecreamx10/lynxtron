#!/usr/bin/env node

import proc from 'node:child_process';
import runtimeArtifacts from './runtime-artifacts.cjs';
import { ensureRuntime } from './runtime-manager.js';

const { parseRuntimeArguments, resolveRuntimeVariant } = runtimeArtifacts;
const { cliVariant, forwardedArgs } = parseRuntimeArguments(process.argv.slice(2));
const variant = resolveRuntimeVariant({
  cliVariant,
  envVariant: process.env.LYNXTRON_RUNTIME_VARIANT,
  defaultVariant: 'devtool',
});
const { executablePath: lynxtron } = await ensureRuntime({
  variant,
  customUrl:
    process.env.LYNXTRON_BINARY_URL ||
    process.env.npm_config_custom_lynxtron_binary_url,
});

const child = proc.spawn(lynxtron, forwardedArgs, { stdio: 'inherit', windowsHide: false });
child.on('close', function (code, signal) {
  if (code === null) {
    console.error(lynxtron, 'exited with signal', signal);
    process.exit(1);
  }
  process.exit(code);
});

const handleTerminationSignal = function (signal) {
  process.on(signal, function signalHandler () {
    if (!child.killed) {
      child.kill(signal);
    }
  });
};

handleTerminationSignal('SIGINT');
handleTerminationSignal('SIGTERM');
