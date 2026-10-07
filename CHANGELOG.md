# @linked.cm/messaging

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
