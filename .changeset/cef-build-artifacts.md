---
"@lynx-js/cef-webview": patch
"@lynx-js/lynxtron": patch
---

Build Windows CEF against the source-built Lynxtron import library and stage the
addon, subprocess, and runtime resources through the package build command.
Restore macOS Framework links omitted by npm packaging and adopt the upstream
CEF fixes. Source builds can skip downloading an unpublished Lynxtron runtime.
