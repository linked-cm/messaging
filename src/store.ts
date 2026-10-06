import React from 'react';
import type { Messaging, MessagingSeed, MsgAuthor, MsgMessage } from './types.js';

// In-memory messaging store factory. Subscribable via useSyncExternalStore; `send` appends an optimistic
// message from the seed's `me`. `me` is a display author, not an authenticated identity — this store
// never invents one. This is the reference transport — a live transport (e.g. @_linked/matrix)
// implements the SAME `Messaging` interface, so hosts swap it with zero UI changes.

/** Reply-quote excerpt: first line, trimmed to a chip-sized length. */
export const excerptOf = (text: string | undefined, max = 80): string => {
  const line = (text ?? '').split('\n')[0]!.trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

/**
 * The display author for one send. A blank id is not an author: the store
 * drops the send rather than inventing a speaker for a signed-out session.
 */
function authorOf(me: MessagingSeed['me']): MsgAuthor | undefined {
  const author = typeof me === 'function' ? me() : me;
  if (!author || typeof author.id !== 'string' || author.id.trim() === '') return undefined;
  return author;
}

export function createMessagingStore(seed: MessagingSeed): Messaging {
  if (seed?.me == null) {
    throw new Error(
      'createMessagingStore requires seed.me (the display author stamped on messages this store appends). The store does not authenticate anyone and will not invent an author — pass the signed-in person, preferably as a function that reads the host session. A constant author belongs in demos and tests only.',
    );
  }
  const messages = { ...seed.messages };
  let version = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    version += 1;
    listeners.forEach((l) => l());
  };
  const find = (threadId: string, id: string): MsgMessage | undefined =>
    messages[threadId]?.find((m) => m.id === id);
  return {
    spaces: () => seed.spaces,
    threads: (spaceId) => seed.threads.filter((t) => t.spaceId === spaceId),
    messages: (threadId) => messages[threadId] ?? [],
    send: (threadId, text) => {
      const me = authorOf(seed.me);
      if (!me) return;
      const list = (messages[threadId] ??= []);
      list.push({ id: `${threadId}-${list.length}`, threadId, author: me, ts: 'now', text, mine: true });
      notify();
    },
    sendData: (threadId, data, fallbackText) => {
      const me = authorOf(seed.me);
      if (!me) return;
      const list = (messages[threadId] ??= []);
      list.push({ id: `${threadId}-${list.length}`, threadId, author: me, ts: 'now', text: fallbackText, data, mine: true });
      notify();
    },
    // Attachment parity with a live transport: an object URL stands in for the
    // mxc→http media URL, so demos/tests render the SAME MsgMessage.media shape the live client emits.
    sendMedia: (threadId, upload) => {
      const me = authorOf(seed.me);
      if (!me) return;
      const list = (messages[threadId] ??= []);
      list.push({
        id: `${threadId}-${list.length}`,
        threadId,
        author: me,
        ts: 'now',
        mine: true,
        media: {
          kind: upload.kind,
          url: URL.createObjectURL(upload.blob),
          name: upload.name,
          mimeType: upload.mimeType,
          size: upload.blob.size,
          width: upload.width,
          height: upload.height,
        },
      });
      notify();
    },
    // Signal parity : signals are aggregation-only vocabulary — the Matrix transport
    // posts them body-less and the projection EXCLUDES them from the message stream, so parity here
    // is "no message appears; subscribers still tick" (the live client re-projects on the echo).
    sendSignal: () => {
      notify();
    },
    // Conversation features  — in-memory parity with the Matrix
    // transport so tests/demos exercise the SAME seam the live client offers.
    react: (threadId, eventId, emoji) => {
      const msg = find(threadId, eventId);
      if (!msg || msg.myReactions?.includes(emoji)) return;
      const reactions = (msg.reactions ??= []);
      const hit = reactions.find(([e]) => e === emoji);
      if (hit) hit[1] += 1;
      else reactions.push([emoji, 1]);
      (msg.myReactions ??= []).push(emoji);
      notify();
    },
    unreact: (threadId, eventId, emoji) => {
      const msg = find(threadId, eventId);
      if (!msg || !msg.myReactions?.includes(emoji)) return;
      msg.myReactions = msg.myReactions.filter((e) => e !== emoji);
      const hit = msg.reactions?.find(([e]) => e === emoji);
      if (hit) hit[1] -= 1;
      msg.reactions = msg.reactions?.filter(([, n]) => n > 0);
      if (!msg.reactions?.length) delete msg.reactions;
      if (!msg.myReactions.length) delete msg.myReactions;
      notify();
    },
    sendReply: (threadId, text, inReplyToEventId) => {
      const me = authorOf(seed.me);
      if (!me) return;
      const list = (messages[threadId] ??= []);
      const target = list.find((m) => m.id === inReplyToEventId);
      list.push({
        id: `${threadId}-${list.length}`,
        threadId,
        author: me,
        ts: 'now',
        text,
        mine: true,
        replyTo: target
          ? { id: target.id, authorName: target.author.name, excerpt: excerptOf(target.text) }
          : undefined,
      });
      notify();
    },
    edit: (threadId, eventId, newText) => {
      const msg = find(threadId, eventId);
      if (!msg) return;
      msg.text = newText;
      msg.edited = true;
      notify();
    },
    remove: (threadId, eventId) => {
      const list = messages[threadId];
      if (!list?.some((m) => m.id === eventId)) return;
      messages[threadId] = list.filter((m) => m.id !== eventId);
      notify();
    },
    // Typing parity : the viewer's own typing is ephemeral transport signalling
    // and NEVER projects back onto `MsgThread.typing` (that field is other members) — so the
    // in-memory contract is "safe to call on every keystroke, no message, no version churn".
    setTyping: () => {},
    // Read-receipt parity : viewing a thread clears its unread badge. GUARDED —
    // an already-read thread doesn't notify, mirroring the live transport's latest-event guard
    // (the UI fires this from an effect on [activeThreadId, version] and must not loop).
    markRead: (threadId) => {
      const thread = seed.threads.find((t) => t.id === threadId);
      if (!thread?.unread) return;
      delete thread.unread;
      notify();
    },
    mutate: (fn) => {
      fn();
      notify();
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    version: () => version,
  };
}

/** Subscribe a component to a store; re-renders on any change. */
export function useMessagingStore(store: Messaging): Messaging {
  React.useSyncExternalStore(store.subscribe, store.version, store.version);
  return store;
}
