---
'@lynx-js/lynxtron': patch
---

Upgrade Lynx to give macOS surfaces unique texture lifetime IDs, preventing stale partial-repaint damage from leaving unpainted margins when Metal texture addresses are reused.
