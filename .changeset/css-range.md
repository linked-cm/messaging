---
'@linked.cm/messaging': patch
---

Current framework ranges and an ESM-only build.

- Accept `@_linked/css` ^0.3.3 (was exactly `0.2.0`), so an app on css 0.3 installs one copy. The
  client reads only css variables; 0.3 removes none of 0.2's.
- Requires `@_linked/core` ^2.46.0; built with `@_linked/cli` ^1.61.0. `package.json` declares
  `"linked": {"kind": "library"}` in place of `linkedPackage`.
- The CommonJS build is gone: `@_linked/core` ships ESM only, so `lib/cjs` failed on its first
  `require` (`ERR_PACKAGE_PATH_NOT_EXPORTED`). `main` is `lib/esm/index.js` and the export map has
  no `require` conditions.
