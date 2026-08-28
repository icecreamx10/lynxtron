# Lynxtron Mobile Android demo

This NativeScript app embeds a real Android `LynxView` and adapts it to the
P0 `LynxWindow` JavaScript contract.

The app does not consume a released Lynx Android SDK. The preparation script
verifies the revision pinned by `src/dependencies/DEPS.lynx`, builds the seven
required Android AARs from that checkout, and makes the NativeScript Gradle
project depend directly on those build outputs. This includes the Lynx image
service used by the example bundle.

## Build

The pinned Lynx Android source build currently requires JDK 11, while the
NativeScript Android build uses JDK 21. It also requires Android NDK
`21.1.6352462`, Android platform 33, Build Tools 33.0.1, and CMake 3.18.1.

```bash
export LYNX_JAVA_HOME=/path/to/jdk-11/Contents/Home
export JAVA_HOME=/path/to/jdk-21/Contents/Home
export ANDROID_HOME=/path/to/android-sdk

npm run android
```

`LYNX_SOURCE_ROOT` may override the default source checkout at the repository
root. `LYNX_GRADLE_USER_HOME` may override the isolated Gradle cache used for
the source build.
