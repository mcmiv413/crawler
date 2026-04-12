import type { SpriteRect } from '@dungeon/contracts';

export interface BiomeDefinition {
  readonly biomeId: string;
  readonly name: string;
  readonly description: string;
  readonly floorRange: { readonly min: number; readonly max: number };
  readonly tileWeights: {
    readonly floor: number;
    readonly wall: number;
    readonly door: number;
  };
  readonly ambientColor: string;
  readonly floorAscii: string;
  readonly wallAscii: string;
  readonly tileSprites?: {
    readonly floor?: SpriteRect;
    readonly wall?: SpriteRect;
    readonly interactable?: SpriteRect;
  };
}

export const stoneCrypt: BiomeDefinition = {
  biomeId: 'stone_crypt',
  name: 'Stone Crypt',
  description: 'Ancient burial chambers carved from grey stone.',
  floorRange: { min: 1, max: 3 },
  tileWeights: { floor: 0.55, wall: 0.35, door: 0.1 },
  ambientColor: '#444444',
  floorAscii: '.',
  wallAscii: '#',
};
