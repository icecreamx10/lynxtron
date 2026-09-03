#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="${LYNXTRON_REPO_ROOT:-$(git -C "${script_dir}" rev-parse --show-toplevel)}"
lynx_root="${LYNX_SOURCE_ROOT:-${repo_root}/lynx}"
deps_file="${repo_root}/src/dependencies/DEPS.lynx"

pinned_revision="$({ sed -n "s/.*'commit': '\([^']*\)'.*/\1/p" "${deps_file}" || true; } | head -n 1)"
if [[ -z "${pinned_revision}" ]]; then
  echo "Unable to read the pinned Lynx revision from ${deps_file}" >&2
  exit 1
fi

if [[ ! -d "${lynx_root}/.git" ]]; then
  echo "Lynx source is missing at ${lynx_root}." >&2
  echo "Sync the Lynxtron dependencies from src/dependencies/DEPS.lynx first." >&2
  exit 1
fi

actual_revision="$(git -C "${lynx_root}" rev-parse HEAD)"
if [[ "${actual_revision}" != "${pinned_revision}" ]]; then
  echo "Lynx source revision mismatch." >&2
  echo "Expected: ${pinned_revision}" >&2
  echo "Actual:   ${actual_revision}" >&2
  exit 1
fi

ios_source_patch="${script_dir}/lynx-ios-source.patch"
if git -C "${lynx_root}" apply --reverse --check "${ios_source_patch}" >/dev/null 2>&1; then
  echo "Lynx iOS source patch is already applied."
elif git -C "${lynx_root}" apply --check "${ios_source_patch}"; then
  git -C "${lynx_root}" apply "${ios_source_patch}"
  echo "Applied Lynx iOS source patch."
else
  echo "Lynx iOS source patch does not apply cleanly to ${pinned_revision}." >&2
  exit 1
fi

export PYENV_VERSION="${PYENV_VERSION:-3.9.25}"

(
  cd "${lynx_root}"
  # Lynx's environment setup supplies depot_tools and the Python packages used
  # by the official GN-to-CocoaPods generator.
  source tools/envsetup.sh
  python3 tools/ios_tools/generate_podspec_scripts_by_gn.py --root "${lynx_root}"
)

for podspec in Lynx.podspec LynxBase.podspec LynxService.podspec LynxServiceAPI.podspec; do
  if [[ ! -s "${lynx_root}/${podspec}" ]]; then
    echo "Lynx iOS source preparation did not produce ${podspec}." >&2
    exit 1
  fi
done

echo "Prepared Lynx iOS source pods from revision ${pinned_revision}."
