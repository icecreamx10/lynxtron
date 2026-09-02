function resolveArchitecture(args, arch, defaultArch) {
  if (arch) {
    return arch.replace('--', '');
  }
  if (args.includes('--x64')) return 'x64';
  if (args.includes('--arm64')) return 'arm64';
  if (args.includes('--ia32')) return 'ia32';
  return defaultArch;
}

function resolveTargetPlatform(args, defaultPlatform) {
  if (args.includes('--mac') || args.includes('-m') || args.includes('--mas')) {
    return 'darwin';
  }
  if (args.includes('--win') || args.includes('-w')) {
    return 'win32';
  }
  if (args.includes('--linux') || args.includes('-l')) {
    return 'linux';
  }
  return defaultPlatform;
}

function sanitizeBuilderConfig(config) {
  const sanitizedConfig = { ...config };
  delete sanitizedConfig.lynxtron;
  return sanitizedConfig;
}

function prepareUniversalPackaging({ config, configPath, outAppPath }) {
  return {
    config: sanitizeBuilderConfig(config),
    args: ['-c', configPath, '--mac', '--prepackaged', outAppPath, '--universal'],
  };
}

function prepareRuntimeConfig({
  config,
  args,
  env,
  arch,
  platform,
  defaultArch,
  lynxtronVersion,
  runtimeArtifacts,
}) {
  const { cliVariant, forwardedArgs } = runtimeArtifacts.parseRuntimeArguments(args);
  const configVariant = config.lynxtron && config.lynxtron.runtimeVariant;
  const variant = runtimeArtifacts.resolveRuntimeVariant({
    cliVariant,
    envVariant: env.LYNXTRON_RUNTIME_VARIANT,
    configVariant,
    defaultVariant: 'release',
  });

  delete config.lynxtron;

  if (!config.electronDownload) {
    const effectiveVersion = config.electronVersion || lynxtronVersion;
    if (!config.electronVersion) {
      config.electronVersion = effectiveVersion;
    }
    const resolvedArch = resolveArchitecture(forwardedArgs, arch, defaultArch);
    const resolvedPlatform = resolveTargetPlatform(forwardedArgs, platform);
    config.electronDownload = {
      version: effectiveVersion,
      mirror: '',
      customDir: `v${effectiveVersion}`,
      customFilename: runtimeArtifacts.getRuntimeArtifactFilename({
        version: effectiveVersion,
        platform: resolvedPlatform,
        arch: resolvedArch,
        variant,
        mas: forwardedArgs.includes('--mas'),
      }),
    };
  }

  return { config, forwardedArgs, variant };
}

module.exports = {
  prepareRuntimeConfig,
  prepareUniversalPackaging,
  resolveArchitecture,
  resolveTargetPlatform,
  sanitizeBuilderConfig,
};
