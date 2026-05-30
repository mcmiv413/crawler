import type { ArmorTemplate } from '@dungeon/contracts';

export type RingSchool = 'fire'; // extend here when adding a new school

export type RingItemId = ArmorTemplate['itemId'];

export interface RingSchoolDefinition {
  readonly id: RingSchool;
  readonly label: string; // e.g. 'Fire'
  readonly ringId: RingItemId; // item template ID, e.g. 'fire_ring'
  readonly description: string;
}
