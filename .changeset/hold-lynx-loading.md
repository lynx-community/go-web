---
'@lynx-js/go-web': patch
---

Hold the Web preview loading overlay through Lynx bundle download until the page root paints (`[part="page"]` / `[lynx-tag="page"]`), and show a tiny stage label under the spinner (runtime → downloading → rendering).
