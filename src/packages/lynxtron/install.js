import { getPostinstallRuntimeOptions, shouldSkipPostinstallRuntime } from './install-policy.js';
import { ensureRuntime } from './runtime-manager.js';
import { BASE_URL, RUNTIME_DISTRIBUTION } from './utils/env-config.js';

if (shouldSkipPostinstallRuntime()) {
  console.log('Skipping Lynxtron runtime download for source build');
  process.exit(0);
}

const options = getPostinstallRuntimeOptions();
const { customUrl } = options;
if (!customUrl && RUNTIME_DISTRIBUTION !== 'npm' && !BASE_URL) {
  console.log('Source checkout; skipping runtime installation');
} else {
  await ensureRuntime({ ...options, allowFetch: false });
}
