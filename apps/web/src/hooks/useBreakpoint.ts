import { useState, useEffect } from 'react';
import { MOBILE_BREAKPOINT } from '../config/ui-config.js';

export interface Breakpoint {
  isMobile: boolean;
}

/**
 * Hook to detect mobile/desktop viewport based on media query.
 * Breakpoint: configured in ui-config.ts (mobile if viewport width <= MOBILE_BREAKPOINT)
 *
 * @returns { isMobile: boolean } — true if viewport is mobile-sized
 */
export function useBreakpoint(): Breakpoint {
  const mediaQueryStr = `(max-width: ${MOBILE_BREAKPOINT}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia(mediaQueryStr).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(mediaQueryStr);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mediaQueryStr]);

  return { isMobile };
}
