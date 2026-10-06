// @_linked/messaging — shape-agnostic messaging contracts. A transport package (Matrix homeserver +
// appservice, or any other LINKED-backed transport) implements the same `Messaging` interface, so the
// engine and the UI never learn which one is running. This file knows NOTHING of any host's channel
// taxonomy, branding, or interactive-card vocabulary — hosts inject those.
// Mirrors the calendar split: generic CalEventData ⇄ Calendar engine = generic Msg* ⇄ MessageClient.

/** Privacy tiers a transport maps onto its own room/visibility model (public/team/personal). */
export type PrivacyTier = 'public' | 'team' | 'personal';

/** A messaging space — a team (team/public tier, shown as a rail squircle with a channel tree) OR a direct
 *  conversation (personal tier: a 1:1, a group chat, or the assistant). `groupLabel` is an opaque host tag. */
export interface MsgSpace {
  id: string;
  name: string;
  initials: string;
  tier: PrivacyTier;
  /** opaque host label shown next to the space name (e.g. a category or class label) */
  groupLabel?: string;
  /** squircle/accent colour for the team rail (e.g. a brand or category colour) */
  accent?: string;
  /** team locality line shown in the channel-tree header */
  region?: string;
  /** team-rail unread badge + ping (red) state */
  unread?: number;
  ping?: boolean;
  /** direct conversations: kind + favourite flag (for the Direct list) */
  dmKind?: 'person' | 'group' | 'ally';
  fav?: boolean;
  /** externally-hosted team (set PER TEAM) — chat lives on another platform; the host holds identity + invite handoff */
  external?: { provider: string; members?: string; invite?: string };
}

/** A thread (channel) within a space. `kind`/`family` are opaque to the engine — the host maps them to
 *  icons and rail groupings (host-defined kinds and rail families). */
export interface MsgThread {
  id: string;
  spaceId: string;
  title: string;
  tier: PrivacyTier;
  kind?: string;
  family?: string;
  topic?: string;
  unread?: number;
  live?: boolean;
  progress?: number; // 0..1, for goal-style threads
  readOnly?: boolean; // broadcast threads disable the composer
  locked?: boolean; // restricted channel (e.g. captains-only)
  description?: string; // channel intro line in the message-view header
  /** Host-defined audience key for who this thread carries; the host gates by viewer.
   *  Per-thread, never system-wide: audience + encryption are properties of EACH thread.
   *  The engine only carries the value — it never renders or interprets it. */
  audience?: string;
  /** true when the underlying room actually carries E2EE (live transport fact —
   *  the ONLY permitted source for the encrypted shield; never inferred from tier). */
  encrypted?: boolean;
  /** display names of OTHER members composing right now (plan 036 P4) — the transport
   *  excludes the viewer and bot puppets; absent/empty = nobody is typing. */
  typing?: string[];
}

/** A prepared outgoing attachment (plan 036 P1). The host pipeline
 *  re-encodes/strips metadata BEFORE this crosses the seam — transports never see raw camera files. */
export interface MediaUpload {
  kind: 'image' | 'file';
  blob: Blob;
  name: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface MsgAuthor {
  id: string;
  name: string;
  initials: string;
  bot?: boolean; // render with the host's bot avatar
}

export interface MsgMessage {
  id: string;
  threadId: string;
  author: MsgAuthor;
  ts: string; // pre-formatted display time (the real client formats from origin_server_ts)
  text?: string;
  mine?: boolean;
  reactions?: [string, number][];
  /** emoji the VIEWER reacted with (subset of `reactions` keys) — drives chip toggle state */
  myReactions?: string[];
  /** quoted-context line for a reply (m.in_reply_to on Matrix), resolved from the timeline */
  replyTo?: { id: string; authorName: string; excerpt: string };
  /** content was replaced (m.replace on Matrix) — renders a subtle "(edited)" marker */
  edited?: boolean;
  pin?: boolean; // pinned/important message
  role?: string; // author role label (Captain, Host org…)
  verified?: boolean; // verified author (shield)
  /** opaque host payload rendered via MessageClient's `renderCard` (e.g. an interactive card) */
  data?: unknown;
  /** an attachment (m.image / m.file on Matrix) — `url` is directly renderable (http/objectURL) */
  media?: {
    kind: 'image' | 'file';
    url: string;
    name: string;
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
  };
}

/** The transport seam. `createMessagingStore` is the in-memory implementation; @_linked/matrix is the live one. */
export interface Messaging {
  spaces(): MsgSpace[];
  threads(spaceId: string): MsgThread[];
  messages(threadId: string): MsgMessage[];
  send(threadId: string, text: string): void;
  /** post an opaque host payload (e.g. an interactive card). Additive/optional:
   *  transports without card support simply don't offer it. */
  sendData?(threadId: string, data: unknown, fallbackText?: string): void;
  /** post a prepared attachment (Matrix: uploadContent → m.image / m.file). Optional/additive:
   *  transports without media support simply don't offer it — the UI never shows a dead skill. */
  sendMedia?(threadId: string, upload: MediaUpload): void;
  /** post a BODY-LESS host signal event (Matrix: a custom event type with exactly `content`) —
   *  for aggregation-only vocabulary that must never render in any client (e.g. poll
   *  responses/closes). Unlike sendData, no fallback body is added: non-host clients show
   *  nothing. Optional/additive. */
  sendSignal?(threadId: string, type: string, content: Record<string, unknown>): void;
  /** react to a message with an emoji (Matrix: m.reaction / m.annotation). Optional/additive. */
  react?(threadId: string, eventId: string, emoji: string): void;
  /** withdraw the VIEWER's own reaction (Matrix: redact own m.reaction event). Optional/additive. */
  unreact?(threadId: string, eventId: string, emoji: string): void;
  /** send a threaded reply (Matrix: m.in_reply_to with the rich-reply fallback body). Optional/additive. */
  sendReply?(threadId: string, text: string, inReplyToEventId: string): void;
  /** replace the text of the VIEWER's own message (Matrix: m.replace / m.new_content). Optional/additive. */
  edit?(threadId: string, eventId: string, newText: string): void;
  /** delete a message (Matrix: redaction). Optional/additive. */
  remove?(threadId: string, eventId: string): void;
  /** the VIEWER started (true) / stopped (false) composing in a thread (Matrix: m.typing,
   *  plan 036 P4). Callers may fire on every keystroke — the transport throttles. The
   *  viewer's own typing never projects back onto `MsgThread.typing`. Optional/additive. */
  setTyping?(threadId: string, typing: boolean): void;
  /** the viewer is LOOKING at a thread — mark it read up to its latest event (Matrix: read
   *  receipt on the newest timeline event; clears the unread badge). Repeat calls with no
   *  newer event are no-ops, so effects may fire it freely. Optional/additive. */
  markRead?(threadId: string): void;
  subscribe(fn: () => void): () => void;
  /** monotonic version for useSyncExternalStore */
  version(): number;
  /** run a topology mutation (add a space/thread) and notify subscribers — the seam DM creation uses. */
  mutate(fn: () => void): void;
}

/** Seed for the in-memory store factory. */
export interface MessagingSeed {
  spaces: MsgSpace[];
  threads: MsgThread[];
  messages: Record<string, MsgMessage[]>;
  /**
   * Display author stamped on messages this store appends. Not an authenticated
   * identity: the store never checks who is signed in and never invents a person.
   * A function is read on each send so it can follow the host's verified session.
   * A constant author is demo or test data — do not ship one as a stand-in for
   * the signed-in user.
   */
  me: MsgAuthor | (() => MsgAuthor);
}
