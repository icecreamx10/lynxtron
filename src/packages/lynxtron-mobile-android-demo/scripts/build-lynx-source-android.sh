#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
demo_dir="$(cd -- "${script_dir}/.." && pwd)"
repo_root="$(cd -- "${demo_dir}/../../.." && pwd)"
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

lynx_java_home="${LYNX_JAVA_HOME:-}"
if [[ -z "${lynx_java_home}" || ! -x "${lynx_java_home}/bin/java" ]]; then
  echo "LYNX_JAVA_HOME must point to JDK 11 for the Lynx Gradle 6.7 build." >&2
  exit 1
fi

java_major="$(${lynx_java_home}/bin/java -version 2>&1 | sed -n '1s/.*version "\([0-9][0-9]*\).*/\1/p')"
if [[ "${java_major}" != "11" ]]; then
  echo "Lynx Android source build requires JDK 11; LYNX_JAVA_HOME is JDK ${java_major:-unknown}." >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "ANDROID_HOME must point to an Android SDK." >&2
  exit 1
fi

for required_path in \
  "ndk/21.1.6352462" \
  "platforms/android-33" \
  "build-tools/33.0.1" \
  "cmake/3.18.1"; do
  if [[ ! -e "${ANDROID_HOME}/${required_path}" ]]; then
    echo "Missing Android SDK component: ${required_path}" >&2
    exit 1
  fi
done

export GRADLE_USER_HOME="${LYNX_GRADLE_USER_HOME:-${HOME}/.cache/lynxtron/gradle-lynx}"
export PYENV_VERSION="${PYENV_VERSION:-3.9.25}"

(
  cd "${lynx_root}/platform/android"
  JAVA_HOME="${lynx_java_home}" ./gradlew \
    :LynxAndroid:assembleNoasanRelease \
    :LynxBase:assembleNoasanRelease \
    :LynxGfx:assembleNoasanRelease \
    :LynxTrace:assembleNoasanRelease \
    :LynxJSSDK:assembleNoasanRelease \
    :ServiceAPI:assembleNoasanRelease \
    :lynx_service_image:assembleRelease \
    --no-daemon \
    -Dorg.gradle.jvmargs="-Xmx4096m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8"
)

bundle_path="$(find "${lynx_root}/node_modules/.pnpm" \
  -path '*/@lynx-example+view@*/node_modules/@lynx-example/view/dist/main.lynx.bundle' \
  -print -quit)"
if [[ -z "${bundle_path}" ]]; then
  echo "Pinned Lynx example bundle was not found under ${lynx_root}/node_modules." >&2
  exit 1
fi

asset_dir="${demo_dir}/App_Resources/Android/src/main/assets"
mkdir -p "${asset_dir}"
cp "${bundle_path}" "${asset_dir}/main.lynx.bundle"

echo "Prepared Lynx Android from source revision ${pinned_revision}."
