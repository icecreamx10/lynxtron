import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const platform = process.env.npm_config_platform || process.platform;
const arch = process.env.npm_config_arch || process.arch;
const buildRoot = path.join(packageRoot, 'build');
const outputRoot = path.join(packageRoot, 'dist', platform, arch);

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });
await fs.copyFile(
  path.join(buildRoot, 'Release', 'cef_extension.node'),
  path.join(outputRoot, 'cef_extension.node')
);

if (platform === 'darwin') {
  await fs.cp(
    path.join(buildRoot, 'frameworks', 'Contents', 'Frameworks'),
    path.join(outputRoot, 'frameworks'),
    { recursive: true, force: true, verbatimSymlinks: true }
  );
}

console.log(`staged cef-webview build at ${outputRoot}`);
