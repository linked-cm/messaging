---
'@linked.cm/messaging': patch
---

Accept `@_linked/css` 0.3 (`^0.2.0 || ^0.3.0` instead of exactly `0.2.0`), so an app on css 0.3
installs one copy. The client uses only css variables; 0.3.1 removes none of the ones 0.2.0
defines and adds the `--space-*` scale the client reads.
