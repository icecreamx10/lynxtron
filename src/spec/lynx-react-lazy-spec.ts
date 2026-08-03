// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { LynxWindow } from 'lynxtron';

import { expect } from 'chai';
import { once } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { closeAllWindows } from './lib/window-helpers';

describe('React.lazy', () => {
  afterEach(closeAllWindows);

  it('loads an async bundle relative to a local template', async function () {
    this.timeout(30000);

    const distPath = path.resolve(__dirname, './case/lynx-card/dist');
    const bundlePath = path.join(distPath, 'react-lazy.lynx.bundle');
    const asyncPath = path.join(distPath, 'async');
    expect(fs.existsSync(bundlePath)).to.equal(true);
    expect(fs.existsSync(asyncPath)).to.equal(true);
    expect(
      fs.readdirSync(asyncPath).some((file) => file.endsWith('.bundle'))
    ).to.equal(true);

    const window = new LynxWindow({ show: true });
    const messagePromise = once(window as any, '-lynx-message') as Promise<
      [string, any]
    >;

    expect(await window.loadFile(bundlePath)).to.equal(true);

    const [method, result] = await Promise.race([
      messagePromise,
      setTimeout(10000).then(() => {
        throw new Error('Timed out waiting for React.lazy bundle');
      }),
    ]);

    expect(method).to.equal('lazy_bundle_loaded');
    expect(result).to.deep.equal({
      marker: 'react-lazy-local-async-bundle',
    });
  });
});
