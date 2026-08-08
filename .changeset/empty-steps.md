---
'@lynx-js/go-web': patch
---

Return instead of hanging when `autoGesture` is given no steps.

`steps: []` type-checks, and with `loop: true` the playback loop never reached an `await` — so it spun synchronously and neither a timer nor an event could set the stop flag. An empty sequence now ends the way it reads: by doing nothing.
