# Lynxtron Shell Demo

## Tech Stack

- `lynx`
- `lynxtron`
- `TypeScript`
- `React`
- `Rspeedy` + `Rsbuild` + `Electron-Builder` (bundling and application packaging)

## Features

/* WEB_SUPPORT_START */
- **Symmetric Host**: Identical UI code runs on Desktop (Node.js), Web (Browser), and Mobile (NativeScript + native LynxView).
/* WEB_SUPPORT_END */
- **Background Thread Injection**: `NativeModules.nodejs` provides high-performance background logic without blocking UI.
- One-click run, debug, and package.
- Supports TypeScript for type safety.

## Prerequisites

- NodeJS >= 22.18.0
- [LynxDevTool](https://github.com/lynx-family/lynx-devtool/releases/) >= 0.1.1

## Usage Guide

### Install Dependencies

```bash
npm install
npm run install:mobile
```

### Development

- **Desktop (Lynxtron)**
  ```bash
  npm run dev
  ```

/* WEB_SUPPORT_START */
- **Web (Browser)**
  ```bash
  npm run dev:web
  ```
/* WEB_SUPPORT_END */

- **Mobile (Android emulator)**

  ```bash
  export JAVA_HOME=/path/to/jdk-21
  export ANDROID_HOME=/path/to/android-sdk
  npm run start:mobile
  ```

### Build & Start

- **Build Desktop**

  ```bash
  npm run build
  ```

- **Start Desktop**
  ```bash
  npm start
  ```

/* WEB_SUPPORT_START */
- **Build Web**
  ```bash
  npm run build:web
  ```

- **Start Web**
  ```bash
  npm run start:web
  ```
/* WEB_SUPPORT_END */

- **Build Mobile Android**

  ```bash
  npm run build:mobile
  ```

  The frontend commands only build the Lynx bundle and Android application. They
  reuse the locally built mobile runtime, just as the desktop frontend reuses the
  Lynxtron runtime instead of rebuilding it.

- **Build Mobile Runtime from Lynx Source**

  Run this once after syncing Lynx, or whenever its source revision changes:

  ```bash
  export LYNX_JAVA_HOME=/path/to/jdk-11
  export ANDROID_HOME=/path/to/android-sdk
  npm run build:mobile-runtime
  ```

  The runtime command builds Lynx Android AARs directly from the revision pinned
  by `src/dependencies/DEPS.lynx`; it does not consume a published Lynx Android
  SDK. The current P0 maps `nodejs.echo` to an Android native module. It will move
  to the same-isolate NativeScript BTS Worker when preload support lands.

### Application Packaging

- **Package Desktop Application**

  ```bash
  npm run pack
  ```
