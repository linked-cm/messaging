---
"@linked.cm/messaging": minor
---

`MsgThread.audience` is now a host-defined string. The engine carries the value and does not render or interpret it.

`createMessagingStore` requires `seed.me` and will not invent an author. `me` is the display author stamped on messages the in-memory store appends, not a signed-in identity; pass a function of the host session outside demos and tests.
