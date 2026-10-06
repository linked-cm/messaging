# @linked.cm/messaging

## 0.2.0

### Minor Changes

- [`b59a442`](https://github.com/linked-cm/messaging/commit/b59a442e27ec71967cdfb24c566483923dd7d0cb) Thanks [@carlenmy](https://github.com/carlenmy)! - `MsgThread.audience` is now a host-defined string. The engine carries the value and does not render or interpret it.

  `createMessagingStore` requires `seed.me` and will not invent an author. `me` is the display author stamped on messages the in-memory store appends, not a signed-in identity; pass a function of the host session outside demos and tests.
