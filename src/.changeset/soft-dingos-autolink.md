---
'@lynx-js/cef-webview': patch
'@lynx-js/lynxtron-dev-plugins': patch
'@lynx-js/lynxtron-builder': patch
---

Declare the CEF binary and framework payloads in `lynx.lib.json`, and make
Lynxtron AutoLink consume only the prerelease target-based artifact schema.
Each `os`/`arch` target owns its `binaries` and optional `frameworks`. Publish
the Windows x64 CEF addon and runtime payload alongside the macOS artifacts.

Package staged AutoLink libraries into final applications. macOS Framework
payloads are copied to `Contents/Frameworks`, while native packages remain
available from `app.asar.unpacked` on macOS and Windows.
