---
'@lynx-js/go-web': minor
---

Support complete Web application entries through
`templateFiles[].webHostFile`. Web host entries render in an iframe and take
precedence over raw `.web.bundle` previews, so examples can own their Web
runtime, bridge, and `<lynx-view>`.

Go may publish a Web host at a stable site path root
(`/<example>/index.html`) so it is directly accessible as a standalone demo.
The packaged host must be relocatable so its workers, chunks, and wasm resolve
under that path. Example assets now also resolve against the origin serving
them, so `exampleBasePath` may point at another origin.
