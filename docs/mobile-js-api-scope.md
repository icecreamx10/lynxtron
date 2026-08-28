# Lynxtron Mobile JS 接口复刻范围

> 目标：只复刻 Lynxtron 的 Lynx 宿主能力，不复刻完整 Electron API，也不重复封装 NativeScript 已有能力。

P0 JS MVP 已落在 [`src/packages/lynxtron-mobile`](../src/packages/lynxtron-mobile/README.md)。当前包含可执行、可测试的 JS contract 和 native adapter ABI；Android demo 已从 `DEPS.lynx` 锁定的 Lynx 源码构建 AAR，并通过 NativeScript Java 互操作接入真实 `LynxView`。iOS 与 NativeScript Worker isolate 的原生接入尚待实现。

## 1. 范围原则

Mobile API 分成五类：

| 标记   | 策略                      | 含义                                                    |
| ------ | ------------------------- | ------------------------------------------------------- |
| P0     | 首版复刻                  | PC/Mobile 语义基本一致，是 Lynx 页面运行闭环所必需      |
| P1     | 第二阶段适配              | 有价值，但需要移动端语义调整或依赖 Lynx Mobile SDK 能力 |
| NS     | 直接使用 NativeScript     | 不在 Lynxtron 中重复封装                                |
| Plugin | Preload capability plugin | 只给 BTS/MTS 页面能力使用，不加入 Main 核心包           |
| X      | 不复刻                    | 桌面操作系统专属，Mobile 不提供空实现                   |

复刻的判断标准不是“PC 上存在这个名字”，而是：

1. 是否属于 LynxView、Lynx Runtime 或 Lynx 页面生命周期。
2. Android/iOS 上是否存在清晰且稳定的对偶语义。
3. NativeScript 是否已经提供更自然的 API。
4. 是否必须进入 Lynxtron core；否则应作为 capability plugin。

### 1.1 当前 PC 出口盘点

当前 `lynxtron.js` 的实际运行时出口可先归为：

| 当前出口                                                                | Mobile 结论                                        |
| ----------------------------------------------------------------------- | -------------------------------------------------- |
| `LynxWindow`                                                            | P0，保留 Lynx 内容接口和 Mobile 生命周期子集       |
| `LynxTemplateData`、`LynxUpdateMeta`                                    | P0                                                 |
| `protocol`                                                              | P0                                                 |
| `lynxBridge`                                                            | P1；优先改成每 Window handler                      |
| `devtool`                                                               | P1                                                 |
| `registerGlobalEnvModule`、`lynx`                                       | P1；重构成 Lynx plugin registry                    |
| `app`                                                                   | P1 兼容 facade；P0 直接用 NativeScript Application |
| `clipboard`、`shell`、`dialog`、`screen`、`nativeImage`、`powerMonitor` | NS 或 capability plugin                            |
| `Menu`、`MenuItem`、`Tray`、`Dock`、`CommandLine`                       | X                                                  |
| `Archive`、`splitPath`                                                  | X                                                  |
| `getVar`、`hasVar`、`setVar`                                            | X；使用 Mobile 构建/应用配置                       |

另外，类型入口目前还声明了 Notification、TouchBar、UtilityProcess 等更多 Electron 风格 API，但 `lynxtron.js` 没有逐项导出它们。Mobile 范围以明确的 Mobile 契约为准，不直接复制这份宽泛的声明文件。

`LynxTemplateBundle` 已有 C++ 实现和类型声明，但当前 `lynxtron.js` 没有显式导出；Mobile P0 应把它作为正式运行时出口，同时建议 PC 修正这一不一致。

## 2. 建议的 Mobile 包入口

P0 MVP 使用独立 NativeScript 插件包 `@lynx-js/lynxtron-mobile`，避免加载 PC Node binding：

```text
@lynx-js/lynxtron-mobile
  Main Realm：LynxWindow、模板数据、资源加载、调试

@lynx-js/lynxtron-mobile/context-bridge
  BTS Worker Realm：exposeInLynxBTS

@lynx-js/lynxtron-mobile/worker-runtime
  BTS Worker 启动、preload plugin 装载与销毁

@lynx-js/lynxtron-mobile/native-adapter
  NativeScript/N-API 平台插件实现边界

@lynx-js/lynxtron-mobile/mts                 # P1 规划
  MTS Realm：exposeInLynxMTS、UI-safe host bindings

@lynx-js/lynxtron-mobile/lynx                # P1 规划
  Lynx 页面类型：NativeModules.lynxtron、NativeModules.bridge
```

Mobile 包不能加载 PC Node binding，也不应把 Electron 类型整体导入 NativeScript 项目。

## 3. P0：Main Realm 核心接口

### 3.1 `LynxWindow`

`LynxWindow` 是首版最主要的复刻对象。Mobile 中它是 N-API-backed 的 Lynx 页面容器，不继承完整桌面 `BaseWindow`。

#### 构造和查询

| 接口                            | 策略 | Mobile 语义                                                 |
| ------------------------------- | ---- | ----------------------------------------------------------- |
| `new LynxWindow(options)`       | P0   | 创建 Native 页面容器、`LynxView`、MTS Runtime 和 BTS Worker |
| `LynxWindow.fromId(id)`         | P0   | 查询仍存活的页面容器                                        |
| `LynxWindow.getAllWindows()`    | P0   | 返回全部未销毁的页面容器                                    |
| `LynxWindow.getFocusedWindow()` | P1   | 返回当前 active/topmost 页面；“focused”是兼容名称           |
| `window.id`                     | P0   | 生命周期内稳定，销毁后仍可读取                              |

建议的首版构造类型：

```ts
interface LynxWindowConstructorOptions {
  show?: boolean;
  parent?: LynxWindow;
  title?: string;
  lynxPreference?: LynxPreference;
  mobile?: {
    presentation?: 'embedded' | 'push' | 'modal';
    container?: unknown;
    android?: Record<string, unknown>;
    ios?: Record<string, unknown>;
  };
}

interface LynxPreference {
  /** PC 兼容的文件型 BTS preload。 */
  preload?: string | string[];

  /** Mobile 推荐的 NativeScript preload capability plugins。 */
  preloads?: Array<
    | string
    | {
        plugin: string;
        options?: Record<string, unknown>;
      }
  >;

  /** 低层 MTS preload 入口，通常由插件清单生成。 */
  mainThreadPreload?: string | string[];
}
```

首版不接收桌面的 `x/y/minWidth/maxWidth/frame/transparent/resizable/minimizable` 等选项。

#### Lynx 内容接口

这些接口按现有名称和主要行为复刻：

```ts
interface LynxContentHost {
  loadFile(path: string, options?: LoadOptions): boolean;
  loadURL(url: string, options?: LoadOptions): boolean;
  loadBundle(bundle: LynxTemplateBundle, options?: LoadOptions): boolean;
  updateMetaData(meta: LynxUpdateMeta): boolean;
  setGlobalProps(globalProps: object): boolean;
  sendGlobalEvent(eventName: string, ...args: unknown[]): boolean;
}

interface LoadOptions {
  data?: object;
  globalProps?: object;
}
```

与 PC 一致，`boolean` 只表示请求是否被同步接受；最终结果通过加载事件报告。

`loadFile` 的 Mobile 路径至少区分：

- 应用 bundle/resource 内文件。
- App 私有数据目录文件。
- 明确的 `file://` URL。

不继承 PC 的 ASAR 路径语义。

#### 容器生命周期接口

| 接口                    | 策略 | 说明                                                |
| ----------------------- | ---- | --------------------------------------------------- |
| `show()`                | P0   | attach/push/present，具体方式由 `presentation` 决定 |
| `hide()`                | P0   | 进入不可见状态并通知 Lynx background                |
| `close()`               | P0   | 可取消的关闭请求                                    |
| `destroy()`             | P0   | 强制、幂等地销毁 View、MTS、BTS Worker              |
| `isDestroyed()`         | P0   | 是否已销毁                                          |
| `isVisible()`           | P0   | 页面容器当前是否可见                                |
| `focus()`               | P1   | 激活/置顶页面；只提供可定义的导航语义               |
| `blur()`                | P1   | 取消 active 状态，不保证等价于桌面键盘焦点          |
| `getBounds()/getSize()` | P1   | 返回当前 layout 尺寸，只读                          |
| `setBounds()/setSize()` | X    | Mobile 布局由 NativeScript/原生容器负责             |

#### 事件

首版建议公开：

```ts
interface LynxWindowEventMap {
  show: [];
  hide: [];
  close: [event: CancelableEvent];
  closed: [];
  focus: [];
  blur: [];
  resize: [size: Size];

  'ready-to-show': [];
  'on-first-screen': [];
  '--lynx-error': [code: number, message: string];
  'frame-timings': [timings: unknown];

  foreground: [];
  background: [];

  '-lynx-invoke': [
    event: LynxBridgeInvokeEvent,
    method: string,
    params: unknown
  ];
  '-lynx-message': [method: string, params: unknown];
}
```

其中 `-lynx-invoke`、`-lynx-message` 保留当前兼容性，但前导 `-` 表示它们仍属于低层事件。业务更推荐使用 `window.bridge` 或 `lynxBridge`。

不复刻的桌面 Window 事件包括：maximize、minimize、restore、move、moved、enter/leave-full-screen、sheet、window tab、system-context-menu 和 always-on-top。

### 3.2 内部 `LynxView` 与公共 API 边界

Android/iOS 的 native `LynxView` 是 `LynxWindow` 的内部渲染对象，不作为 Mobile P0 的第二套 JS API。Android MVP 直接使用 Lynxtron 锁定的 Lynx 源码构建产物，不依赖已发布的 Lynx Android SDK：

```text
JS LynxWindow（唯一公共页面对象）
└── N-API LynxWindowHost
    ├── Native 页面容器
    ├── Native LynxView（内部实现）
    ├── MTS Runtime
    └── BTS NativeScript Worker
```

`loadFile/loadURL/loadBundle/updateMetaData` 等内容接口全部直接放在 `LynxWindow` 上，与 PC 保持一致。

只有未来明确需要“在一个 NativeScript 页面布局中嵌入多个独立 Lynx 区块”时，才增加可选的 `LynxView` NativeScript UI component。它不进入第一版复刻范围，也不阻塞 `LynxWindow` 实现。

### 3.3 模板与数据类型

| API                        | 策略 | Mobile 调整                                                |
| -------------------------- | ---- | ---------------------------------------------------------- |
| `LynxTemplateBundle`       | P0   | 接受 `ArrayBuffer`/`ArrayBufferView`；不要求 Node `Buffer` |
| `bundle.isValid()`         | P0   | 与 PC 一致                                                 |
| `bundle.getErrorMessage()` | P0   | 与 PC 一致                                                 |
| `LynxTemplateData<T>`      | P0   | `constructor(value)`、`toObject()`                         |
| `LynxUpdateMeta`           | P0   | `updateData`、`globalProps`                                |

建议把二进制输入统一为：

```ts
type BinaryLike = ArrayBuffer | ArrayBufferView;
```

PC 可以额外接受 `Buffer`，但公共类型不应要求 Mobile polyfill Node Buffer。

## 4. P0：BTS preload 接口

### 4.1 `contextBridge`

保留现有入口：

```ts
interface ContextBridge {
  exposeInLynxBTS(apis: Record<string, unknown>): void;
}
```

Mobile 实现在 NativeScript BTS Worker Context 中运行，将导出投影到同 isolate 的 Lynx BTS Context。

至少支持以下值：

- primitives、plain object、array。
- function 和 async function。
- Promise/thenable，并在 Lynx BTS Realm 创建消费方 Promise。
- 可归一化的 Error。

首版禁止直接导出：

- `LynxWindow`、NativeScript View、Activity、UIViewController 等 UI/Main 对象。
- 任意未声明生命周期的 native pointer。
- prototype 复杂且没有专门 proxy policy 的对象。

### 4.2 Preload plugin 生命周期

在 `contextBridge` 之上新增插件辅助接口：

```ts
interface BTSPreloadContext<Options = unknown> {
  windowId: number;
  platform: 'android' | 'ios';
  options: Options;
  signal: AbortSignal;
}

interface BTSPreloadRegistration {
  dispose?(): void | Promise<void>;
}

function defineBTSPreload<Options>(
  setup: (
    context: BTSPreloadContext<Options>
  ) => void | BTSPreloadRegistration | Promise<void | BTSPreloadRegistration>
): BTSPreloadDefinition;
```

`defineBTSPreload` 负责插件 options、初始化错误、窗口级实例和销毁，不改变 `exposeInLynxBTS` 的现有发布模型。

## 5. P0/P1：Lynx 页面接口

### 5.1 BTS NativeModule

当前 PC 页面通过 `NativeModules.nodejs.exposed` 使用 preload。Mobile 建议提升为平台中立名称：

```ts
interface NativeModules {
  lynxtron: {
    exposed: LynxtronExposed;
  };
}
```

迁移策略：

- Mobile 只保证 `NativeModules.lynxtron.exposed`。
- PC 同时注册 `lynxtron` 和现有 `nodejs` 别名。
- 业务通过类型扩展声明自己的 `LynxtronExposed`。

### 5.2 Main bridge

Main bridge 仍然有价值，因为页面有时需要请求 Main-only 操作。它与 preload bridge 是两条不同链路：

```ts
interface LynxWindowBridge {
  handle(method: string, handler: LynxBridgeHandler): void;
  handleOnce(method: string, handler: LynxBridgeHandler): void;
  removeHandler(method: string): void;
  removeAllHandlers?(): void;
}

class LynxWindow {
  readonly bridge: LynxWindowBridge;
}
```

首版可以继续支持全局 `lynxBridge.handle/handleOnce/removeHandler`，但 Mobile 推荐以 `window.bridge` 为主，避免多 Window 的 handler 冲突。

页面侧继续提供 `NativeModules.bridge.call/send/on`。这条链路允许跨线程消息；它不用于实现 BTS preload API。

### 5.3 MTS preload

MTS 新增独立入口：

```ts
interface MTSContextBridge {
  exposeInLynxMTS(apis: Record<string, MTSExportable>): void;
}

function defineMTSPreload(
  setup: (context: MTSPreloadContext) => void | { dispose?(): void }
): MTSPreloadDefinition;
```

MTS 只支持可同步完成、UI-safe 的函数和数据。第一版可以只支持 primitive、冻结配置对象和同步 host function，不必直接复制 BTS 的完整对象代理能力。

MTS 导出在页面中的最终命名需要结合 Lynx MTS 扩展机制做 Spike 后确定，不应先承诺 `NativeModules` 形式。

## 6. P0/P1：Lynx 配套能力

| PC API                                       | Mobile 策略 | 说明                                                       |
| -------------------------------------------- | ----------- | ---------------------------------------------------------- |
| `protocol.handle/unhandle/isProtocolHandled` | P0          | 统一 bundle、图片、字体和插件资源加载                      |
| `protocol.setRequestRewriter`                | P0          | 保持资源 URL 重写能力                                      |
| `devtool.setDevToolEnabled`                  | P1          | 映射 Lynx Mobile DevTool                                   |
| `devtool.isDevtoolEnabled`                   | P1          | 同上                                                       |
| `devtool.setLogboxEnabled`                   | P1          | 映射 Lynx LogBox                                           |
| `devtool.isLogboxEnabled`                    | P1          | 同上                                                       |
| `devtool.connectDevtool`                     | P1          | 取决于移动端 SDK 连接模式                                  |
| `devtool.setOpenCardCallback`                | P1          | 映射到 Mobile `LynxWindow`/导航创建逻辑                    |
| `registerGlobalEnvModule`                    | P1          | 改为插件注册 API，不直接暴露 PC linked binding             |
| `lynx` registry                              | P1          | 用于注册 Lynx extension/module/component；具体表面单独设计 |

`protocol.ResourceResponse.data` 在公共类型中应使用 `BinaryLike`，而不是 Node `Buffer`。

## 7. `app` 的处理

Lynxtron Mobile 基于 NativeScript，因此 P0 不复刻完整 `app`。应用生命周期、元数据、目录、前后台、deep link 等直接使用 NativeScript Application API。

如果需要提高 PC Main 代码迁移率，可以在 P1 提供很薄的兼容 facade：

| `app` API                                                      | Mobile 处理                                     |
| -------------------------------------------------------------- | ----------------------------------------------- |
| `whenReady()`、`isReady()`                                     | 映射 NativeScript launch 状态                   |
| `getName()`、`getVersion()`                                    | 映射应用元数据                                  |
| `getLocale()`、`getLocaleCountryCode()`                        | 映射移动端 locale                               |
| `getPath(name)`                                                | 只支持明确可映射的 appData/cache/temp/documents |
| `ready`、`activate`、`did-become-active`、`did-resign-active`  | 映射移动端生命周期                              |
| `open-url`                                                     | 映射 deep link/universal link                   |
| `quit()`、`exit()`、`relaunch()`                               | 不复刻；移动系统不提供对等语义                  |
| single-instance、login-item、recent-documents、jump-list、dock | 不复刻                                          |

这个 facade 应放在兼容子路径，而不是 Mobile core 默认出口。

## 8. 直接复用 NativeScript 或做 capability plugin

以下能力不属于 Lynxtron Mobile core：

| PC API                             | Mobile 来源                                                     |
| ---------------------------------- | --------------------------------------------------------------- |
| `clipboard`                        | NativeScript API；需要给页面时包装成 BTS capability plugin      |
| `Notification`                     | NativeScript/平台通知插件                                       |
| `dialog`                           | NativeScript UI/dialog；只能由 Main/MTS 或受控 Main bridge 调用 |
| `shell.openExternal`               | NativeScript/平台 URL launcher                                  |
| `screen`                           | NativeScript screen/device metrics                              |
| `nativeImage`                      | NativeScript ImageSource/平台图片对象                           |
| `powerMonitor`                     | NativeScript application/device/battery plugin                  |
| environment `getVar/hasVar/setVar` | 使用构建配置或应用配置；不模拟桌面环境变量                      |
| 文件、网络、数据库、权限、传感器   | NativeScript API 或独立 preload capability plugin               |

不要为了表面兼容，在 Lynxtron core 中再包装一套同名 Mobile API。确实需要 PC/Mobile 共用业务代码时，在应用层定义 adapter。

## 9. 明确不复刻的桌面接口

以下接口保持 Desktop-only：

- `BaseWindow` 的桌面窗口管理全集：位置、任意尺寸、最大化、最小化、置顶、阴影、透明度、taskbar、window message、window tabs。
- `Menu`、`MenuItem` 桌面菜单模型。
- `Tray`。
- `Dock`。
- `TouchBar*`。
- `CommandLine`。
- `Archive`、`splitPath` 和 ASAR 运行时。
- `utilityProcess`。
- jump list、user task、login item、recent document、single-instance lock。
- Desktop process metrics 和桌面电源事件。
- `fuses`、binary path、安装器和 CLI 等桌面分发工具。

Mobile 包中不导出这些符号，也不提供 silent no-op。平台代码误用时应在构建期得到类型/导出错误。

## 10. 首版建议导出表

```ts
// @lynx-js/lynxtron-mobile
export {
  LynxWindow,
  LynxTemplateBundle,
  LynxTemplateData,
  LynxUpdateMeta,
  protocol,
};

// P1
export { devtool, lynxBridge };

// @lynx-js/lynxtron-mobile/context-bridge
export { contextBridge, defineBTSPreload };

// P1: @lynx-js/lynxtron-mobile/mts
export { contextBridge, defineMTSPreload };
```

首版最小闭环实际只需要：

1. `LynxWindow`；native `LynxView` 仅作为内部实现。
2. 三个模板数据类型。
3. BTS `contextBridge` 和 preload plugin 生命周期。
4. `protocol` 资源加载。
5. 加载、首屏、错误、前后台和销毁事件。

Main bridge、MTS preload、DevTool 可以并行设计，但不应阻塞第一个 Android 端渲染 PoC。
