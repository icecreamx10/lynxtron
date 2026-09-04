import { getPostinstallRuntimeOptions } from './install-policy.js';
import { ensureRuntime } from './runtime-manager.js';

const options = getPostinstallRuntimeOptions();
await ensureRuntime(options);
