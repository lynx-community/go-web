---
'@lynx-js/go-web': patch
---

Hold the Web preview loading overlay through Lynx bundle download until the page root paints (`[part="page"]` / `[lynx-tag="page"]`), instead of clearing on the next tick after mount.
