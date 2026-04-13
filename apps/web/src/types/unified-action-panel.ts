/**
 * Type definitions for UnifiedActionPanel dropdown/overlay management.
 */

import type { ActionButtonType } from '../config/action-icons';

export interface DropdownState {
  readonly activeDropdown: ActionButtonType | null;
  readonly selectedChoice?: unknown;
  readonly cancelable: boolean;
}

export type DropdownAction =
  | { type: 'OPEN_DROPDOWN'; payload: ActionButtonType }
  | { type: 'CLOSE_DROPDOWN' }
  | { type: 'SELECT_CHOICE'; payload: unknown }
  | { type: 'CANCEL_DROPDOWN' };
