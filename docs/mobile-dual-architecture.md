# Lynxtron Mobile：PC 模型的移动端对偶设计

> 状态：架构草案；P0 JS MVP 与 Android 源码构建 demo 已建立
> 核心结论：Lynxtron Mobile 是建立在 NativeScript 上的一组 Lynx 插件，而不是另一套移动端 Shell。它保留多 JS Realm 模型并使用 Lynx 原生端渲染；BTS 在 Lynx Runtime 中挂载 NativeScript preload context，MTS 增加独立 preload。preload 与 Lynx Realm 之间不引入应用级 RPC。

具体 JS API 复刻范围见 [`mobile-js-api-scope.md`](./mobile-js-api-scope.md)。
P0 MVP 包见 [`src/packages/lynxtron-mobile`](../src/packages/lynxtron-mobile/README.md)。
Android demo 见 [`src/packages/lynxtron-mobile-android-demo`](../src/packages/lynxtron-mobile-android-demo/README.md)：它从 `DEPS.lynx` 锁定的源码直接构建并嵌入 `LynxView`，不消费已发布的 Lynx Android SDK。

## 1. 设计目标

Lynxtron Mobile 不是把桌面程序套进 WebView，也不是把桌面的 Node 主进程改造成一个移动端 RPC 服务。它以 NativeScript 的应用、Runtime、插件体系和原生互操作能力为底座，只扩展 Lynx 相关能力。它是 PC 架构在 Android/iOS 上的逐层对偶实现：

- PC 的 Node/V8 Main Runtime，对应一个正常的 NativeScript/V8 应用 Runtime；Lynxtron 以 NativeScript 插件形式安装进去。
- PC 的原生 Window，对应 Mobile 的原生页面容器（Activity/Fragment/ViewController/View）。
- 两端容器内部都直接持有 `LynxView`，由 Lynx 原生渲染管线完成端渲染。
- PC BTS 中的 Node context，对应 Mobile BTS 中的 NativeScript context。
- BTS preload 都是与 Lynx BTS 同 isolate 内的独立 JS context，通过 context bridge 投影 API，不经过应用级 RPC。
- Mobile 额外定义 MTS preload，把必须贴近 UI 主线程的宿主能力绑定给 MTS。
- preload 能力优先按 NativeScript 插件打包，而不是由应用维护一套散落的注入脚本和 native glue。
- Main、BTS preload、MTS preload 的权限不同；共享的是模块代码和 API 契约，不共享可变 JS 状态。

本设计不要求 PC、Web、Mobile 暴露完全相同的平台 API。Lynxtron 统一的是生命周期、Runtime 插入点、preload 隔离与能力发布机制。业务层可以使用平台入口、条件导出或适配器兼容差异，例如为 Axios 提供不同 adapter。

## 2. 现有 PC 模型

当前代码中的核心链路是：

```text
操作系统进程
└── Main Node/V8 Runtime
    ├── app
    ├── LynxWindow
    │   └── Native Window
    │       └── LynxView（原生渲染）
    │           ├── Lynx MTS Realm
    │           └── Lynx BTS V8 Isolate / Realm
    │               └── Node Context
    │                   └── preload.js
    └── 其他桌面原生能力
```

关键实现事实：

1. `main_parts.cc` 初始化 V8、Node 环境、Lynx 平台和应用生命周期。
2. `api_lynx_window.cc` 从 `lynxPreference.preload` 读取 preload，并在创建 `LynxView` 时传给 builder。
3. `lynx_view_builder.cc` 为该 `LynxView` 注册 `LynxNodeModule`。
4. `lynx_node_module.cc` 从 Lynx BTS 的 N-API 环境取得 V8 context 和 isolate，在同一 isolate 内创建 Node context，运行 preload，再把显式导出的值包装到 Lynx context。
5. `src/lib/lynxbts/init.ts` 负责 preload 执行、跨 context 函数包装、Promise Realm 对齐和导出收集。

因此，PC preload 本质上不是远端服务，而是 Lynx BTS Runtime 内部附加的高能力 Realm。

## 3. Mobile 对偶关系

| PC 概念                        | Mobile 对偶                                  | 保持不变的语义                                    | 平台差异                                                                  |
| ------------------------------ | -------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| Node/V8 Main Runtime           | NativeScript/V8 应用 Runtime + Lynxtron 插件 | 运行入口脚本、拥有 `app`、创建和管理 `LynxWindow` | 应用生命周期和原生能力沿用 NativeScript                                   |
| Native Window                  | Native Page/Scene Container                  | 承载一个 `LynxView`，管理显示和生命周期           | Android 可落到 Activity/Fragment/View；iOS 可落到 UIViewController/UIView |
| `LynxWindow`                   | `LynxWindow`                                 | JS 层统一的 Lynx 页面容器和生命周期对象           | Mobile 不等价于 OS 浮动窗口，部分桌面属性无意义                           |
| LynxView                       | LynxView                                     | 直接加载 bundle、更新数据、执行 Lynx 原生渲染     | Android 从锁定源码构建；iOS 后续采用对应源码构建链路                      |
| BTS Node context               | BTS NativeScript context                     | 同 isolate 独立 Realm、执行 preload、显式导出能力 | 模块加载器和 built-ins 来自 NativeScript provider                         |
| MTS Runtime                    | MTS Runtime + MTS preload                    | 执行主线程脚本和帧敏感逻辑                        | 新增 UI 能力绑定入口                                                      |
| `NativeModules.nodejs.exposed` | 建议为 `NativeModules.lynxtron.exposed`      | Lynx BTS 获取 preload 导出                        | PC 可保留 `nodejs` 兼容别名；实际 API 集合允许不同                        |
| 主进程 bridge                  | Main bridge                                  | UI 向 Main 请求窗口级/应用级动作                  | 跨线程时仍可能异步，但不用于实现 preload 本身                             |

## 4. Mobile Runtime 拓扑

```text
Android Application / iOS Application
└── NativeScript/V8 Application Runtime
    ├── NativeScript app / navigation / plugins
    ├── @lynxtron/core plugin
    │   ├── app adapter
    │   └── LynxWindowManager
    ├── LynxWindow #1
    │   └── Native Scene Container
    │       └── LynxView（Android/iOS 原生端渲染）
    │           ├── MTS Realm
    │           │   ├── main-thread-script
    │           │   └── mainThreadPreload（UI-bound capabilities）
    │           └── NativeScript BTS Worker
    │               └── Worker V8 Isolate
    │                   ├── NativeScript Worker Context
    │                   │   └── preload（system/business capabilities）
    │                   └── Lynx BTS Context
    ├── LynxWindow #N
    │   └── ...
    └── @lynxtron/preload-* capability plugins
```

必须坚持两点：

- `LynxView` 直接接入移动端 Lynx 的 native view 和渲染管线，不增加 WebView 层；产物从 Lynxtron 锁定的 Lynx 源码构建。
- Main Runtime、MTS Realm、BTS Lynx Realm、BTS preload Realm 是不同的 JS 执行域。即使其中两个执行域位于同一条原生线程，也不能假设它们共享 `globalThis`、对象身份或模块单例状态。

### 4.1 NativeScript 插件分层

建议把 Lynxtron Mobile 拆成三类 NativeScript 插件：

| 插件类型          | 作用                                              | 典型内容                                                               |
| ----------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| Core plugin       | 给普通 NativeScript 应用增加 Lynx 页面能力        | 公共 `LynxWindow`、内部 native `LynxView`、bundle loader、生命周期适配 |
| Runtime plugin    | 把 NativeScript preload Runtime 接到 Lynx BTS/MTS | isolate/context attach、模块解析、context bridge、Realm 销毁           |
| Capability plugin | 向 preload 提供具体业务/系统能力                  | JS API、Android/iOS native 实现、BTS/MTS 入口、权限声明                |

应用 Main 仍然是正常的 NativeScript 代码，只是在需要时导入 Lynxtron：

```ts
import { app } from '@nativescript/core';
import { LynxWindow } from '@lynx-js/lynxtron-mobile';

app.on('launch', () => {
  const win = new LynxWindow({
    lynxPreference: {
      preloads: ['@app/device-preload'],
    },
  });
  win.loadBundle(bundle);
});
```

上述包名和事件名是设计示意。关键点是 NativeScript 是主体，Lynxtron 负责插件式增加 `LynxWindow/preload`；native `LynxView` 是 `LynxWindow` 的内部渲染实现，而不是另一套 P0 JS API。

### 4.2 BTS Worker 所有权

Mobile 推荐让 NativeScript Worker 持有 BTS V8 isolate，再让 Lynx BTS 运行在该 isolate 内，而不是先由 Lynx 创建 isolate、再尝试补装完整 NativeScript Worker：

```text
LynxWindow(Main)
  → 创建 NativeScript BTS Worker
  → Worker 创建 V8 isolate + NativeScript Worker Context
  → Lynxtron native runtime plugin 将 Lynx BTS Context 挂到同一 isolate
  → Worker 加载 preload capability plugins
  → context bridge 把 Worker Context 的显式导出投影到 Lynx BTS Context
```

Worker Context 本身就是 Mobile preload Realm，不需要在 Worker 中再创建第二个 NativeScript context。

这里的必要条件是 **共享 isolate**，仅共享 OS 线程不够。如果 NativeScript Worker 和 Lynx BTS 分别创建自己的 isolate，那么函数、Promise 和对象不能直接跨 Realm 包装，只能回到消息/RPC 模型。

建议初期每个 `LynxWindow` 独占一个 BTS Worker，保证生命周期和故障隔离；Worker 池属于后续内存优化，不应进入第一版。

Worker message 只用于 Main 对 Worker 的初始化、生命周期控制和诊断，不承载 Lynx 页面对 preload API 的正常调用。页面调用始终走同 isolate context bridge。

## 5. 三类执行域及能力边界

### 5.1 Main Runtime

Main 是应用控制面，拥有完整的应用和页面容器权限：

- `app` 生命周期、启动参数和应用级事件。
- 创建、查找、展示、隐藏、关闭 `LynxWindow`。
- 原生导航、权限申请、后台任务注册、系统级集成。
- 安装全局服务和生成每个 Window 的能力配置。

Main 中允许使用完整 NativeScript 原生互操作能力。只有 Main 能执行会改变应用拓扑的操作，例如创建 Window、终止应用或更换根页面。

### 5.2 BTS preload

BTS preload 是页面的数据与系统能力面，适合：

- 网络、文件、数据库、KV、设备信息。
- 编解码、业务 SDK、较重计算。
- 页面级 service、数据源和异步任务。
- 对第三方纯 JS 包提供运行时适配，例如 Axios adapter。

BTS preload 不提供 `app.quit()`、创建 `LynxWindow`、替换根页面等 Main 操作。它可以调用 NativeScript bindings，但可见模块应由 capability manifest 和 provider 白名单裁剪，而不是默认暴露全部原生对象。

### 5.3 MTS preload

MTS preload 是 UI 主线程能力面，适合：

- 与 Lynx root、原生 view、焦点和输入法绑定。
- 手势、动画、VSync、触觉反馈和状态栏等帧敏感能力。
- 注册供 main-thread-script 同步调用的轻量 host function。
- 在页面初始化阶段建立 MTS 与宿主 UI 的绑定。

MTS preload 不执行网络、文件和长耗时任务，不持有 Main 控制对象，也不直接复用 BTS NativeScript 对象。需要跨线程的数据通过 Lynx 已有的 MTS/BTS 通道或显式消息传递完成。

### 5.4 Lynx 页面代码

页面代码只能看到 preload 显式发布的 API，不直接获得 NativeScript 全局对象、原生类注册表或 Main Runtime 对象。

## 6. Preload 模型

### 6.1 配置

为兼容现有 PC API，保留 `preload` 表示文件型 BTS preload，并新增插件型 `preloads`。Mobile 默认推荐插件型配置，因为它可以同时携带 JS、Android/iOS native 实现、权限和构建信息：

```ts
interface LynxPreference {
  /** 兼容 PC 的文件入口；在 Mobile 中只适合应用自身的简单脚本。 */
  preload?: string | string[];

  /** NativeScript preload 插件。 */
  preloads?: Array<
    | string
    | {
        plugin: string;
        options?: Record<string, unknown>;
      }
  >;

  /** 低层 MTS 文件入口；通常由插件清单生成，不建议业务直接维护。 */
  mainThreadPreload?: string | string[];
}
```

使用示意：

```ts
const win = new LynxWindow({
  lynxPreference: {
    preloads: [
      '@lynxtron/preload-device',
      {
        plugin: '@app/account-preload',
        options: { scope: 'profile' },
      },
    ],
  },
});

win.loadBundle(bundle);
```

`preload` 的命名保持兼容，文件名中的 `.bts` 只是推荐约定。插件中的 MTS 源码可以是 `.mts.ts`，但交付物应由插件构建流程调用 Lynx MTS 工具链生成，避免在启动期动态编译。

### 6.2 Preload 插件清单

一个 preload 插件可以同时声明 Main 安装入口、BTS 入口和 MTS 入口：

```json
{
  "name": "@app/account-preload",
  "lynxtron": {
    "main": "./dist/main.js",
    "bts": "./dist/preload.bts.js",
    "mts": "./dist/preload.mts.bytecode",
    "capabilities": {
      "bts": ["network", "secure-storage"],
      "mts": ["haptics"]
    }
  }
}
```

这是 Lynxtron 自己的插件元数据，外层仍遵循 NativeScript 插件的工程和平台打包方式。安装阶段分别完成：

1. Main 入口向 NativeScript 应用 Runtime 注册原生模块、工厂和清理钩子。
2. BTS 入口被 preload Runtime 的模块解析器加载，并通过 `exposeInLynxBTS` 发布能力。
3. MTS 入口在构建时编译为 Lynx 可加载产物，在 View 初始化时安装。
4. capability 声明参与权限校验、裁剪、审计和调试日志。

`options` 必须是可序列化配置，并为每个 `LynxWindow` 创建独立实例；不能借此把 Main Realm 对象直接传入 BTS/MTS。

### 6.3 BTS 执行过程

Mobile BTS preload 的对偶流程为：

```text
LynxWindow 创建 BTS Worker
  → NativeScript Worker 创建 V8 isolate 和 Worker Context
  → 安装受控的 NativeScript bindings、模块加载器和 console
  → Lynxtron native plugin 在同 isolate 创建/挂载 Lynx BTS Context
  → 解析已安装的 NativeScript preload 插件
  → 在 Worker Context 执行插件 BTS preload
  → 收集 contextBridge 显式导出的值
  → 将函数、对象、异常和 Promise 包装进 Lynx BTS Realm
  → 页面通过 Lynx NativeModule 读取 exposed API
```

这里不需要应用级 RPC、socket 或独立 service process。调用仍在同一 isolate 内完成，跨越的是 V8 context/Realm 边界。若某个 NativeScript API 自身异步或需要切换原生线程，那是该 API 的调度行为，不改变 preload 的嵌入模型。

### 6.4 MTS 执行过程

MTS preload 在 `LynxView` 的 MTS Realm 创建后、页面 main-thread-script 执行前安装：

```text
Lynx MTS Runtime attach
  → 安装受控 UI host bindings
  → 执行/载入 mainThreadPreload
  → 收集并冻结显式导出
  → 挂载到 MTS global 或专用 host module
  → 执行页面 main-thread-script
```

MTS preload 不必是 NativeScript Runtime。它首先是 Lynx MTS Realm 的宿主扩展，底层通过 C++/JNI/ObjC++ binder 连接原生 UI。这样可以避免把完整 NativeScript 能力带入帧敏感 Realm。

### 6.5 Context bridge

建议把现有 bridge 扩展为两个明确入口：

```ts
contextBridge.exposeInLynxBTS({
  device: {
    getInfo: () => mobileDevice.getInfo(),
  },
});

contextBridge.exposeInLynxMTS({
  ui: {
    setStatusBarStyle: (style) => uiBinding.setStatusBarStyle(style),
  },
});
```

这是 API 草图，不要求两个 Realm 复用同一份 bridge 实现。它们需要保持相同的安全原则：只投影显式导出，递归包装对象和函数，统一异常语义，并在目标 Realm 创建 Promise。

## 7. `LynxWindow` 的 Mobile 语义

`LynxWindow` 在 Mobile 中应解释为“一个可独立管理生命周期的 Lynx 页面容器”，而不是强行模拟桌面 OS Window。

### 7.1 跨平台核心

以下能力可以保持共同语义：

- `loadFile`、`loadURL`、`loadBundle`。
- `updateMetaData`、`setGlobalProps`、`sendGlobalEvent`。
- `show`、`hide`、`close/destroy`。
- `ready-to-show`、首屏、加载错误、foreground/background 等事件。
- Window id、父子关系和实例查询。

### 7.2 Mobile 映射

| `LynxWindow` 操作     | Android                             | iOS                                      |
| --------------------- | ----------------------------------- | ---------------------------------------- |
| create                | 创建/绑定 Fragment 或受控 View 容器 | 创建/绑定 UIViewController 或受控 UIView |
| show                  | attach、navigate 或 present         | attach、push 或 present                  |
| hide                  | detach、覆盖或进入不可见状态        | detach、dismiss/cover 或进入不可见状态   |
| close                 | 销毁容器并 detach Lynx Runtime      | 销毁容器并 detach Lynx Runtime           |
| foreground/background | 跟随 Activity/Fragment 可见性       | 跟随 ViewController/App lifecycle        |
| resize                | 来自 layout、旋转、分屏和 safe area | 来自 layout、旋转、分屏和 safe area      |

具体采用 push、present 还是嵌入现有页面，由 `presentation`/`container` 等 Mobile 扩展选项决定，不应该由桌面的 `x/y/frame/minimizable` 等参数推断。

### 7.3 平台专属选项

建议把构造参数拆成：

```ts
interface LynxWindowConstructorOptions {
  show?: boolean;
  parent?: LynxWindow;
  lynxPreference?: LynxPreference;

  desktop?: DesktopWindowOptions;
  mobile?: MobileWindowOptions;
}
```

桌面旧字段可以继续作为兼容入口。Mobile 对无意义的桌面字段应在开发模式输出一次明确 warning，而不是静默产生看似支持的行为。

## 8. Runtime Provider：preload 插件的底层基础设施

当前 `LynxNodeModule` 同时承担了 Lynx 扩展模块、Node Runtime 创建和 preload bridge 三类职责。为了形成真正的平台对偶，应抽出与具体 Runtime 无关的协议：

```ts
interface BTSRuntimePairProvider {
  start(window: LynxWindowHandle): Promise<{
    isolate: JSIsolateHandle;
    preloadRealm: PreloadRealm;
    lynxRealm: LynxBTSRealm;
  }>;
  installBuiltins(realm: PreloadRealm, capabilities: CapabilitySet): void;
  runPreloads(realm: PreloadRealm, plugins: PreloadPlugin[]): Promise<unknown>;
  projectExports(source: PreloadRealm, target: LynxBTSRealm): unknown;
  detach(): void;
}
```

协议约束的是一对位于同一 isolate 的 Realm，不强制谁先创建 isolate：

- Desktop 由 Lynx BTS 提供 isolate，再创建 Node preload Realm。
- Mobile 由 NativeScript Worker 提供 isolate，再创建/挂载 Lynx BTS Realm。

对应实现：

- Desktop：`NodeBTSRuntimePairProvider`。
- Mobile：`NativeScriptWorkerBTSRuntimePairProvider`。
- Web：Worker/direct-JS provider；Web 可以保留自己的实现方式，不作为 Mobile 的基础层。

MTS 使用单独的 `MTSPreloadProvider`，因为其装载格式、线程约束和允许导出的值都比 BTS 更严格。

这些 provider 不应作为业务应用直接使用的公共 API，而是包含在 Lynxtron NativeScript Runtime plugin 内部。业务只安装和配置 preload capability plugin；runtime plugin 负责发现清单、创建 Realm、装载入口和执行清理钩子。

换句话说：

```text
业务配置 preload plugin
  → Lynxtron runtime plugin 解析插件清单
  → BTS/MTS provider 建立对应 Realm
  → 插件入口发布 capability
  → Lynx 页面消费 capability
```

第一步重构可以只在 PC 上抽出接口而不改变行为，再接 Mobile provider，避免把 `nodejs` 这个桌面概念扩散到移动端公共层。

## 9. 平台 API 策略

Lynxtron 不定义一个强制覆盖所有平台能力的“大一统 API”。建议分三层：

1. **机制层稳定**：`app`、`LynxWindow`、preload、context bridge、生命周期。
2. **小型跨平台核心**：网络状态、基础存储、设备信息等确实能保持语义一致的 API。
3. **平台能力插件**：`desktop/*`、`android/*`、`ios/*`、`web/*`，由各 preload plugin 自行选择发布。

前端可以通过条件入口或业务 adapter 消化差异：

```text
feature code
└── data-client interface
    ├── desktop adapter → desktop preload API
    ├── mobile adapter  → NativeScript preload API
    └── web adapter     → fetch/worker API
```

这意味着 Mobile 无需为了兼容 Node 而实现完整 `fs`、`child_process` 或桌面窗口 API，也无需为了兼容 Web 而仿造 DOM。

## 10. 生命周期

### 10.1 启动

```text
Native Application 启动
  → 初始化 Lynx 平台和 NativeScript Main Runtime
  → 执行 mobile main.js
  → app ready
  → new LynxWindow()
  → 创建原生 Scene Container
  → 创建并 attach LynxView
  → attach MTS preload
  → 创建 NativeScript BTS Worker
  → 在 Worker isolate 中 attach Lynx BTS Context
  → Worker 加载 BTS preload plugins
  → loadBundle/loadURL
  → 首屏完成，发出 ready-to-show
```

### 10.2 前后台

原生页面可见性变化必须同步到 `LynxView.EnterForeground/EnterBackground`，同时通知对应 preload Realm。Main Runtime 可以继续存活，但页面级 timer、observer、native callback 应跟随 Window 状态挂起或恢复。

### 10.3 销毁

销毁顺序应固定为：

1. 禁止新的页面调用进入 preload。
2. 注销 MTS host bindings 和 UI observer。
3. 取消 BTS native callback、任务和模块订阅。
4. detach Lynx BTS Context，并终止 NativeScript BTS Worker。
5. detach/destroy Lynx Runtime 和 `LynxView`。
6. 销毁原生页面容器并从 `LynxWindowManager` 注销。

销毁必须是幂等的。任何跨 Realm 包装函数在 detach 后调用，都应返回确定的 `WindowDestroyedError`，不能访问已释放的 native handle。

## 11. 线程与数据规则

- 原生 UI handle 只允许在 MTS/UI 主线程使用，不能作为 BTS 导出值穿透 context bridge。
- BTS preload 中的原生 API 必须声明线程归属；provider 负责必要的线程调度。
- MTS API 必须有同步执行预算，不允许隐藏的磁盘或网络访问。
- Promise 在消费方 Realm 创建；PC 现有的 microtask checkpoint 处理方式应被提升为 provider 协议的一部分。
- 跨 Realm 的值仅允许 primitives、可复制数据、受控 function proxy 和显式 host handle。
- 同一源码模块可以分别被 BTS/MTS 编译和加载，但它们拥有独立 module cache 和状态。

## 12. 安全模型

每个 Window 应根据已启用的 preload 插件生成一份 capability manifest：

```ts
interface WindowCapabilities {
  bts: string[];
  mts: string[];
  mainBridge: string[];
}
```

基本约束：

- Main 默认拥有应用权限，但仍受 Android/iOS 系统权限控制。
- BTS 只安装 manifest 中允许的 NativeScript 模块和 native namespace。
- MTS 只安装帧安全、UI 相关的 host bindings。
- Lynx 页面只能访问 preload 显式发布的最终 API。
- Main 控制对象不能通过闭包、prototype 或 native handle 被间接泄露到 BTS/MTS。
- 开发模式记录 capability 安装、跨 Realm 调用和慢 MTS 调用；生产模式关闭敏感参数日志。

## 13. 建议的工程结构

```text
packages/
├── lynxtron/                            # 现有 PC 包
├── lynxtron-mobile/                      # NativeScript core/runtime plugin
│   ├── index.ts                         # LynxWindow 公共 API
│   ├── index.android.ts
│   ├── index.ios.ts
│   ├── platforms/android/               # JNI/C++、Lynx Android SDK 接入
│   └── platforms/ios/                   # ObjC++、Lynx iOS SDK 接入
├── lynxtron-mobile-runtime/              # 可选拆分的 preload runtime plugin
│   ├── bts/                             # NativeScript context/bootstrap/bridge
│   ├── mts/                             # MTS loader/host binding
│   └── native/                          # isolate/context attach 实现
└── preload-*/                           # 可选的 capability plugins
    ├── package.json                     # lynxtron.main/bts/mts/capabilities
    ├── src/
    └── platforms/
```

应用侧建议使用明确的平台入口：

```text
app/
├── main/
│   ├── desktop.ts
│   └── mobile.ts
├── preload/
│   └── app-specific-plugin/             # 应用私有 NativeScript preload plugin
│       ├── main.ts
│       ├── preload.bts.ts
│       └── preload.mts.ts
└── lynx-ui/
```

公共业务模块可以被这些入口复用，但不要求入口 API 完全一致。

## 14. 分阶段落地

### Phase 0：在 PC 上抽象现有模型

- 从 `LynxNodeModule` 提取 BTS preload provider 和跨 Realm bridge 契约。
- 保持当前 Node preload 行为、模块名和 demo 不变。
- 为 attach/detach、Promise、异常、对象包装补齐契约测试。

### Phase 1：Android 最小闭环

- 在标准 NativeScript Android 应用中安装 Lynxtron core/runtime plugins。
- NativeScript Main 导入 `LynxWindow`，创建 Android 原生容器和 `LynxView`。
- `loadBundle()` 直接端渲染现有 Lynx bundle。
- 安装一个最小 NativeScript preload capability plugin。
- 每个 `LynxWindow` 创建一个 NativeScript Worker，并让 Lynx BTS 使用 Worker 的 V8 isolate。
- 在 Worker Context 中根据插件清单运行 `preload.bts.js`。
- Lynx BTS 直接调用导出的 NativeScript 能力，不经过应用级 RPC。

### Phase 2：MTS preload

- 定义 MTS preload 编译产物、加载时机和 host binding ABI。
- 完成 root/native UI 绑定和帧预算监控。
- 验证 MTS/BTS 加载同一共享模块时状态隔离。

### Phase 3：iOS 对偶与平台收敛

- 实现 iOS Scene Container 和 NativeScript provider。
- 对齐生命周期、异常、Promise 和销毁语义。
- 把真正稳定的部分提升为跨平台核心 API，其余保留平台入口。

## 15. PoC 验收标准

最小 PoC 同时满足以下条件，才能证明模型成立：

1. Mobile Main 脚本能用 `app` 和 `LynxWindow` 启动一个页面。
2. 页面由 Android/iOS `LynxView` 直接原生渲染，链路中不存在 WebView。
3. BTS preload 能调用至少一个 NativeScript 原生 API，并让 Lynx BTS 直接取得结果。
4. 第 3 项调用不经过 Main Runtime、socket、JSON 序列化或应用级 RPC。
5. MTS preload 能注册并调用一个轻量 UI host function。
6. BTS/MTS 均无法创建 `LynxWindow` 或调用 Main-only API。
7. 前后台切换、页面销毁后无残留 callback、无悬空 native handle、无 Realm 泄漏。
8. 同一 Lynx UI bundle 可以通过 adapter 分别运行在现有 PC 和 Mobile host 上。

## 16. 需要通过技术 Spike 确认的事项

这些事项影响实现方式，但不改变总体模型：

- Lynx BTS 是否支持使用 NativeScript Worker 已创建的 V8 isolate/context，或者提供可扩展的 Runtime/VM delegate；这是 Worker 所有权模型成立的首要验证项。
- Android/iOS 上 NativeScript bindings、snapshot、模块加载器的最小可嵌入集合。
- NativeScript 插件构建流程中，如何声明并产出 Main/BTS/MTS 三类入口，以及如何让 autolinking 注册对应 native glue。
- MTS preload 的构建格式、加载 hook 和不同 Lynx 版本中的 ABI 稳定性。
- Mobile `LynxWindow` 默认采用独立页面、导航栈页面还是可嵌入 View；建议先以可嵌入容器为底座，上层再提供 push/present。
- 是否把公共 NativeModule 命名从 `nodejs` 提升为 `lynxtron`；建议保留 PC 兼容别名后逐步迁移。

## 17. 架构不变量

后续实现和 API 讨论应以这些不变量作为判断标准：

1. Mobile 使用 Lynx 原生端渲染，不以 WebView 作为页面容器。
2. `LynxWindow` 是跨平台页面容器抽象，不要求 Mobile 模拟桌面窗口管理器。
3. BTS preload 是 Lynx BTS Runtime 内嵌的附加 Realm，不是 Main 侧 RPC service。
4. MTS preload 与 BTS preload 分离，权限和性能预算不同。
5. 只有 Main 能改变应用/Window 拓扑。
6. 页面只能获得显式导出的 capability。
7. 平台 API 可以不同，统一机制优先于强行统一 API 表面。
