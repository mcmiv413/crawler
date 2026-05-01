import { SPRITE_MAP, type SpriteRect, DAWNLIKE_ATLAS } from '@dungeon/content';

export interface SpriteEntry {
  image: HTMLImageElement;
  rect: SpriteRect;
}

class SpriteRegistry {
  private sheet: HTMLImageElement | null = null;
  private ready = false;
  private loading = false; // guard against double-load (React StrictMode)
  private onReadyCallbacks: (() => void)[] = [];

  async load(): Promise<void> {
    if (this.ready || this.loading) return;
    this.loading = true;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.sheet = img;
        this.ready = true;
        this.loading = false;
        this.onReadyCallbacks.forEach(cb => cb());
        this.onReadyCallbacks = [];
        resolve();
      };
      img.onerror = () => {
        this.loading = false;
        reject(new Error('Failed to load sprite sheet'));
      };
      img.src = '/sprites/dawnlike.png';
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  onReady(cb: () => void): void {
    if (this.ready) {
      cb();
    } else {
      this.onReadyCallbacks.push(cb);
    }
  }

  /** Look up a sprite by key. Returns null if key unknown or sheet not loaded. */
  getSprite(key: string): SpriteEntry | null {
    if (!this.sheet) return null;
    const rect = SPRITE_MAP[key];
    if (!rect) return null;
    return { image: this.sheet, rect };
  }

  /** Look up a sprite by atlas name (e.g., 'dwarvish short sword', 'skeleton'). Returns null if not found. */
  getSpriteByAtlasName(atlasName: string): SpriteEntry | null {
    if (!this.sheet) return null;
    const rect = DAWNLIKE_ATLAS[atlasName];
    if (!rect) return null;
    return { image: this.sheet, rect };
  }

}

export const spriteRegistry = new SpriteRegistry();
