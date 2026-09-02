# Lynxtron Shell Demo

## 技术栈

- `lynx`
- `lynxtron`
- `Typscript`
- `React`
- `Rspeedy` + `Rsbuild` + `Electron-Builder`（构建与应用打包）

## 特性

/* WEB_SUPPORT_START */
- 同一套 UI 代码可运行在桌面端、Web 端和 Mobile 端（NativeScript + 原生 LynxView）
/* WEB_SUPPORT_END */
- 一键运行、调试、打包
- 支持类型增强语言 Typescript
- 完善的工程化体验
- 支持通过 `electron-builder` 打包为各平台应用

## 环境准备

- NodeJS >= 22.18.0
- TypeScript
- [LynxDevTool](https://github.com/lynx-family/lynx-devtool/releases/) >= 0.1.1

## 使用指南

### 安装依赖

```bash
npm install
npm run install:mobile
```

### 开发模式

- **桌面端 (Desktop)**
  ```bash
  npm run dev
  ```

/* WEB_SUPPORT_START */
- **Web 端 (Browser)**
  ```bash
  npm run dev:web
  ```
/* WEB_SUPPORT_END */

- **Mobile 端（Android 模拟器）**

  ```bash
  export JAVA_HOME=/path/to/jdk-21
  export ANDROID_HOME=/path/to/android-sdk
  npm run start:mobile
  ```

### 构建与启动

- **构建桌面端**

  ```bash
  npm run build
  ```

- **启动桌面端**
  ```bash
  npm start
  ```

/* WEB_SUPPORT_START */
- **构建 Web 端**
  ```bash
  npm run build:web
  ```

- **启动 Web 端**
  ```bash
  npm run start:web
  ```
/* WEB_SUPPORT_END */

- **构建 Mobile Android**

  ```bash
  npm run build:mobile
  ```

  前端命令只构建 Lynx bundle 和 Android 应用，并复用本地已经构建好的
  Mobile Runtime；这与桌面前端复用 Lynxtron Runtime、而不重新编译它一致。

- **从 Lynx 源码构建 Mobile Runtime**

  首次同步 Lynx 后或 Lynx 源码版本变化时执行：

  ```bash
  export LYNX_JAVA_HOME=/path/to/jdk-11
  export ANDROID_HOME=/path/to/android-sdk
  npm run build:mobile-runtime
  ```

  Runtime 命令直接从 `src/dependencies/DEPS.lynx` 锁定的源码构建 Lynx
  Android AAR，不依赖已发布的 Lynx Android SDK。当前 P0 暂时把
  `nodejs.echo` 映射为 Android 原生模块；preload 接入后再替换为同 isolate
  的 NativeScript BTS Worker。

### 应用打包

- **打包桌面应用**

  ```bash
  npm run pack
  ```
