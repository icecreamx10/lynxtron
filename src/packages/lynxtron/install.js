import { getPostinstallRuntimeOptions } from './install-policy.js';
import { ensureRuntime } from './runtime-manager.js';
import { BASE_URL } from './utils/env-config.js';

const options = getPostinstallRuntimeOptions();
const { customUrl } = options;
if (!customUrl && !BASE_URL) {
  console.log('Lynxtron base URL is empty; skipping runtime download');
} else {
  await ensureRuntime(options);
}
