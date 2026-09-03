const fs = require('node:fs');
const path = require('node:path');

const AUTOLINK_NATIVE_DIR = path.join('.lynxtron', 'native');

function prepareAutoLinkPackaging({ config, projectRoot, platform, arch }) {
  const appDirectory = resolveAppDirectory(config, projectRoot);
  const libraries = discoverAutoLinkLibraries({
    appDirectory,
    platform,
    arch,
  });

  if (libraries.length === 0) {
    return { config, libraries, appDirectory };
  }

  if (config.files === undefined) {
    config.files = ['**/*'];
  }
  appendUnique(
    config,
    'files',
    toPosix(path.join(AUTOLINK_NATIVE_DIR, '**/*'))
  );
  if (config.asar !== false) {
    appendUnique(
      config,
      'asarUnpack',
      toPosix(path.join(AUTOLINK_NATIVE_DIR, '**/*'))
    );
  }

  if (platform === 'darwin') {
    for (const library of libraries) {
      for (const framework of library.frameworks) {
        const relativeFrameworkPath = toPosix(
          path.relative(appDirectory, framework.absolutePath)
        );
        appendUnique(config, 'files', `!${relativeFrameworkPath}`);
        appendUnique(config, 'files', `!${relativeFrameworkPath}/**/*`);
        appendUniqueFileSet(config, 'extraFiles', {
          from: framework.absolutePath,
          to: 'Frameworks',
          filter: ['**/*'],
        });
      }
    }
  }

  return { config, libraries, appDirectory };
}

function discoverAutoLinkLibraries({ appDirectory, platform, arch }) {
  const nodeModulesDirectory = path.join(
    appDirectory,
    AUTOLINK_NATIVE_DIR,
    'node_modules'
  );
  if (!fs.existsSync(nodeModulesDirectory)) {
    return [];
  }

  const libraries = [];
  for (const packageRoot of listPackageRoots(nodeModulesDirectory)) {
    const manifestPath = path.join(packageRoot, 'lynx.lib.json');
    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const lynxtron = manifest?.platforms?.lynxtron;
    if (!lynxtron || typeof lynxtron !== 'object') {
      continue;
    }

    const targets = Array.isArray(lynxtron.targets)
      ? lynxtron.targets.filter(
          (entry) => entry?.os === platform && entry?.arch === arch
        )
      : [];
    if (targets.length === 0) {
      throw new Error(
        `${manifestPath} has no Lynxtron target for ${platform}/${arch}`
      );
    }
    if (targets.length > 1) {
      throw new Error(
        `${manifestPath} has duplicate Lynxtron targets for ${platform}/${arch}`
      );
    }
    const target = targets[0];

    const binaries = resolveArtifactPaths({
      paths: target.binaries,
      packageRoot,
      platform,
      arch,
      field: 'binaries',
      manifestPath,
    });
    const frameworks = resolveArtifactPaths({
      paths: target.frameworks,
      packageRoot,
      platform,
      arch,
      field: 'frameworks',
      manifestPath,
    });

    if (binaries.length === 0 && frameworks.length === 0) {
      throw new Error(
        `${manifestPath} has no Lynxtron artifacts for ${platform}/${arch}`
      );
    }

    libraries.push({ packageRoot, manifestPath, binaries, frameworks });
  }
  return libraries;
}

function listPackageRoots(nodeModulesDirectory) {
  const roots = [];
  for (const entry of fs.readdirSync(nodeModulesDirectory, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    const entryPath = path.join(nodeModulesDirectory, entry.name);
    if (!entry.name.startsWith('@')) {
      roots.push(entryPath);
      continue;
    }
    for (const scopedEntry of fs.readdirSync(entryPath, {
      withFileTypes: true,
    })) {
      if (scopedEntry.isDirectory() || scopedEntry.isSymbolicLink()) {
        roots.push(path.join(entryPath, scopedEntry.name));
      }
    }
  }
  return roots;
}

function resolveArtifactPaths({
  paths,
  packageRoot,
  platform,
  arch,
  field,
  manifestPath,
}) {
  if (paths === undefined) {
    return [];
  }
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error(`${manifestPath} has an invalid ${field} declaration`);
  }

  return paths.map((artifactPath) => {
    if (typeof artifactPath !== 'string' || artifactPath.length === 0) {
      throw new Error(`${manifestPath} has an invalid ${field} path`);
    }
    const absolutePath = path.resolve(packageRoot, artifactPath);
    if (!isInside(packageRoot, absolutePath)) {
      throw new Error(
        `${manifestPath} ${field} path escapes its package: ${artifactPath}`
      );
    }
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `${manifestPath} ${field} path does not exist for ${platform}/${arch}: ${artifactPath}`
      );
    }
    return { path: artifactPath, absolutePath };
  });
}

function resolveAppDirectory(config, projectRoot) {
  const configuredAppDirectory = config.directories?.app;
  return configuredAppDirectory
    ? path.resolve(projectRoot, configuredAppDirectory)
    : projectRoot;
}

function appendUnique(config, field, value) {
  const existing = config[field];
  const values =
    existing === undefined
      ? []
      : Array.isArray(existing)
      ? existing
      : [existing];
  if (!values.some((item) => item === value)) {
    values.push(value);
  }
  config[field] = values;
}

function appendUniqueFileSet(config, field, value) {
  const existing = config[field];
  const values =
    existing === undefined
      ? []
      : Array.isArray(existing)
      ? existing
      : [existing];
  if (
    !values.some(
      (item) =>
        item &&
        typeof item === 'object' &&
        item.from === value.from &&
        item.to === value.to
    )
  ) {
    values.push(value);
  }
  config[field] = values;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

module.exports = {
  AUTOLINK_NATIVE_DIR,
  discoverAutoLinkLibraries,
  prepareAutoLinkPackaging,
  resolveAppDirectory,
};
