---
'@lynx-js/go-web': patch
---

Resolve site-root preview media and native-framework links through the
host's `withBase` adapter, so Rspress deployments retain their site base.
Apply the same rule to Explorer and custom `poweredBy` links while
preserving external URLs and schemes.
