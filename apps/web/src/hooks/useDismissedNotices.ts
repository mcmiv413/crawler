import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DeathContext,
  DismissibleNotice,
  GameNotice,
  GameView,
  QuestAssignedNotice,
} from '@dungeon/presenter';

const PROGRESS_NOTICE_KINDS = new Set([
  'FACTION_LEADER_EMERGED',
  'FACTION_LEADER_SLAIN',
  'DUNGEON_OGRE_EMERGED',
]);

interface UseDismissedNoticesArgs {
  readonly gameId: string | null;
  readonly phase: GameView['phase'] | null;
  readonly deathContext: DeathContext | null;
  readonly deathTransitioning: boolean;
  readonly notices: readonly GameNotice[];
}

interface UseDismissedNoticesResult {
  readonly visibleDeathContext: DeathContext | null;
  readonly visibleQuestNotice: QuestAssignedNotice | null;
  readonly visibleProgressNotice: DismissibleNotice | null;
  readonly dismissDeathNotice: () => void;
  readonly dismissQuestNotice: () => void;
  readonly dismissProgressNotice: () => void;
}

function isQuestAssignedNotice(notice: GameNotice): notice is QuestAssignedNotice {
  return notice.kind === 'QUEST_ASSIGNED';
}

function isProgressNotice(notice: GameNotice): notice is DismissibleNotice {
  return notice.kind !== 'QUEST_ASSIGNED' && PROGRESS_NOTICE_KINDS.has(notice.kind);
}

function addShownId(shownIds: ReadonlySet<string>, noticeId: string): Set<string> {
  const next = new Set(shownIds);
  next.add(noticeId);
  return next;
}

function buildDeathNoticeId(deathContext: DeathContext): string {
  const equipmentKey = deathContext.equipmentLost
    .map(({ slot, itemName }) => `${slot}:${itemName}`)
    .join('|');

  return [
    'death-notification',
    deathContext.totalDeaths,
    deathContext.floor,
    deathContext.killerName ?? '',
    deathContext.killerSpriteName ?? '',
    deathContext.goldLost,
    deathContext.overkillDamage,
    deathContext.permadeathThreshold,
    equipmentKey,
  ].join(':');
}

function findLatestUnshownNotice<TNotice extends GameNotice>(
  notices: readonly GameNotice[],
  shownNoticeIds: ReadonlySet<string>,
  predicate: (notice: GameNotice) => notice is TNotice,
): TNotice | null {
  for (let index = notices.length - 1; index >= 0; index -= 1) {
    const notice = notices[index]!;
    if (predicate(notice) && !shownNoticeIds.has(notice.id)) {
      return notice;
    }
  }

  return null;
}

export function useDismissedNotices(
  args: UseDismissedNoticesArgs,
): UseDismissedNoticesResult {
  const [shownDeathIds, setShownDeathIds] = useState<Set<string>>(() => new Set());
  const [shownNoticeIds, setShownNoticeIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setShownDeathIds(new Set());
    setShownNoticeIds(new Set());
  }, [args.gameId]);

  const activeDeathNoticeId = useMemo(
    () => (args.deathContext === null ? null : buildDeathNoticeId(args.deathContext)),
    [args.deathContext],
  );

  const visibleDeathContext = useMemo(
    () =>
      args.phase === 'town'
      && args.deathContext !== null
      && activeDeathNoticeId !== null
      && !args.deathTransitioning
      && !shownDeathIds.has(activeDeathNoticeId)
        ? args.deathContext
        : null,
    [activeDeathNoticeId, args.deathContext, args.deathTransitioning, args.phase, shownDeathIds],
  );

  const visibleQuestNotice = useMemo(
    () =>
      args.phase === 'town'
        ? findLatestUnshownNotice(args.notices, shownNoticeIds, isQuestAssignedNotice)
        : null,
    [args.notices, args.phase, shownNoticeIds],
  );

  const visibleProgressNotice = useMemo(
    () => findLatestUnshownNotice(args.notices, shownNoticeIds, isProgressNotice),
    [args.notices, shownNoticeIds],
  );

  const dismissDeathNotice = useCallback(() => {
    if (activeDeathNoticeId !== null) {
      setShownDeathIds(previous => addShownId(previous, activeDeathNoticeId));
    }
  }, [activeDeathNoticeId]);

  const dismissNotice = useCallback((noticeId: string) => {
    setShownNoticeIds(previous => addShownId(previous, noticeId));
  }, []);

  const dismissQuestNotice = useCallback(() => {
    if (visibleQuestNotice !== null) {
      dismissNotice(visibleQuestNotice.id);
    }
  }, [dismissNotice, visibleQuestNotice]);

  const dismissProgressNotice = useCallback(() => {
    if (visibleProgressNotice !== null) {
      dismissNotice(visibleProgressNotice.id);
    }
  }, [dismissNotice, visibleProgressNotice]);

  return {
    visibleDeathContext,
    visibleQuestNotice,
    visibleProgressNotice,
    dismissDeathNotice,
    dismissQuestNotice,
    dismissProgressNotice,
  };
}
