# @linked.cm/messaging

## 0.3.1

### Patch Changes

- [#8](https://github.com/linked-cm/messaging/pull/8) [`d72ec84`](https://github.com/linked-cm/messaging/commit/d72ec8454ab0c6660ba89c5ce52adbb06d46c628) Thanks [@flyon](https://github.com/flyon)! - Current framework ranges and an ESM-only build.
  
  - Accept `@_linked/css` ^0.3.3 (was exactly `0.2.0`), so an app on css 0.3 installs one copy. The
    client reads only css variables; 0.3 removes none of 0.2's.
  - Requires `@_linked/core` ^2.46.0; built with `@_linked/cli` ^1.61.0. `package.json` declares
    `"linked": {"kind": "library"}` in place of `linkedPackage`.
  - The CommonJS build is gone: `@_linked/core` ships ESM only, so `lib/cjs` failed on its first
    `require` (`ERR_PACKAGE_PATH_NOT_EXPORTED`). `main` is `lib/esm/index.js` and the export map has
    no `require` conditions.

## 0.3.0

### Minor Changes

- [#1](https://github.com/linked-cm/messaging/pull/1) [`ddc7940`](https://github.com/linked-cm/messaging/commit/ddc7940b4f34bccf61019a86c7e8d39876a296b7) Thanks [@carlenmy](https://github.com/carlenmy)! - Add portable report, mute, block and moderation controls; message filtering; a bounded
  rate limiter; and an injected text-scanning contract without embedding host policy.

- [#1](https://github.com/linked-cm/messaging/pull/1) [`51d454a`](https://github.com/linked-cm/messaging/commit/51d454a927365d260460397e3009b12eb1892e9f) Thanks [@carlenmy](https://github.com/carlenmy)! - Add canonical scanner categories, validated suppress/freeze enforcement hints, and a
  silent outgoing-message rejection mode that consumes flagged drafts without invoking the
  transport or revealing moderation details.

## 0.2.0

### Minor Changes

- [`b59a442`](https://github.com/linked-cm/messaging/commit/b59a442e27ec71967cdfb24c566483923dd7d0cb) Thanks [@carlenmy](https://github.com/carlenmy)! - `MsgThread.audience` is now a host-defined string. The engine carries the value and does not render or interpret it.

  `createMessagingStore` requires `seed.me` and will not invent an author. `me` is the display author stamped on messages the in-memory store appends, not a signed-in identity; pass a function of the host session outside demos and tests.
