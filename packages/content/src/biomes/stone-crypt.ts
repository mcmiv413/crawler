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
    readonly floor?: string;
    readonly wall?: string;
    readonly interactable?: string;
  };
  readonly mapGen?: {
    readonly roomWidth: readonly [number, number];
    readonly roomHeight: readonly [number, number];
    readonly corridorLength: readonly [number, number];
    readonly dugPercentage: number;
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
  tileSprites: {
    floor: 'day stone floor c',
    wall: 'dark brick wall center',
    interactable: 'closed stone door front',
  },
  mapGen: {
    roomWidth: [3, 5],
    roomHeight: [2, 4],
    corridorLength: [1, 3],
    dugPercentage: 0.38,
  },
};
