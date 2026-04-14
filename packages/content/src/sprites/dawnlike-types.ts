export type DawnlikeCategory = 'character' | 'item' | 'terrain' | 'object' | 'ui' | 'effect' | 'unknown';

export interface DawnlikeSpriteManifestEntry {
  readonly id: string;
  readonly sprite_name: string;
  readonly description: string;
  readonly category: DawnlikeCategory | string;
  readonly subtype: string;
  readonly source_section: string;
  readonly source_group: string;
  readonly frame_index: number | null;
  readonly is_animated: boolean;
  readonly spritemap_url: string;
  readonly atlas_metadata_url: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly tile_col: number;
  readonly tile_row: number;
  readonly tags: readonly string[];
  readonly walkable: boolean | null;
  readonly blocks_movement: boolean | null;
  readonly blocks_los: boolean | null;
  readonly interactable: boolean | null;
  readonly confidence: number;
  readonly review_status: 'auto_labeled' | 'needs_review' | string;
}
