/**
 * ItemSpriteIcon - Renders an item sprite from atlas name or shows empty space
 * Used in inventory, shop, equipment doll, and other UI panels
 */

import { useRef, useEffect, useState } from 'react';
import { spriteRegistry } from '../sprites/sprite-registry.js';

interface ItemSpriteIconProps {
  readonly spriteName?: string;
  readonly size?: 16 | 24 | 32;
}

export function ItemSpriteIcon({ spriteName, size = 16 }: ItemSpriteIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spritesReady, setSpritesReady] = useState(spriteRegistry.isReady());

  useEffect(() => {
    spriteRegistry.onReady(() => setSpritesReady(true));
    if (!spriteRegistry.isReady()) {
      spriteRegistry.load().catch(() => {
        // Silently fail if sprites can't load
      });
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    // In test environment, getContext might fail; gracefully degrade
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvasRef.current.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);

    // Only draw sprite if we have a name, sprites are ready, and the sprite exists
    if (spriteName && spritesReady) {
      const sprite = spriteRegistry.getSpriteByAtlasName(spriteName);
      if (sprite) {
        const { image, rect } = sprite;
        ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, size, size);
      }
    }
  }, [spriteName, spritesReady, size]);

  if (!spriteName) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          verticalAlign: 'middle',
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        imageRendering: 'pixelated',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  );
}
