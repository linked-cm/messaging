import type { MsgAuthor, MsgMessage, MsgThread } from './types.js';

/** A shared, closed reason vocabulary. Hosts may display different translated labels. */
export const MESSAGE_REPORT_REASONS = [
  'spam',
  'harassment',
  'hateSpeech',
  'violence',
  'sexualContent',
  'childSafety',
  'misinformation',
  'impersonation',
  'personalInformation',
  'other',
] as const;

export type MessageReportReason = (typeof MESSAGE_REPORT_REASONS)[number];

export interface MessageSafetySubject {
  thread: MsgThread;
  message: MsgMessage;
  author: MsgAuthor;
}

export interface MessageReportInput extends MessageSafetySubject {
  reason: MessageReportReason;
  /** Optional context. A reporter is never required to explain or repeat harmful content. */
  detail?: string;
  /** Host applications with real-world activity may choose to offer this field. */
  inPersonIncident?: boolean;
}

export interface MessageAuthorActionInput {
  thread: MsgThread;
  author: MsgAuthor;
  sourceMessage?: MsgMessage;
}

export interface MessageModerationInput extends MessageSafetySubject {
  reason?: string;
}

export interface MessageSendCheckInput {
  thread: MsgThread;
  text: string;
}

export interface MessageSendCheckResult {
  allowed: boolean;
  /** Consume the draft without revealing that moderation intervened. */
  silent?: boolean;
  /** Safe, user-facing copy. Scanner diagnostics must remain server-side. */
  message?: string;
}

/**
 * Host-owned durable safety actions used by the portable client.
 *
 * The package intentionally owns no RDF shape, database, authorization policy, or
 * moderation role. A host supplies these callbacks and persists the decisions. Matrix
 * transport reporting/ignoring remains a separate, narrower fallback.
 */
export interface MessageSafetyController {
  /** Host preflight for text sent to strangers. Runs before the transport sees it. */
  checkOutgoingText?: (
    input: MessageSendCheckInput
  ) => MessageSendCheckResult | Promise<MessageSendCheckResult>;
  reportMessage?: (input: MessageReportInput) => void | Promise<void>;
  /** A product-level block (normally bilateral and silent). */
  blockAuthor?: (input: MessageAuthorActionInput) => void | Promise<void>;
  /** A viewer-only mute. */
  muteAuthor?: (input: MessageAuthorActionInput) => void | Promise<void>;
  /** Host-authorized removal, e.g. an organizer moderation action. */
  moderateRemove?: (input: MessageModerationInput) => void | Promise<void>;
  canModerate?: (input: MessageSafetySubject) => boolean;
  /** Existing persisted state. Matching content is silently omitted, never tombstoned. */
  blockedAuthorIds?: ReadonlySet<string>;
  mutedAuthorIds?: ReadonlySet<string>;
  hiddenMessageKeys?: ReadonlySet<string>;
  /** Real-world apps may offer a distinct incident flag in the report form. */
  allowInPersonIncident?: boolean;
  /** Optional emergency copy/URL supplied by the host for its users and jurisdictions. */
  emergencyGuidance?: { text: string; href?: string };
}

/** Stable within a transport: suitable for client filtering and host report correlation. */
export const messageSafetyKey = (threadId: string, messageId: string): string =>
  `${encodeURIComponent(threadId)}:${encodeURIComponent(messageId)}`;

export interface MessageSafetyFilter {
  blockedAuthorIds?: ReadonlySet<string>;
  mutedAuthorIds?: ReadonlySet<string>;
  hiddenMessageKeys?: ReadonlySet<string>;
}

/** Pure visibility filter. It returns the original array when nothing is hidden. */
export function filterUnsafeMessages(
  messages: MsgMessage[],
  filter?: MessageSafetyFilter | null
): MsgMessage[] {
  if (!filter) return messages;
  const blocked = filter.blockedAuthorIds;
  const muted = filter.mutedAuthorIds;
  const hidden = filter.hiddenMessageKeys;
  if (!blocked?.size && !muted?.size && !hidden?.size) return messages;
  const kept = messages.filter(
    (message) =>
      !blocked?.has(message.author.id) &&
      !muted?.has(message.author.id) &&
      !hidden?.has(messageSafetyKey(message.threadId, message.id))
  );
  return kept.length === messages.length ? messages : kept;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Small in-process sliding-window guard for host routes. Distributed deployments should
 * put the same contract over shared storage (Durable Object, Redis, etc.).
 */
export function createSlidingWindowRateLimiter(options: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}) {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1, Math.floor(options.windowMs));
  const maxKeys = Math.max(1, Math.floor(options.maxKeys ?? 10_000));
  const attempts = new Map<string, number[]>();

  const trim = (key: string, now: number): number[] => {
    const recent = (attempts.get(key) ?? []).filter(
      (at) => now - at < windowMs
    );
    if (recent.length) attempts.set(key, recent);
    else attempts.delete(key);
    return recent;
  };

  return {
    check(key: string, now = Date.now()): RateLimitDecision {
      const recent = trim(key, now);
      if (recent.length >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(1, windowMs - (now - recent[0]!)),
        };
      }
      recent.push(now);
      attempts.set(key, recent);
      // Bound memory even when an attacker rotates keys. Oldest insertion is discarded.
      while (attempts.size > maxKeys) {
        const oldest = attempts.keys().next().value as string | undefined;
        if (!oldest) break;
        attempts.delete(oldest);
      }
      return {
        allowed: true,
        remaining: limit - recent.length,
        retryAfterMs: 0,
      };
    },
    clear(key: string): void {
      attempts.delete(key);
    },
  };
}

export type MessageSafetyCategory =
  | 'spam'
  | 'harassment'
  | 'hateSpeech'
  | 'violence'
  | 'sexualContent'
  | 'childSafety'
  | 'selfHarm'
  | 'personalInformation'
  | 'crime'
  | 'other';

export type MessageScanAction = 'allow' | 'review' | 'block';
export type MessageScanEnforcement = 'suppress' | 'freezeAccount';

export interface MessageScanResult {
  action: MessageScanAction;
  categories?: readonly MessageSafetyCategory[];
  /** Host action requested by the scanner. The host owns persistence and enforcement. */
  enforcement?: MessageScanEnforcement;
  /** For moderators/audit records. Never display scanner diagnostics to a target. */
  summary?: string;
}

export interface MessageTextScanner {
  scan(input: {
    text: string;
    senderId: string;
    recipientIds?: readonly string[];
    context?: Record<string, unknown>;
  }): Promise<MessageScanResult>;
}

/**
 * Runs an injected scanner without pretending the package contains a safety model.
 * Missing/broken scanning follows the host-selected outage policy and remains auditable.
 */
export async function runMessageTextSafetyCheck(
  input: Parameters<MessageTextScanner['scan']>[0],
  options: {
    scanner?: MessageTextScanner;
    unavailableAction?: Exclude<MessageScanAction, 'allow'>;
    record?: (
      result: MessageScanResult & { scannerAvailable: boolean }
    ) => void | Promise<void>;
  }
): Promise<MessageScanResult> {
  const unavailable = (summary: string): MessageScanResult => ({
    action: options.unavailableAction ?? 'review',
    summary,
  });
  if (!options.scanner) {
    const result = unavailable('No message text scanner is configured');
    await options.record?.({ ...result, scannerAvailable: false });
    return result;
  }
  try {
    const result = await options.scanner.scan(input);
    if (!['allow', 'review', 'block'].includes(result.action)) {
      throw new Error('Scanner returned an invalid action');
    }
    if (
      result.enforcement &&
      !['suppress', 'freezeAccount'].includes(result.enforcement)
    ) {
      throw new Error('Scanner returned an invalid enforcement');
    }
    await options.record?.({ ...result, scannerAvailable: true });
    return result;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const result = unavailable(`Message text scanner failed: ${message}`);
    await options.record?.({ ...result, scannerAvailable: false });
    return result;
  }
}
