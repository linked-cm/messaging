import React from 'react';
import type {
  Messaging,
  MsgThread,
  MsgSpace,
  MsgAuthor,
  MsgMessage,
  PrivacyTier,
} from './types.js';
import {
  MESSAGE_REPORT_REASONS,
  filterUnsafeMessages,
  messageSafetyKey,
  type MessageReportReason,
  type MessageSafetyController,
} from './safety.js';
import { useMessagingStore } from './store.js';
import style from './MessageClient.module.css';

// MessageClient — the themeable chat client. A space rail with the personal space pinned on top, a
// per-space channel tree OR an external-platform invite handoff OR a direct list, a message view, and a
// density toggle that doubles as the mobile drill. All host LOGIC (channel taxonomy, families, cards,
// avatars, composer) arrives through render props, so the engine stays shape-agnostic; swapping the
// in-memory store for a live transport such as @_linked/matrix changes no component code.

type Density = 'full' | 'list' | 'focus';

function useNarrow(): boolean {
  const get = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 860px)').matches
      : false;
  const [narrow, setNarrow] = React.useState(get);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 860px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const defaultExternalNote = (provider: string) =>
  `This space runs its chat on ${provider}. Scan the code with your phone, or tap below.`;

const DEFAULT_REASON_LABELS: Record<MessageReportReason, string> = {
  spam: 'Spam or scam',
  harassment: 'Harassment or bullying',
  hateSpeech: 'Hate speech',
  violence: 'Violence or threats',
  sexualContent: 'Nudity or sexual content',
  childSafety: 'Child safety',
  misinformation: 'False information',
  impersonation: 'Impersonation',
  personalInformation: 'Private personal information',
  other: 'Something else',
};

export interface MessageSafetyLabels {
  actions: string;
  report: string;
  mute: string;
  block: string;
  remove: string;
  reportTitle: string;
  reportReason: string;
  reportDetail: string;
  inPersonIncident: string;
  submitReport: string;
  cancel: string;
  safetyError: string;
  reasonLabels: Partial<Record<MessageReportReason, string>>;
}

const DEFAULT_SAFETY_LABELS: MessageSafetyLabels = {
  actions: 'Message safety actions',
  report: 'Report',
  mute: 'Mute sender',
  block: 'Block sender',
  remove: 'Remove message',
  reportTitle: 'Report message',
  reportReason: 'Why are you reporting this?',
  reportDetail: 'Anything you want the safety team to know (optional)',
  inPersonIncident: 'This also happened in person',
  submitReport: 'Submit report',
  cancel: 'Cancel',
  safetyError: 'That safety action could not be completed. Please try again.',
  reasonLabels: DEFAULT_REASON_LABELS,
};

export interface MessageClientProps {
  store: Messaging;
  activeThreadId: string;
  onActiveThread: (id: string) => void;
  threadIcon: (t: MsgThread) => React.ReactNode;
  familyOrder?: string[];
  familyLabel?: (family: string) => string;
  tierIcon?: (tier: PrivacyTier) => React.ReactNode;
  tierNote?: (tier: PrivacyTier) => string;
  renderCard?: (data: unknown, thread: MsgThread) => React.ReactNode;
  renderAvatar?: (author: MsgAuthor) => React.ReactNode;
  botAvatar?: React.ReactNode;
  readOnlyNote?: React.ReactNode;
  /** Optional presentational slots — a host swaps in its own design-system components while the engine
   *  keeps the layout / density / drill logic. All default to the built-in rendering (API stays intact). */
  renderRailItem?: (
    space: MsgSpace,
    active: boolean,
    open: () => void
  ) => React.ReactNode;
  renderThreadRow?: (
    t: MsgThread,
    active: boolean,
    open: () => void
  ) => React.ReactNode;
  renderMessage?: (msg: MsgMessage, thread: MsgThread) => React.ReactNode;
  renderComposer?: (
    thread: MsgThread,
    send: (text: string) => void
  ) => React.ReactNode;
  renderTierBadge?: (t: MsgThread) => React.ReactNode;
  /** Durable host safety policy and actions. Transport-native report/ignore are used as
   *  additional fallbacks; a Matrix ignore is never presented as a bilateral block. */
  safety?: MessageSafetyController;
  /** Translated host copy for the built-in safety UI. */
  safetyLabels?: Partial<Omit<MessageSafetyLabels, 'reasonLabels'>> & {
    reasonLabels?: Partial<Record<MessageReportReason, string>>;
  };
  directLabel?: string;
  providerLabel?: (provider: string) => string;
  onAddTeam?: () => void;
  /** Render a scan-to-join code for an external-platform invite. Omit and the code is simply not shown. */
  renderQR?: (value: string, size: number) => React.ReactNode;
  /** Copy explaining that a space's chat lives on another platform. Defaults to a neutral sentence. */
  externalNote?: (provider: string) => string;
  /** scrollTop of the reading pane — hosts use it for swipe-hide nav patterns. */
  onPaneScroll?: (top: number) => void;
  /** true while the user is INSIDE a conversation (the mobile focus view) — hosts hide app chrome there. */
  onConversationChange?: (open: boolean) => void;
}

export const MessageClient: React.FC<MessageClientProps> = ({
  store,
  activeThreadId,
  onActiveThread,
  threadIcon,
  familyOrder,
  familyLabel,
  tierIcon,
  tierNote,
  renderCard,
  renderAvatar,
  botAvatar,
  readOnlyNote = 'Read only',
  directLabel = 'Direct',
  providerLabel = cap,
  renderQR,
  externalNote = defaultExternalNote,
  onAddTeam,
  onPaneScroll,
  onConversationChange,
  renderRailItem,
  renderThreadRow,
  renderMessage,
  renderComposer,
  renderTierBadge,
  safety,
  safetyLabels,
}) => {
  const m = useMessagingStore(store);
  const spaces = m.spaces();
  const teams = spaces.filter((s) => s.tier !== 'personal');
  const directs = spaces.filter((s) => s.tier === 'personal');

  const allThreads = spaces.flatMap((s) => m.threads(s.id));
  const activeThread =
    allThreads.find((t) => t.id === activeThreadId) ?? allThreads[0];
  const activeSpace =
    spaces.find((s) => s.id === activeThread?.spaceId) ?? teams[0];

  const [section, setSection] = React.useState<'teams' | 'direct'>(
    activeSpace?.tier === 'personal' ? 'direct' : 'teams'
  );
  const [teamId, setTeamId] = React.useState(
    activeSpace?.tier !== 'personal' ? activeSpace?.id : teams[0]?.id
  );
  const narrow = useNarrow();
  const [density, setDensity] = React.useState<Density>('full');
  React.useEffect(() => setDensity(narrow ? 'list' : 'full'), [narrow]);
  // "in a conversation" = the mobile drill-in (focus). List/teams/overview keep the app chrome.
  const inConversation = narrow && density === 'focus';
  React.useEffect(() => {
    onConversationChange?.(inConversation);
    return () => onConversationChange?.(false);
  }, [inConversation, onConversationChange]);

  const team = teams.find((t) => t.id === teamId) ?? teams[0];
  const channels = team ? m.threads(team.id) : [];
  const order =
    familyOrder ??
    Array.from(
      new Set(channels.map((t) => t.family).filter(Boolean) as string[])
    );

  const pick = (id: string) => {
    onActiveThread(id);
    if (narrow) setDensity('focus'); // drill into the message view on mobile
  };
  const openTeam = (id: string) => {
    setSection('teams');
    setTeamId(id);
    const first = m.threads(id)[0];
    if (first) onActiveThread(first.id);
  };
  const openDirect = () => {
    setSection('direct');
    const first = directs.flatMap((s) => m.threads(s.id))[0];
    if (first) onActiveThread(first.id);
  };

  const showLeft = density !== 'focus';
  const showMain = density !== 'list';
  const cycle = () =>
    setDensity((d) =>
      d === 'full' ? 'list' : d === 'list' ? 'focus' : 'full'
    );

  return (
    <div className={style.client} data-density={density}>
      {showLeft && (
        <div className={style.left}>
          {/* team rail — Personal on top, then team squircles */}
          <nav className={style.rail} aria-label="Teams">
            <button
              type="button"
              className={style.personal}
              data-active={section === 'direct' || undefined}
              onClick={openDirect}
              aria-label={directLabel}
            >
              {tierIcon ? tierIcon('personal') : '✉'}
            </button>
            <span className={style.railDiv} aria-hidden />
            {teams.map((t) =>
              renderRailItem ? (
                <React.Fragment key={t.id}>
                  {renderRailItem(
                    t,
                    section === 'teams' && t.id === team?.id,
                    () => openTeam(t.id)
                  )}
                </React.Fragment>
              ) : (
                <button
                  key={t.id}
                  type="button"
                  className={style.squircle}
                  data-active={
                    section === 'teams' && t.id === team?.id ? true : undefined
                  }
                  style={{
                    ['--a' as string]: t.accent ?? 'var(--control-accent)',
                  }}
                  onClick={() => openTeam(t.id)}
                  title={t.name}
                >
                  {t.initials}
                  {t.external && <span className={style.extDot} aria-hidden />}
                  {t.unread ? (
                    <span
                      className={style.railBadge}
                      data-ping={t.ping || undefined}
                    >
                      {t.unread}
                    </span>
                  ) : null}
                </button>
              )
            )}
            {onAddTeam && (
              <button
                type="button"
                className={style.add}
                onClick={onAddTeam}
                aria-label="Add team"
              >
                +
              </button>
            )}
          </nav>

          {/* column: channel tree / external invite / direct list */}
          <div className={style.col}>
            {section === 'direct' ? (
              <DirectList
                store={m}
                directs={directs}
                activeThreadId={activeThreadId}
                onPick={pick}
                label={directLabel}
                renderAvatar={renderAvatar}
                botAvatar={botAvatar}
              />
            ) : team?.external ? (
              <ExternalInvite
                team={team}
                providerLabel={providerLabel}
                externalNote={externalNote}
                renderQR={renderQR}
                compact
              />
            ) : (
              team && (
                <div className={style.tree}>
                  <div className={style.treeHead}>
                    <span className={style.treeName}>{team.name}</span>
                    {team.region && (
                      <span className={style.treeRegion}>{team.region}</span>
                    )}
                  </div>
                  {order.map((fam) => {
                    const ts = channels.filter((t) => t.family === fam);
                    if (!ts.length) return null;
                    return (
                      <div key={fam} className={style.family}>
                        <span className={style.familyLabel}>
                          {familyLabel ? familyLabel(fam) : fam}
                        </span>
                        {ts.map((t) =>
                          renderThreadRow ? (
                            <React.Fragment key={t.id}>
                              {renderThreadRow(t, t.id === activeThreadId, () =>
                                pick(t.id)
                              )}
                            </React.Fragment>
                          ) : (
                            <ChannelRow
                              key={t.id}
                              t={t}
                              active={t.id === activeThreadId}
                              onClick={() => pick(t.id)}
                              icon={threadIcon(t)}
                              lockIcon={tierIcon?.('team')}
                            />
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {showMain && (
        <main className={style.main}>
          {section === 'teams' && team?.external ? (
            <ExternalView
              team={team}
              providerLabel={providerLabel}
              externalNote={externalNote}
              renderQR={renderQR}
              onBack={() => setDensity('list')}
              onCycle={cycle}
            />
          ) : activeThread ? (
            <ConversationView
              thread={activeThread}
              messages={m.messages(activeThread.id)}
              onSend={(text) => m.send(activeThread.id, text)}
              onBack={() => setDensity('list')}
              onCycle={cycle}
              threadIcon={threadIcon}
              tierIcon={tierIcon}
              tierNote={tierNote}
              renderCard={renderCard}
              renderAvatar={renderAvatar}
              botAvatar={botAvatar}
              readOnlyNote={readOnlyNote}
              onPaneScroll={onPaneScroll}
              renderMessage={renderMessage}
              renderComposer={renderComposer}
              renderTierBadge={renderTierBadge}
              store={m}
              safety={safety}
              safetyLabels={safetyLabels}
            />
          ) : null}
        </main>
      )}
    </div>
  );
};

// ── channel row ──
const ChannelRow: React.FC<{
  t: MsgThread;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  lockIcon?: React.ReactNode;
}> = ({ t, active, onClick, icon, lockIcon }) => (
  <button
    type="button"
    className={style.thread}
    data-active={active || undefined}
    onClick={onClick}
  >
    <span className={style.thIcon}>{icon}</span>
    <span className={style.thLabel}>{t.title}</span>
    {t.locked && (
      <span className={style.lock} aria-hidden>
        {lockIcon ?? '🔒'}
      </span>
    )}
    {t.readOnly && (
      <span className={style.lock} aria-hidden>
        {lockIcon}
      </span>
    )}
    {t.live && <span className={style.live} />}
    {t.unread ? <span className={style.badge}>{t.unread}</span> : null}
    {t.progress != null && (
      <span className={style.prog} aria-hidden>
        <span
          className={style.progFill}
          style={{ width: `${Math.round(t.progress * 100)}%` }}
        />
      </span>
    )}
  </button>
);

// ── direct list (favourites · people · groups) ──
const DirectList: React.FC<{
  store: Messaging;
  directs: MsgSpace[];
  activeThreadId: string;
  onPick: (id: string) => void;
  label: string;
  renderAvatar?: (a: MsgAuthor) => React.ReactNode;
  botAvatar?: React.ReactNode;
}> = ({
  store,
  directs,
  activeThreadId,
  onPick,
  label,
  renderAvatar,
  botAvatar,
}) => {
  const row = (s: MsgSpace) => {
    const th = store.threads(s.id)[0];
    if (!th) return null;
    const msgs = store.messages(th.id);
    const last = msgs[msgs.length - 1];
    const author: MsgAuthor = {
      id: s.id,
      name: s.name,
      initials: s.initials,
      bot: s.dmKind === 'ally',
    };
    return (
      <button
        key={s.id}
        type="button"
        className={style.convo}
        data-active={th.id === activeThreadId || undefined}
        onClick={() => onPick(th.id)}
      >
        <span className={style.convoAvatar}>
          {author.bot && botAvatar ? (
            botAvatar
          ) : renderAvatar ? (
            renderAvatar(author)
          ) : (
            <span className={style.avatar}>{s.initials}</span>
          )}
        </span>
        <span className={style.convoBody}>
          <span className={style.convoTop}>
            <span className={style.convoName}>{s.name}</span>
            {last && <span className={style.convoWhen}>{last.ts}</span>}
          </span>
          <span className={style.convoLast}>
            {last
              ? `${last.mine ? 'You: ' : ''}${last.text ?? '—'}`
              : 'No messages yet'}
          </span>
        </span>
        {s.unread ? <span className={style.badge}>{s.unread}</span> : null}
      </button>
    );
  };
  const favs = directs.filter((s) => s.fav);
  const people = directs.filter((s) => !s.fav && s.dmKind !== 'group');
  const groups = directs.filter((s) => !s.fav && s.dmKind === 'group');
  return (
    <div className={style.tree}>
      <div className={style.treeHead}>
        <span className={style.treeName}>{label}</span>
      </div>
      {favs.length > 0 && (
        <div className={style.family}>
          <span className={style.familyLabel}>Favorites</span>
          {favs.map(row)}
        </div>
      )}
      {people.length > 0 && (
        <div className={style.family}>
          <span className={style.familyLabel}>People</span>
          {people.map(row)}
        </div>
      )}
      {groups.length > 0 && (
        <div className={style.family}>
          <span className={style.familyLabel}>Groups</span>
          {groups.map(row)}
        </div>
      )}
    </div>
  );
};

// ── external-team invite (chat lives on Discord / Slack / WhatsApp) ──
const ExternalInvite: React.FC<{
  team: MsgSpace;
  providerLabel: (p: string) => string;
  externalNote: (provider: string) => string;
  renderQR?: (value: string, size: number) => React.ReactNode;
  compact?: boolean;
}> = ({ team, providerLabel, externalNote, renderQR, compact }) => {
  const inviteUrl = team.external!.invite
    ? `https://${team.external!.invite.replace(/^https?:\/\//, '')}`
    : undefined;
  return (
    <div className={style.tree}>
      <div className={style.treeHead}>
        <span className={style.treeName}>{team.name}</span>
        {team.region && <span className={style.treeRegion}>{team.region}</span>}
      </div>
      <div className={style.extCard}>
        <div className={style.extProvider}>
          {providerLabel(team.external!.provider)}
        </div>
        {team.external!.members && (
          <div className={style.extMeta}>{team.external!.members} members</div>
        )}
        {!compact && (
          <p className={style.extNote}>
            {externalNote(providerLabel(team.external!.provider))}
          </p>
        )}
        {/* Scan-to-join code — host-supplied, main pane only. */}
        {!compact && inviteUrl && renderQR && (
          <div className={style.extQr}>{renderQR(inviteUrl, 148)}</div>
        )}
        {inviteUrl && (
          <a
            className={style.extBtn}
            href={inviteUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in {providerLabel(team.external!.provider)} ↗
          </a>
        )}
      </div>
    </div>
  );
};

// ── external-team main pane (chat lives elsewhere) ──
const ExternalView: React.FC<{
  team: MsgSpace;
  providerLabel: (p: string) => string;
  externalNote: (provider: string) => string;
  renderQR?: (value: string, size: number) => React.ReactNode;
  onBack: () => void;
  onCycle: () => void;
}> = ({ team, providerLabel, externalNote, renderQR, onBack, onCycle }) => (
  <>
    <header className={style.head}>
      <button
        type="button"
        className={style.back}
        onClick={onBack}
        aria-label="Back"
      >
        ‹
      </button>
      <span className={style.headTitle}>{team.name}</span>
      <span className={style.headTopic}>
        Hosted on {providerLabel(team.external!.provider)}
      </span>
    </header>
    <div className={style.extPane}>
      <ExternalInvite
        team={team}
        providerLabel={providerLabel}
        externalNote={externalNote}
        renderQR={renderQR}
      />
    </div>
  </>
);

// ── conversation (channel / dm) message view ──
const ConversationView: React.FC<{
  store: Messaging;
  thread: MsgThread;
  messages: MsgMessage[];
  onSend: (text: string) => void;
  onBack: () => void;
  onCycle: () => void;
  threadIcon: (t: MsgThread) => React.ReactNode;
  tierIcon?: (tier: PrivacyTier) => React.ReactNode;
  tierNote?: (tier: PrivacyTier) => string;
  renderCard?: (data: unknown, thread: MsgThread) => React.ReactNode;
  renderAvatar?: (a: MsgAuthor) => React.ReactNode;
  botAvatar?: React.ReactNode;
  readOnlyNote: React.ReactNode;
  onPaneScroll?: (top: number) => void;
  renderMessage?: (msg: MsgMessage, thread: MsgThread) => React.ReactNode;
  renderComposer?: (
    thread: MsgThread,
    send: (text: string) => void
  ) => React.ReactNode;
  renderTierBadge?: (t: MsgThread) => React.ReactNode;
  safety?: MessageSafetyController;
  safetyLabels?: MessageClientProps['safetyLabels'];
}> = ({
  store,
  thread,
  messages,
  onSend,
  onBack,
  onCycle,
  threadIcon,
  tierIcon,
  tierNote,
  renderCard,
  renderAvatar,
  botAvatar,
  readOnlyNote,
  onPaneScroll,
  renderMessage,
  renderComposer,
  renderTierBadge,
  safety,
  safetyLabels,
}) => {
  const [draft, setDraft] = React.useState('');
  const [reporting, setReporting] = React.useState<MsgMessage | null>(null);
  const [reportReason, setReportReason] = React.useState<
    MessageReportReason | ''
  >('');
  const [reportDetail, setReportDetail] = React.useState('');
  const [inPersonIncident, setInPersonIncident] = React.useState(false);
  const [safetyBusy, setSafetyBusy] = React.useState(false);
  const [safetyError, setSafetyError] = React.useState('');
  const [sendSafetyBusy, setSendSafetyBusy] = React.useState(false);
  const [sendSafetyError, setSendSafetyError] = React.useState('');
  const [hiddenMessages, setHiddenMessages] = React.useState<Set<string>>(
    () => new Set()
  );
  const [mutedAuthors, setMutedAuthors] = React.useState<Set<string>>(
    () => new Set()
  );
  const [blockedAuthors, setBlockedAuthors] = React.useState<Set<string>>(
    () => new Set()
  );
  const labels: MessageSafetyLabels = {
    ...DEFAULT_SAFETY_LABELS,
    ...safetyLabels,
    reasonLabels: {
      ...DEFAULT_SAFETY_LABELS.reasonLabels,
      ...safetyLabels?.reasonLabels,
    },
  };
  const mergedSet = (
    persisted?: ReadonlySet<string>,
    local?: ReadonlySet<string>
  ) => new Set([...(persisted ?? []), ...(local ?? [])]);
  const visibleMessages = filterUnsafeMessages(messages, {
    blockedAuthorIds: mergedSet(safety?.blockedAuthorIds, blockedAuthors),
    mutedAuthorIds: mergedSet(safety?.mutedAuthorIds, mutedAuthors),
    hiddenMessageKeys: mergedSet(safety?.hiddenMessageKeys, hiddenMessages),
  });
  const send = async () => {
    const v = draft.trim();
    if (!v || sendSafetyBusy) return;
    setSendSafetyError('');
    if (safety?.checkOutgoingText) {
      setSendSafetyBusy(true);
      try {
        const result = await safety.checkOutgoingText({ thread, text: v });
        if (!result.allowed) {
          if (result.silent) {
            setDraft('');
            return;
          }
          setSendSafetyError(result.message || labels.safetyError);
          return;
        }
      } catch {
        setSendSafetyError(labels.safetyError);
        return;
      } finally {
        setSendSafetyBusy(false);
      }
    }
    onSend(v);
    setDraft('');
  };
  const avatarFor = (a: MsgAuthor) =>
    a.bot && botAvatar ? (
      botAvatar
    ) : renderAvatar ? (
      renderAvatar(a)
    ) : (
      <span className={style.avatar}>{a.initials}</span>
    );

  const completeAction = async (
    action: () => void | Promise<void>,
    after: () => void
  ) => {
    setSafetyBusy(true);
    setSafetyError('');
    try {
      await action();
      after();
    } catch {
      setSafetyError(labels.safetyError);
    } finally {
      setSafetyBusy(false);
    }
  };

  const report = async () => {
    if (!reporting || !reportReason) return;
    const subject = { thread, message: reporting, author: reporting.author };
    const actions: Array<Promise<void>> = [];
    if (safety?.reportMessage) {
      actions.push(
        Promise.resolve(
          safety.reportMessage({
            ...subject,
            reason: reportReason,
            detail: reportDetail.trim() || undefined,
            inPersonIncident: inPersonIncident || undefined,
          })
        )
      );
    }
    if (store.report) {
      const detail = reportDetail.trim();
      actions.push(
        Promise.resolve(
          store.report(thread.id, reporting.id, {
            reason: detail ? `${reportReason}: ${detail}` : reportReason,
            score: -100,
          })
        )
      );
    }
    if (!actions.length) return;
    await completeAction(
      async () => {
        const outcomes = await Promise.allSettled(actions);
        if (!outcomes.some((outcome) => outcome.status === 'fulfilled')) {
          throw (outcomes[0] as PromiseRejectedResult | undefined)?.reason;
        }
      },
      () => {
        setHiddenMessages((current) =>
          new Set(current).add(messageSafetyKey(thread.id, reporting.id))
        );
        setReporting(null);
        setReportReason('');
        setReportDetail('');
        setInPersonIncident(false);
      }
    );
  };

  const mute = (message: MsgMessage) =>
    completeAction(
      async () => {
        if (safety?.muteAuthor) {
          await safety.muteAuthor({
            thread,
            author: message.author,
            sourceMessage: message,
          });
        } else if (store.ignoreAuthor) {
          await store.ignoreAuthor(message.author.id);
        }
      },
      () =>
        setMutedAuthors((current) => new Set(current).add(message.author.id))
    );

  const block = (message: MsgMessage) =>
    completeAction(
      async () => {
        if (!safety?.blockAuthor) return;
        await safety.blockAuthor({
          thread,
          author: message.author,
          sourceMessage: message,
        });
        // Defense in depth. Failure to mirror the durable host block into Matrix ignore
        // does not undo the host decision.
        await Promise.resolve(store.ignoreAuthor?.(message.author.id)).catch(
          () => undefined
        );
      },
      () =>
        setBlockedAuthors((current) => new Set(current).add(message.author.id))
    );

  return (
    <>
      <header className={style.head}>
        <button
          type="button"
          className={style.back}
          onClick={onBack}
          aria-label="Back"
        >
          ‹
        </button>
        <span className={style.headTitle}>
          <span className={style.headIcon}>{threadIcon(thread)}</span>{' '}
          {thread.title}
        </span>
        <span className={style.headTopic}>
          {thread.description || thread.topic
            ? `${thread.description || thread.topic} · `
            : ''}
          {renderTierBadge
            ? renderTierBadge(thread)
            : tierNote && (
                <span className={style.tierNote}>
                  {tierIcon?.(thread.tier)} {tierNote(thread.tier)}
                </span>
              )}
        </span>
      </header>

      <div
        className={style.messages}
        onScroll={(e) => onPaneScroll?.((e.target as HTMLElement).scrollTop)}
      >
        {renderMessage
          ? visibleMessages.map((msg) => (
              <React.Fragment key={msg.id}>
                {renderMessage(msg, thread)}
              </React.Fragment>
            ))
          : visibleMessages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.pin
                    ? `${style.msg} ${style.pinned}`
                    : msg.mine
                      ? `${style.msg} ${style.mine}`
                      : style.msg
                }
              >
                <span className={style.msgAvatar}>{avatarFor(msg.author)}</span>
                <div className={style.msgBody}>
                  <div className={style.msgHead}>
                    <span className={style.msgWho}>{msg.author.name}</span>
                    {msg.role && (
                      <span className={style.msgRole}>{msg.role}</span>
                    )}
                    {msg.verified && (
                      <span className={style.msgVerified} aria-label="verified">
                        {tierIcon?.('team') ?? '✓'}
                      </span>
                    )}
                    <span className={style.msgTime}>{msg.ts}</span>
                    {msg.pin && <span className={style.pinTag}>PINNED</span>}
                  </div>
                  {msg.text && (
                    <div
                      className={
                        msg.author.bot
                          ? `${style.bubble} ${style.botBubble}`
                          : style.bubble
                      }
                    >
                      {msg.text}
                    </div>
                  )}
                  {msg.data != null && renderCard?.(msg.data, thread)}
                  {msg.reactions && (
                    <div className={style.reactions}>
                      {msg.reactions.map(([emoji, n]) => (
                        <span key={emoji} className={style.reaction}>
                          {emoji} {n}
                        </span>
                      ))}
                    </div>
                  )}
                  {(msg.mine
                    ? !!store.remove
                    : !!(
                        safety?.reportMessage ||
                        store.report ||
                        safety?.muteAuthor ||
                        store.ignoreAuthor ||
                        safety?.blockAuthor ||
                        (safety?.moderateRemove &&
                          safety.canModerate?.({
                            thread,
                            message: msg,
                            author: msg.author,
                          }))
                      )) && (
                    <div
                      className={style.safetyActions}
                      role="toolbar"
                      aria-label={labels.actions}
                    >
                      {msg.mine && store.remove && (
                        <button
                          type="button"
                          onClick={() => store.remove?.(thread.id, msg.id)}
                        >
                          {labels.remove}
                        </button>
                      )}
                      {!msg.mine && (safety?.reportMessage || store.report) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSafetyError('');
                            setReporting(msg);
                          }}
                        >
                          {labels.report}
                        </button>
                      )}
                      {!msg.mine &&
                        (safety?.muteAuthor || store.ignoreAuthor) && (
                          <button
                            type="button"
                            disabled={safetyBusy}
                            onClick={() => void mute(msg)}
                          >
                            {labels.mute}
                          </button>
                        )}
                      {!msg.mine && safety?.blockAuthor && (
                        <button
                          type="button"
                          disabled={safetyBusy}
                          onClick={() => void block(msg)}
                        >
                          {labels.block}
                        </button>
                      )}
                      {!msg.mine &&
                        safety?.moderateRemove &&
                        safety.canModerate?.({
                          thread,
                          message: msg,
                          author: msg.author,
                        }) && (
                          <button
                            type="button"
                            disabled={safetyBusy}
                            onClick={() =>
                              void completeAction(
                                () =>
                                  safety.moderateRemove!({
                                    thread,
                                    message: msg,
                                    author: msg.author,
                                  }),
                                () =>
                                  setHiddenMessages((current) =>
                                    new Set(current).add(
                                      messageSafetyKey(thread.id, msg.id)
                                    )
                                  )
                              )
                            }
                          >
                            {labels.remove}
                          </button>
                        )}
                    </div>
                  )}
                </div>
              </div>
            ))}
      </div>

      {reporting && (
        <div
          className={style.safetyBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !safetyBusy)
              setReporting(null);
          }}
        >
          <section
            className={style.safetyDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-report-title"
          >
            <h2 id="message-report-title">{labels.reportTitle}</h2>
            <fieldset disabled={safetyBusy}>
              <legend>{labels.reportReason}</legend>
              <div className={style.reportReasons}>
                {MESSAGE_REPORT_REASONS.map((reason) => (
                  <label key={reason}>
                    <input
                      type="radio"
                      name="message-report-reason"
                      value={reason}
                      checked={reportReason === reason}
                      onChange={() => setReportReason(reason)}
                    />
                    <span>{labels.reasonLabels[reason]}</span>
                  </label>
                ))}
              </div>
              {safety?.allowInPersonIncident && (
                <label className={style.reportCheck}>
                  <input
                    type="checkbox"
                    checked={inPersonIncident}
                    onChange={(event) =>
                      setInPersonIncident(event.target.checked)
                    }
                  />
                  <span>{labels.inPersonIncident}</span>
                </label>
              )}
              {(inPersonIncident ||
                reportReason === 'violence' ||
                reportReason === 'childSafety') &&
                safety?.emergencyGuidance && (
                  <p className={style.emergency} role="note">
                    {safety.emergencyGuidance.href ? (
                      <a href={safety.emergencyGuidance.href}>
                        {safety.emergencyGuidance.text}
                      </a>
                    ) : (
                      safety.emergencyGuidance.text
                    )}
                  </p>
                )}
              <textarea
                value={reportDetail}
                onChange={(event) => setReportDetail(event.target.value)}
                placeholder={labels.reportDetail}
                rows={3}
              />
            </fieldset>
            {safetyError && (
              <p className={style.safetyError} role="alert">
                {safetyError}
              </p>
            )}
            <div className={style.dialogActions}>
              <button
                type="button"
                disabled={safetyBusy || !reportReason}
                onClick={() => void report()}
              >
                {labels.submitReport}
              </button>
              <button
                type="button"
                disabled={safetyBusy}
                onClick={() => setReporting(null)}
              >
                {labels.cancel}
              </button>
            </div>
          </section>
        </div>
      )}

      {safetyError && !reporting && (
        <p className={style.safetyToast} role="alert">
          {safetyError}
        </p>
      )}

      <div className={style.composer}>
        {renderComposer ? (
          renderComposer(thread, onSend)
        ) : thread.readOnly ? (
          <div className={style.readOnly}>{readOnlyNote}</div>
        ) : (
          <div className={style.composerRow}>
            <input
              className={style.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={`Message ${thread.title}`}
              aria-label={`Message ${thread.title}`}
            />
            <button
              type="button"
              className={style.sendBtn}
              onClick={() => void send()}
              disabled={!draft.trim() || sendSafetyBusy}
            >
              Send
            </button>
          </div>
        )}
      </div>
      {sendSafetyError && (
        <p className={style.safetyToast} role="alert">
          {sendSafetyError}
        </p>
      )}
    </>
  );
};
