export const WALK_CONTINUATION_EVENT = 'walk-continuation';

export interface WalkContinuationDetail {
  readonly entityId: string;
  readonly continuing: boolean;
}

export function dispatchWalkContinuation(detail: WalkContinuationDetail): void {
  window.dispatchEvent(new CustomEvent<WalkContinuationDetail>(WALK_CONTINUATION_EVENT, { detail }));
}
