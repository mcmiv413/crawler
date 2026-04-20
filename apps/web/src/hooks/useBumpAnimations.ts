import { useEffect, useRef } from 'react';
import type { BumpAnimationEntry } from '@dungeon/presenter';
import { emitBumpAnimation } from '../components/BumpAnimations.js';

/**
 * Hook that watches bump animations from the game view and emits them
 * to the bump animation system. Deduplicates by comparing positions.
 */
export function useBumpAnimations(
  animations: readonly BumpAnimationEntry[],
): void {
  const previousRef = useRef<readonly BumpAnimationEntry[]>([]);

  useEffect(() => {
    const previous = previousRef.current;

    // Emit animations new or different from the previous array.
    // Server may create new array instances each tick, so compare by content.
    for (const animation of animations) {
      const wasAlreadyEmitted = previous.some(
        p =>
          p.attackerId === animation.attackerId &&
          p.defenderId === animation.defenderId &&
          p.attackerPos.x === animation.attackerPos.x &&
          p.attackerPos.y === animation.attackerPos.y &&
          p.defenderPos.x === animation.defenderPos.x &&
          p.defenderPos.y === animation.defenderPos.y,
      );

      if (!wasAlreadyEmitted) {
        emitBumpAnimation(animation);
      }
    }

    previousRef.current = animations;
  }, [animations]);
}
