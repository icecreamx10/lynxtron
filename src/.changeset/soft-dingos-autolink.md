---
'@lynx-js/cef-webview': patch
'@lynx-js/lynxtron-dev-plugins': patch
---

Declare the CEF binary and framework payloads in `lynx.lib.json`, and make
Lynxtron AutoLink consume only the prerelease `binaries`/`frameworks` artifact
schema with the canonical `arch` field.
