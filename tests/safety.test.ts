import { describe, expect, it, vi } from 'vitest';
import {
  createSlidingWindowRateLimiter,
  filterUnsafeMessages,
  messageSafetyKey,
  runMessageTextSafetyCheck,
} from '../src/safety.js';
import type { MsgMessage } from '../src/types.js';

const messages: MsgMessage[] = [
  { id: '1', threadId: 'room', author: { id: 'a', name: 'A', initials: 'A' }, ts: 'now', text: 'one' },
  { id: '2', threadId: 'room', author: { id: 'b', name: 'B', initials: 'B' }, ts: 'now', text: 'two' },
  { id: '3', threadId: 'room', author: { id: 'c', name: 'C', initials: 'C' }, ts: 'now', text: 'three' },
];

describe('message safety primitives', () => {
  it('silently filters blocked, muted, and reported messages while preserving array identity on no-op', () => {
    expect(filterUnsafeMessages(messages)).toBe(messages);
    expect(filterUnsafeMessages(messages, {})).toBe(messages);
    expect(filterUnsafeMessages(messages, {
      blockedAuthorIds: new Set(['a']),
      mutedAuthorIds: new Set(['b']),
      hiddenMessageKeys: new Set([messageSafetyKey('room', '3')]),
    })).toEqual([]);
  });

  it('enforces a bounded sliding window and reports retry time', () => {
    const limiter = createSlidingWindowRateLimiter({ limit: 2, windowMs: 1_000 });
    expect(limiter.check('viewer', 0)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check('viewer', 100)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.check('viewer', 200)).toEqual({ allowed: false, remaining: 0, retryAfterMs: 800 });
    expect(limiter.check('viewer', 1_001)).toMatchObject({ allowed: true });
  });

  it('does not pretend text was scanned when no scanner exists', async () => {
    const record = vi.fn();
    const result = await runMessageTextSafetyCheck(
      { text: 'hello', senderId: 'a' },
      { record },
    );
    expect(result.action).toBe('review');
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ scannerAvailable: false }));
  });

  it('supports host-selected fail-closed behavior for protected entry points', async () => {
    const result = await runMessageTextSafetyCheck(
      { text: 'hello', senderId: 'a' },
      { unavailableAction: 'block', scanner: { scan: async () => { throw new Error('offline'); } } },
    );
    expect(result.action).toBe('block');
    expect(result.summary).toContain('offline');
  });
});
