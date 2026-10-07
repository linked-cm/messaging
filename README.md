# `@linked.cm/messaging`

A shape-agnostic, transport-agnostic messaging engine for LINKED applications.

It provides three things and deliberately nothing else:

- **`Messaging`** — the transport seam. `spaces()`, `threads()`, `messages()`,
  `send()`, plus optional additive verbs (`react`, `sendReply`, `edit`,
  `remove`, `report`, `ignoreAuthor`, `sendMedia`, `sendData`, `sendSignal`,
  `setTyping`, `markRead`).
  A transport implements only what it supports; the UI never shows a dead
  control.
- **`createMessagingStore`** — an in-memory reference implementation of that
  seam, for demos, tests, and offline states.
- **`MessageClient`** — a themeable chat UI that renders any `Messaging`.

## Install

```sh
npm install @linked.cm/messaging
```

## What it does not know

No channel taxonomy, no interactive-card vocabulary, no branding, no product
copy. Every host-specific decision arrives as a render prop:

```tsx
<MessageClient
  store={transport}
  activeThreadId={active}
  onActiveThread={setActive}
  threadIcon={(t) => iconFor(t.kind)}
  renderCard={(data, thread) => <MyCard data={data} thread={thread} />}
  renderAvatar={(author) => <MyAvatar id={author.id} />}
  renderQR={(value, size) => <MyQR value={value} size={size} />}
/>
```

That is what lets the same UI run against the in-memory store and against a
live transport with no component changes:

```ts
import { createMessagingStore } from '@linked.cm/messaging';
import { createMatrixMessaging } from '@linked.cm/matrix/client';

const store = demo
  ? createMessagingStore(seed)
  : await createMatrixMessaging(session, config);
```

## Identity

`createMessagingStore` is the in-memory reference transport for demos and tests.
It does not authenticate anyone. `seed.me` is only the display author stamped
on messages the store appends. There is no default person: construction throws
if `me` is missing, and a send is dropped when the resolved author has no id,
so a signed-out session is not filled in with a fabricated speaker.

A host that uses the store outside a demo passes `me` as a function of its
verified session. A hardcoded author is demo data, not a signed-in user. A live
app should use a real transport (for example `@linked.cm/matrix`), which takes
its session from the host.

`MsgThread.audience` is a host-defined string. The engine carries it and does
not render or interpret it. Age bands and who may read a thread stay in the host.

## Safety

The default client has accessible report, mute, block, own-delete, and authorized
moderator-remove controls. Pass a `MessageSafetyController` to persist product-level
actions. A transport-native report/ignore is also used when available, but the API keeps
the semantics honest: a Matrix ignore is a one-way mute, never a bilateral block.

For conversations between strangers, a host can provide
`MessageSafetyController.checkOutgoingText`. The client awaits that preflight before the
transport receives the message. A host can return `silent: true` for a rejected message;
the client then consumes the draft without displaying a moderation result and never calls
the transport. Non-silent failures leave the text in the composer and display only the
host's safe user-facing explanation. Scanning policy and diagnostics stay server-side.

`filterUnsafeMessages`, `createSlidingWindowRateLimiter`, and
`runMessageTextSafetyCheck` are reusable without the UI. The scan helper requires an
injected scanner and records when none is available; this package does not claim that a
keyword list or empty seam is content moderation. Durable RDF records and moderation
lifecycle operations live in `@linked.cm/safety`.

## Styling

The client is styled with LINKED design tokens (`--bg-panel`, `--space-md`,
`--radius-lg`, …) supplied by `@_linked/css`. It defines no colours of its own,
so it inherits the host's theme in both light and dark.

Import the stylesheet once:

```ts
import '@linked.cm/messaging/styles.css';
```

## Transports

| Package             | Transport                          |
| ------------------- | ---------------------------------- |
| built in            | `createMessagingStore` — in-memory |
| `@linked.cm/matrix` | Matrix homeserver + appservice     |

The package targets `@_linked/core` ^2.25.0 and registers under the LINKED
package identity `@_linked/messaging`.
