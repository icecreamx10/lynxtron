// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

async function waitForJson(filePath, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

async function verifySpaceContainingArguments(modulePath) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lynxtron plugin '));
  const helperPath = path.join(tempDir, 'capture arguments.mjs');
  const outputPath = path.join(tempDir, 'captured arguments.json');
  const entry = path.join(tempDir, 'app with spaces', 'dist', 'desktop');
  const binDir = path.join(tempDir, 'bin with spaces');

  try {
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(
      helperPath,
      "import fs from 'node:fs'; fs.writeFileSync(process.env.LYNXTRON_TEST_OUTPUT, JSON.stringify(process.argv.slice(2)));\n",
    );

    if (process.platform === 'win32') {
      await fs.writeFile(
        path.join(binDir, 'lynxtron.cmd'),
        `@echo off\r\n"${process.execPath}" "${helperPath}" %*\r\n`,
      );
    } else {
      const quoteForShell = (value) => `'${value.replaceAll("'", "'\\''")}'`;
      const shimPath = path.join(binDir, 'lynxtron');
      await fs.writeFile(
        shimPath,
        `#!/bin/sh\nexec ${quoteForShell(process.execPath)} ${quoteForShell(helperPath)} "$@"\n`,
      );
      await fs.chmod(shimPath, 0o755);
    }

    const { pluginLynxtron } = await import(pathToFileURL(modulePath).href);
    let doneCallback;
    const compiler = {
      options: {},
      hooks: {
        done: {
          tap(_name, callback) {
            doneCallback = callback;
          },
        },
      },
    };

    pluginLynxtron({
      isDev: true,
      entry,
      args: ['--label', 'value with spaces'],
      env: {
        LYNXTRON_TEST_OUTPUT: outputPath,
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
      },
      autolink: false,
    }).apply(compiler);

    assert.equal(typeof doneCallback, 'function');
    doneCallback();

    assert.deepEqual(await waitForJson(outputPath), [
      '--label',
      'value with spaces',
      entry,
    ]);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

test('rspack plugin resolves the npm shim and preserves spaces in arguments', async () => {
  await verifySpaceContainingArguments(
    path.resolve(import.meta.dirname, '../dist/rspack.js'),
  );
});

test('legacy plugin entry resolves the npm shim and preserves spaces in arguments', async () => {
  await verifySpaceContainingArguments(
    path.resolve(import.meta.dirname, '../index.js'),
  );
});
