---
"@lynx-js/cef-webview": patch
"@lynx-js/lynxtron-dev-plugins": patch
---

Register and load the CEF webview through AutoLink. Select literal target-specific
runtime artifacts from lynx.lib.json, stage them after emit, and resolve generated
loaders from the application output without copying entire dependency packages.
