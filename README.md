# `@_linked/messaging`

A shape-agnostic, transport-agnostic messaging engine for LINKED applications.

It provides three things and deliberately nothing else:

- **`Messaging`** — the transport seam. `spaces()`, `threads()`, `messages()`,
  `send()`, plus optional additive verbs (`react`, `sendReply`, `edit`,
  `remove`, `sendMedia`, `sendData`, `sendSignal`, `setTyping`, `markRead`).
  A transport implements only what it supports; the UI never shows a dead
  control.
- **`createMessagingStore`** — an in-memory reference implementation of that
  seam, for demos, tests, and offline states.
- **`MessageClient`** — a themeable chat UI that renders any `Messaging`.

## Install

```sh
npm install @_linked/messaging
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
import { createMessagingStore } from '@_linked/messaging';
import { createMatrixMessaging } from '@_linked/matrix/client';

const store = demo ? createMessagingStore(seed) : await createMatrixMessaging(session, config);
```

## Styling

The client is styled with LINKED design tokens (`--bg-panel`, `--space-md`,
`--radius-lg`, …) supplied by `@_linked/css`. It defines no colours of its own,
so it inherits the host's theme in both light and dark.

Import the stylesheet once:

```ts
import '@_linked/messaging/styles.css';
```

## Transports

| Package | Transport |
|---|---|
| built in | `createMessagingStore` — in-memory |
| `@_linked/matrix` | Matrix homeserver + appservice |

The package targets `@_linked/core` 2.14.4 and registers under the LINKED
package identity `@_linked/messaging`.
