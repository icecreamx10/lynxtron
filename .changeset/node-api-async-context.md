---
'@lynx-js/lynxtron': patch
---

Enter the owning V8 context before Node-API async work completion callbacks, preventing preload native async operations from aborting when multiple Node environments share an isolate.
