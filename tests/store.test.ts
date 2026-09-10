import { describe, expect, it } from 'vitest';
import { createMessagingStore, excerptOf } from '../src/store.js';
import type { MessagingSeed } from '../src/types.js';

// In-memory-store parity for the seam's optional verbs (react / unreact /
// sendReply / edit / remove) — the reference transport must behave like a live
// one so tests and demos exercise the SAME contracts the UI binds.

const seed = (): MessagingSeed => ({
  spaces: [{ id: 's1', name: 'Rovers', initials: 'RO', tier: 'team' }],
  threads: [{ id: 't1', spaceId: 's1', title: 'news', tier: 'team' }],
  messages: {
    t1: [
      { id: 'a', threadId: 't1', author: { id: 'p1', name: 'Gloria', initials: 'G' }, ts: '9:00', text: 'Morning crew' },
      { id: 'b', threadId: 't1', author: { id: 'me', name: 'Me', initials: 'M' }, ts: '9:01', text: 'Hi all', mine: true },
    ],
  },
  me: { id: 'me', name: 'Me', initials: 'M' },
});

describe('mock messaging store — M4 seam parity', () => {
  it('react adds a chip + viewer state; a second reaction from the viewer is idempotent', () => {
    const store = createMessagingStore(seed());
    const v0 = store.version();
    store.react!('t1', 'a', '🙌');
    store.react!('t1', 'a', '🙌'); // no double count
    const msg = store.messages('t1')[0]!;
    expect(msg.reactions).toEqual([['🙌', 1]]);
    expect(msg.myReactions).toEqual(['🙌']);
    expect(store.version()).toBe(v0 + 1); // idempotent second call didn't notify
  });

  it('unreact withdraws only the viewer’s reaction and clears empty aggregates', () => {
    const store = createMessagingStore(seed());
    store.react!('t1', 'a', '🙌');
    store.react!('t1', 'a', '🎉');
    store.unreact!('t1', 'a', '🙌');
    const msg = store.messages('t1')[0]!;
    expect(msg.reactions).toEqual([['🎉', 1]]);
    expect(msg.myReactions).toEqual(['🎉']);
    store.unreact!('t1', 'a', '🎉');
    expect(store.messages('t1')[0]!.reactions).toBeUndefined();
    expect(store.messages('t1')[0]!.myReactions).toBeUndefined();
  });

  it('sendReply appends a mine message carrying the resolved replyTo context', () => {
    const store = createMessagingStore(seed());
    store.sendReply!('t1', 'On my way', 'a');
    const msgs = store.messages('t1');
    expect(msgs).toHaveLength(3);
    expect(msgs[2]).toMatchObject({
      text: 'On my way',
      mine: true,
      replyTo: { id: 'a', authorName: 'Gloria', excerpt: 'Morning crew' },
    });
  });

  it('edit replaces the text and marks edited', () => {
    const store = createMessagingStore(seed());
    store.edit!('t1', 'b', 'Hi everyone');
    expect(store.messages('t1')[1]).toMatchObject({ text: 'Hi everyone', edited: true });
  });

  it('remove drops the message entirely (no tombstone)', () => {
    const store = createMessagingStore(seed());
    store.remove!('t1', 'b');
    expect(store.messages('t1').map((m) => m.id)).toEqual(['a']);
  });

  it('every successful mutation notifies subscribers (version bumps)', () => {
    const store = createMessagingStore(seed());
    let ticks = 0;
    store.subscribe(() => (ticks += 1));
    store.react!('t1', 'a', '🙌');
    store.unreact!('t1', 'a', '🙌');
    store.sendReply!('t1', 'x', 'a');
    store.edit!('t1', 'b', 'y');
    store.remove!('t1', 'b');
    expect(ticks).toBe(5);
    // misses are no-ops: no phantom notifications
    store.edit!('t1', 'nope', 'z');
    store.remove!('t1', 'nope');
    store.unreact!('t1', 'a', '🙌');
    expect(ticks).toBe(5);
  });

  it('sendMedia appends a mine message carrying the media shape (objectURL) — 036 P1 parity', () => {
    const store = createMessagingStore(seed());
    const blob = new Blob(['x'.repeat(10)], { type: 'image/jpeg' });
    let ticks = 0;
    store.subscribe(() => (ticks += 1));
    store.sendMedia!('t1', { kind: 'image', blob, name: 'photo.jpg', mimeType: 'image/jpeg', width: 120, height: 80 });
    const msgs = store.messages('t1');
    expect(msgs).toHaveLength(3);
    expect(msgs[2]).toMatchObject({
      mine: true,
      media: { kind: 'image', name: 'photo.jpg', mimeType: 'image/jpeg', size: 10, width: 120, height: 80 },
    });
    expect(msgs[2]!.media!.url).toMatch(/^blob:/);
    expect(msgs[2]!.text).toBeUndefined();
    expect(ticks).toBe(1);
  });

  it('sendMedia file kind carries no dimensions (download-row shape)', () => {
    const store = createMessagingStore(seed());
    const blob = new Blob(['pdf-bytes'], { type: 'application/pdf' });
    store.sendMedia!('t1', { kind: 'file', blob, name: 'waiver.pdf', mimeType: 'application/pdf' });
    const msg = store.messages('t1')[2]!;
    expect(msg.media).toMatchObject({ kind: 'file', name: 'waiver.pdf', mimeType: 'application/pdf' });
    expect(msg.media!.width).toBeUndefined();
  });

  it('sendSignal parity (plan 036 P3): NO message appears — signals are aggregation-only — but subscribers tick', () => {
    const store = createMessagingStore(seed());
    let ticks = 0;
    store.subscribe(() => (ticks += 1));
    store.sendSignal!('t1', 'm.serve.poll.response', { pollId: 'a', optionIds: ['o1'] });
    expect(store.messages('t1')).toHaveLength(2); // unchanged — never a text bubble
    expect(ticks).toBe(1);
  });

  it('markRead parity (plan 036 P4): clears the thread unread badge and notifies', () => {
    const s = seed();
    s.threads[0]!.unread = 3;
    const store = createMessagingStore(s);
    const v0 = store.version();
    store.markRead!('t1');
    expect(store.threads('s1')[0]!.unread).toBeUndefined();
    expect(store.version()).toBe(v0 + 1);
  });

  it('markRead is GUARDED: an already-read thread does not notify (no effect-loop fuel)', () => {
    const store = createMessagingStore(seed());
    let ticks = 0;
    store.subscribe(() => (ticks += 1));
    store.markRead!('t1'); // no unread to clear
    store.markRead!('nope'); // unknown thread
    expect(ticks).toBe(0);
  });

  it('setTyping parity (plan 036 P4): safe on every keystroke — no message, no version churn', () => {
    const store = createMessagingStore(seed());
    const v0 = store.version();
    store.setTyping!('t1', true);
    store.setTyping!('t1', true);
    store.setTyping!('t1', false);
    expect(store.messages('t1')).toHaveLength(2);
    expect(store.version()).toBe(v0);
  });

  it('excerptOf keeps the first line and trims to chip length', () => {
    expect(excerptOf('hello\nworld')).toBe('hello');
    expect(excerptOf('y'.repeat(120))).toHaveLength(80);
    expect(excerptOf(undefined)).toBe('');
  });
});
