// @_linked/messaging — the public, shape-agnostic messaging engine.
//
// This package knows nothing about any host's domain: no channel taxonomy, no
// interactive-card vocabulary, no theming decisions. A host maps its domain onto
// the Msg* contracts and renders MessageClient; a transport package (e.g.
// @_linked/matrix) implements `Messaging` so the same UI runs live with no
// component changes.
import './package.js';

export * from './package.js';
export type {
  MediaUpload,
  Messaging,
  MessagingSeed,
  MsgAuthor,
  MsgMessage,
  MsgSpace,
  MsgThread,
  PrivacyTier,
} from './types.js';
export {
  MESSAGE_REPORT_REASONS,
  createSlidingWindowRateLimiter,
  filterUnsafeMessages,
  messageSafetyKey,
  runMessageTextSafetyCheck,
  type MessageAuthorActionInput,
  type MessageModerationInput,
  type MessageReportInput,
  type MessageReportReason,
  type MessageSafetyCategory,
  type MessageSafetyController,
  type MessageSafetyFilter,
  type MessageSafetySubject,
  type MessageScanAction,
  type MessageScanResult,
  type MessageTextScanner,
  type RateLimitDecision,
} from './safety.js';
export { createMessagingStore, excerptOf, useMessagingStore } from './store.js';
export {
  MessageClient,
  type MessageClientProps,
  type MessageSafetyLabels,
} from './MessageClient.js';
