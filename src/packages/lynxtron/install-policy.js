export const POSTINSTALL_RUNTIME_VARIANT = 'devtool';

export function getPostinstallRuntimeOptions(env = process.env) {
  return {
    variant: POSTINSTALL_RUNTIME_VARIANT,
    customUrl:
      env.LYNXTRON_BINARY_URL ||
      env.npm_config_custom_lynxtron_binary_url,
    force: Boolean(env.npm_config_force_download),
  };
}
