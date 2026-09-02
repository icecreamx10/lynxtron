import fs from 'node:fs/promises';
import path from 'node:path';

import { ensureRuntime } from '../runtime-manager.js';

const [packageRoot, downloadLog, startedMarker, releaseMarker, shouldHold] =
  process.argv.slice(2);

async function waitForFile(filePath) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      await fs.access(filePath);
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

const result = await ensureRuntime({
  variant: 'devtool',
  customUrl: 'https://downloads.example.test/devtool.zip',
  packageRoot,
  executableRelativePath: 'lynxtron',
  platform: 'linux',
  download: async (_url, archivePath) => {
    await fs.appendFile(downloadLog, `${process.pid}\n`);
    await fs.writeFile(archivePath, 'synthetic archive');
    if (shouldHold === 'hold') {
      await fs.writeFile(startedMarker, 'started');
      await waitForFile(releaseMarker);
    }
  },
  extract: async (_archivePath, { dir }) => {
    await fs.writeFile(path.join(dir, 'lynxtron'), 'synthetic executable');
  },
});

console.log(JSON.stringify(result));
