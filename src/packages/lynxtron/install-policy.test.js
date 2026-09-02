import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POSTINSTALL_RUNTIME_VARIANT,
  getPostinstallRuntimeOptions,
} from './install-policy.js';

test('npm postinstall always installs the DevTool runtime', () => {
  assert.equal(POSTINSTALL_RUNTIME_VARIANT, 'devtool');
  assert.deepEqual(
    getPostinstallRuntimeOptions({
      LYNXTRON_RUNTIME_VARIANT: 'release',
      LYNXTRON_BINARY_URL: 'https://downloads.example.test/devtool.zip',
      npm_config_force_download: 'true',
    }),
    {
      variant: 'devtool',
      customUrl: 'https://downloads.example.test/devtool.zip',
      force: true,
    }
  );
});
