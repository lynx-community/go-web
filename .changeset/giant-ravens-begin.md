---
'@lynx-js/go-web': patch
---

Fix white flash when switching to Web preview tab by keeping `<lynx-view>` mounted and eagerly preloading content.
