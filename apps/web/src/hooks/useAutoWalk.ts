import { useEffect } from 'react';
import { useGameStore } from '../store/game-store.js';

export function useAutoWalk(): void {
  useEffect(() => {
    const handleKeyDown = () => {
      const { autoWalkPath, cancelAutoWalk } = useGameStore.getState();
      if (autoWalkPath.length > 0) {
        cancelAutoWalk();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
