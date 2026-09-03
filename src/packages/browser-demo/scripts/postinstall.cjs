const fs = require('fs');
const path = require('path');

async function exists(p) {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else if (e.isSymbolicLink()) {
      const link = await fs.promises.readlink(s);
      try {
        await fs.promises.symlink(link, d);
      } catch {
        try {
          await fs.promises.unlink(d);
        } catch {}
        await fs.promises.symlink(link, d);
      }
    } else {
      await fs.promises.copyFile(s, d);
    }
  }
}

async function main() {
  const platform = process.platform;
  if (platform !== 'darwin') {
    console.log('skip frameworks sync: non-darwin platform');
    return;
  }
  const arch = process.arch;
  const cwd = process.cwd();
  const cefWebviewRoot = path.dirname(
    require.resolve('@lynx-js/cef-webview/package.json', { paths: [cwd] })
  );
  const lynxtronRoot = path.dirname(
    require.resolve('@lynx-js/lynxtron/package.json', { paths: [cwd] })
  );
  const src = path.join(cefWebviewRoot, 'dist', 'darwin', arch, 'frameworks');
  const destinations = [
    path.join(lynxtronRoot, 'dist', 'Lynxtron.app', 'Contents', 'Frameworks'),
    path.join(
      lynxtronRoot,
      'dist',
      'devtool',
      'Lynxtron.app',
      'Contents',
      'Frameworks'
    ),
    path.join(
      lynxtronRoot,
      'dist',
      'release',
      'Lynxtron.app',
      'Contents',
      'Frameworks'
    ),
    path.join(
      lynxtronRoot,
      'dist',
      'darwin',
      arch,
      'lynxtron.app',
      'Contents',
      'Frameworks'
    ),
  ];
  const srcExists = await exists(src);
  if (!srcExists) {
    console.log('skip frameworks sync: src missing');
    return;
  }

  const existingDestinations = [];
  for (const dest of destinations) {
    if (await exists(path.dirname(path.dirname(dest)))) {
      existingDestinations.push(dest);
    }
  }
  if (existingDestinations.length === 0) {
    console.log('skip frameworks sync: Lynxtron runtime missing');
    return;
  }

  for (const dest of existingDestinations) {
    await copyDir(src, dest);
  }
  console.log(
    `frameworks synced to ${existingDestinations.length} Lynxtron runtime(s)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 0;
});
