---
'@lynx-js/go-web': minor
---

Display the loaded example's metadata version immediately before the
GitHub button and other footer actions with a compact `v` prefix by default.
Override the client label and description through `config.i18n`.
Include the version as text in static output without rendering client
footer content or styles. Omit missing, blank or non-string versions.
Preserve the existing client `rightFooter` content and position.
