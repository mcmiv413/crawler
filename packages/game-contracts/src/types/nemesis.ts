import type { EntityId, ThreatTier, DamageType, WeaponType } from './common.js';
import type { EnemyStats } from './enemy.js';

export interface NemesisRecord {
  readonly id: EntityId;
  readonly name: string;
  readonly title: string;
  readonly sourceTemplateId: string;
  readonly rank: number;
  readonly tier: ThreatTier;
  readonly stats: EnemyStats;
  readonly traits: readonly string[];
  readonly weaknesses: readonly DamageType[];
  readonly killEventId: EntityId | null;
  readonly encounterCount: number;
  readonly isActive: boolean;
  readonly killCount: number;
  readonly floorOfAscension: number;
  readonly biomeOfAscension: string;
  readonly killedByWeaponType: WeaponType | null;
}
