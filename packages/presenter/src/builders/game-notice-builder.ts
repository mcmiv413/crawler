import type { DomainEvent, GameState } from '@dungeon/contracts';
import { ENEMY_TEMPLATES } from '@dungeon/content';
import type { DismissibleNotice, GameNotice } from '../game-view.js';

export function buildGameNotices(state: GameState): readonly GameNotice[] {
  const activeQuestIds = new Set(state.activeQuests.map(quest => quest.id));

  return state.world.eventHistory
    .map(event => buildGameNotice(event, activeQuestIds))
    .filter((notice): notice is GameNotice => notice !== undefined);
}

export function findLatestDismissibleNotice(
  notices: readonly GameNotice[],
): DismissibleNotice | undefined {
  for (let index = notices.length - 1; index >= 0; index -= 1) {
    const notice = notices[index]!;
    if (isDismissibleNotice(notice)) {
      return notice;
    }
  }

  return undefined;
}

function isDismissibleNotice(notice: GameNotice): notice is DismissibleNotice {
  return 'message' in notice;
}

function buildStableNoticeId(
  prefix: string,
  event: Pick<DomainEvent, 'turnNumber' | 'timestamp'>,
  ...parts: readonly (string | number)[]
): string {
  const stableSuffix = parts
    .map(part => encodeURIComponent(String(part)))
    .join('_');

  return `${prefix}_${stableSuffix}_${event.turnNumber}_${event.timestamp}`;
}

function buildGameNotice(
  event: DomainEvent,
  activeQuestIds: ReadonlySet<string>,
): GameNotice | undefined {
  switch (event.type) {
    case 'QUEST_ASSIGNED':
      if (!activeQuestIds.has(event.questId)) {
        return undefined;
      }

      return {
        id: `quest_assigned_${event.questId}`,
        kind: 'QUEST_ASSIGNED',
        questId: event.questId,
        questTitle: event.questTitle,
        questDescription: event.questDescription,
        rewardGold: event.rewardGold,
        giverNpcId: event.giverNpcId,
      };
    case 'FACTION_LEADER_EMERGED':
      return {
        id: buildStableNoticeId(
          'leader_emerged',
          event,
          event.factionId,
          event.leaderId,
        ),
        kind: event.type,
        title: 'Faction Leader Emerged',
        message: `${event.leaderName}, ${event.leaderTitle}, now leads the ${event.factionName}.`,
        detail: `A new leader rose on floor ${event.emergedOnDepth}. Break the faction to stop its pressure.`,
        spriteName: event.leaderTemplateId
          ? ENEMY_TEMPLATES.get(event.leaderTemplateId)?.spriteName
          : undefined,
      };
    case 'FACTION_LEADER_SLAIN':
      return {
        id: buildStableNoticeId(
          'leader_slain',
          event,
          event.factionId,
          event.leaderId,
        ),
        kind: event.type,
        title: 'Faction Leader Defeated',
        message: `${event.leaderName} of the ${event.factionName} has fallen.`,
        detail: 'The faction weakens, reducing future run pressure.',
      };
    case 'DUNGEON_OGRE_EMERGED':
      return {
        id: buildStableNoticeId(
          'dungeon_ogre_emerged',
          event,
          event.ogreId,
          event.selectedSpawnDepth,
        ),
        kind: event.type,
        title: 'A Dungeon Ogre Has Emerged',
        message: `The Dungeon Ogre has claimed floor ${event.selectedSpawnDepth}.`,
        detail: `Eligible depths were ${event.eligibleSpawnDepths.join(', ')}. hunt it down before it reaches town.`,
        spriteName: ENEMY_TEMPLATES.get('dungeon_ogre')?.spriteName,
      };
    case 'EQUIP_BLOCKED':
      return {
        id: buildStableNoticeId('equip_blocked', event, event.reason),
        kind: event.type,
        title: 'Cannot Equip Item',
        message: event.reason,
      };
    default:
      return undefined;
  }
}
