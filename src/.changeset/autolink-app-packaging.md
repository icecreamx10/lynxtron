---
"@lynx-js/lynxtron-builder": patch
"create-lynxtron": patch
---

Package staged AutoLink native libraries without application-specific native
layout configuration. Place declared macOS Frameworks and helper app bundles
in Contents/Frameworks and keep native runtime files outside ASAR. Remove the
template's duplicate application copy and load its Lynx bundle relative to the
packaged main entry.
