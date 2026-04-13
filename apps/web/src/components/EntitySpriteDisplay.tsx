/**
 * EntitySpriteDisplay - Renders a sprite or ASCII fallback for any entity
 * Reusable across inspect modal, dropdowns, etc.
 */

import React, { useRef, useEffect, useState } from 'react';
import type { EntityView, InspectableEntityView } from '@dungeon/presenter';
import { spriteRegistry } from '../sprites/sprite-registry.js';

interface EntitySpriteDisplayProps {
  readonly entity: EntityView | InspectableEntityView;
  readonly size?: 'small' | 'medium' | 'large';
  readonly useSprites?: boolean;
}

const SIZE_MAP = {
  small: 24,
  medium: 32,
  large: 48,
};

/**
 * Get the sprite key for an entity based on its type and template.
 * Handles both EntityView and InspectableEntityView formats.
 */
function getSpriteKey(entity: EntityView | InspectableEntityView): string | null {
  if (!('templateId' in entity) || !entity.templateId) return null;

  // Determine entity type (EntityView uses 'type', InspectableEntityView uses 'entityType')
  const entityType = 'type' in entity ? entity.type : ('entityType' in entity ? entity.entityType : null);
  
  if (entityType === 'player') {
    return 'player';
  }
  if (entityType === 'enemy') {
    return `enemy:${entity.templateId}`;
  }
  if (entityType === 'item') {
    return `item:${entity.templateId}`;
  }
  if (entityType === 'object') {
    return `object:${entity.templateId}`;
  }
  
  return null;
}

export function EntitySpriteDisplay({
  entity,
  size = 'large',
  useSprites = true,
}: EntitySpriteDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spritesReady, setSpritesReady] = useState(spriteRegistry.isReady());

  const spriteSize = SIZE_MAP[size];

  useEffect(() => {
    spriteRegistry.onReady(() => setSpritesReady(true));
    if (!spriteRegistry.isReady()) {
      spriteRegistry.load().catch(() => {
        // Silently fail if sprites can't load, ASCII fallback will be used
      });
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, spriteSize, spriteSize);

    const spriteKey = getSpriteKey(entity);
    const sprite = useSprites && spritesReady && spriteKey ? spriteRegistry.getSprite(spriteKey) : null;

    if (sprite) {
      const { image, rect } = sprite;
      ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, spriteSize, spriteSize);
    } else {
      // ASCII fallback
      ctx.fillStyle = entity.color;
      ctx.font = `${spriteSize - 8}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(entity.ascii, spriteSize / 2, spriteSize / 2);
    }
  }, [entity, spritesReady, spriteSize, useSprites]);

  const borderStyle = size === 'large' ? '1px solid #444' : 'none';

  return (
    <canvas
      ref={canvasRef}
      width={spriteSize}
      height={spriteSize}
      style={{
        border: borderStyle,
        backgroundColor: size === 'large' ? '#0f0f1e' : 'transparent',
        imageRendering: 'pixelated',
        display: 'block',
        margin: size === 'large' ? '0 auto' : '0',
      }}
    />
  );
}
