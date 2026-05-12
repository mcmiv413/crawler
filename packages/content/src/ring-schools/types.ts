export type RingSchool = 'fire'; // extend here when adding a new school

export interface RingSchoolDefinition {
  readonly id: RingSchool;
  readonly label: string; // e.g. 'Fire'
  readonly ringId: string; // item template ID, e.g. 'fire_ring'
  readonly description: string;
}
