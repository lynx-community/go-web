---
'@lynx-js/go-web': minor
---

Support complete Web application entries through
`templateFiles[].webHostFile`. Web host entries render in an iframe and take
precedence over raw `.web.bundle` previews, so examples can own their Web
runtime, bridge, and `<lynx-view>`.

A Web host is published at a site path root (`/<example>/index.html`) rather
than inside the example folder, because such a build bakes an absolute base URL
that its web workers must resolve too. Example assets now also resolve against
the origin serving them, so `exampleBasePath` may point at another origin.
