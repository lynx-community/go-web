---
'@lynx-js/go-web': patch
---

Add a Web preview refresh control next to the fullscreen button. It appears only after the initial Lynx bundle has downloaded, and soft-refreshes by remounting `<lynx-view>` into the rendering overlay stage (not downloading).
