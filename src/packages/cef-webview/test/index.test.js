import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const entrySource = fs.readFileSync(
  path.resolve(__dirname, '../index.cjs'),
  'utf8'
);
const cmakeSource = fs.readFileSync(
  path.resolve(__dirname, '../CMakeLists.txt'),
  'utf8'
);
const stageBuildSource = fs.readFileSync(
  path.resolve(__dirname, '../scripts/stage-build.js'),
  'utf8'
);

function loadEntry({ platform, arch, manifest }) {
  const module = { exports: {} };
  const loadedPaths = [];
  const context = {
    __dirname: platform === 'win32' ? 'C:\\cef-webview' : '/cef-webview',
    module,
    exports: module.exports,
    process: { platform, arch, env: { PATH: 'C:\\Windows\\System32' } },
    require(specifier) {
      if (specifier === 'path') {
        return platform === 'win32' ? path.win32 : path.posix;
      }
      if (specifier === './lynx.lib.json') {
        return manifest;
      }
      loadedPaths.push(specifier);
      return {
        initialize(options) {
          return { options, platform, arch };
        },
      };
    },
  };

  vm.runInNewContext(entrySource, context, { filename: 'index.cjs' });
  return { entry: module.exports, loadedPaths, process: context.process };
}

test('loads the Windows x64 binary selected by lynx.lib.json', () => {
  const { entry, loadedPaths, process } = loadEntry({
    platform: 'win32',
    arch: 'x64',
    manifest: {
      platforms: {
        lynxtron: {
          targets: [
            {
              os: 'darwin',
              arch: 'arm64',
              binaries: ['dist/darwin/arm64/cef_extension.node'],
            },
            {
              os: 'win32',
              arch: 'x64',
              binaries: ['dist/win32/x64/cef_extension.node'],
            },
          ],
        },
      },
    },
  });

  assert.deepEqual(loadedPaths, [
    'C:\\cef-webview\\dist\\win32\\x64\\cef_extension.node',
  ]);
  assert.equal(
    process.env.PATH,
    'C:\\cef-webview\\dist\\win32\\x64;C:\\Windows\\System32'
  );
  assert.deepEqual(entry.initialize({ cachePath: 'cache' }), {
    options: { cachePath: 'cache' },
    platform: 'win32',
    arch: 'x64',
  });
});

test('fails clearly when the installed package has no matching binary', () => {
  assert.throws(
    () =>
      loadEntry({
        platform: 'win32',
        arch: 'x64',
        manifest: {
          platforms: {
            lynxtron: {
              targets: [
                {
                  os: 'darwin',
                  arch: 'arm64',
                  binaries: ['dist/darwin/arm64/cef_extension.node'],
                },
              ],
            },
          },
        },
      }),
    /does not provide a binary for win32\/x64/
  );
});

test('Windows builds use the published Lynxtron import library and stage the CEF runtime', () => {
  assert.match(cmakeSource, /out\/Release\/lynxtron\.dll\.lib/);
  assert.match(cmakeSource, /dist\/devtool\/lynxtron\.dll\.lib/);
  assert.doesNotMatch(cmakeSource, /lxtn\.dll\.lib/);
  assert.match(stageBuildSource, /'libcef\.dll'/);
  assert.match(stageBuildSource, /'resources\.pak'/);
  assert.match(stageBuildSource, /path\.join\(releaseRoot, 'locales'\)/);
});
