const path = require('node:path');
const { normalizeRuntimeVariant } = require('./runtime-artifacts.cjs');

const packageRoot = __dirname;
const distRoot = path.join(packageRoot, 'dist');

function platformExecutableName() {
  if (process.platform === 'win32') {
    return 'lynxtron.exe';
  }

  if (process.platform === 'darwin') {
    return path.join('lynxtron.app', 'Contents', 'MacOS', 'lynxtron');
  }

  throw new Error(
    `lynxtron builds are not available on platform: ${process.platform}`
  );
}

function getRuntimeRoot(variant = 'devtool') {
  return path.join(distRoot, normalizeRuntimeVariant(variant));
}

function getExecutablePath(variant = 'devtool') {
  return path.join(getRuntimeRoot(variant), platformExecutableName());
}

const executablePath = getExecutablePath();

const dllPath =
  process.platform === 'win32'
    ? path.join(getRuntimeRoot(), 'lynxtron.dll')
    : undefined;

const importLibraryPath =
  process.platform === 'win32'
    ? path.join(getRuntimeRoot(), 'lynxtron.dll.lib')
    : undefined;

module.exports = {
  packageRoot,
  distRoot,
  getRuntimeRoot,
  getExecutablePath,
  executablePath,
  dllPath,
  importLibraryPath,
};
