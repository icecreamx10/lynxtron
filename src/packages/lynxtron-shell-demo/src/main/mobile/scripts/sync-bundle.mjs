// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDirectory, '..');
const shellDemoRoot = path.resolve(mobileRoot, '../../..');
const sourceBundle = path.join(
  shellDemoRoot,
  'output/bundle/lynx/main.lynx.bundle'
);
const androidAssetDirectory = path.join(
  mobileRoot,
  'App_Resources/Android/src/main/assets'
);
const iosAssetDirectory = path.join(mobileRoot, 'App_Resources/iOS');
const targetBundles = [
  path.join(androidAssetDirectory, 'main.lynx.bundle'),
  path.join(iosAssetDirectory, 'main.lynx.bundle'),
];

const sourceInfo = await stat(sourceBundle);
if (!sourceInfo.isFile() || sourceInfo.size === 0) {
  throw new Error(`Invalid mobile Lynx bundle: ${sourceBundle}`);
}

await Promise.all(
  [androidAssetDirectory, iosAssetDirectory].map((directory) =>
    mkdir(directory, { recursive: true })
  )
);
await Promise.all(
  targetBundles.map((targetBundle) => copyFile(sourceBundle, targetBundle))
);
console.log(
  `Prepared Android and iOS shell bundles (${sourceInfo.size} bytes each).`
);
