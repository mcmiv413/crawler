/**
 * Test layer: unit
 * Behavior: DismissibleNoticeModal dismisses the active notice id and suppresses notices already marked dismissed.
 * Proof: The close button is asserted to call onDismiss('notice-1'), and a dismissed notice is asserted absent by querying Action is blocked.
 * Validation: pnpm vitest run apps/web/src/components/ui/DismissibleNoticeModal.test.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DismissibleNotice } from '@dungeon/presenter';
import { DismissibleNoticeModal } from './DismissibleNoticeModal.js';

const notice: DismissibleNotice = {
  id: 'notice-1',
  kind: 'TEST_NOTICE',
  message: 'Action is blocked.',
};

describe('DismissibleNoticeModal', () => {
  it('dismisses the visible notice id from the modal close button', () => {
    const onDismiss = vi.fn();

    render(
      <DismissibleNoticeModal
        notice={notice}
        dismissedNoticeIds={new Set()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onDismiss).toHaveBeenCalledWith('notice-1');
  });

  it('does not render when the notice has already been dismissed', () => {
    render(
      <DismissibleNoticeModal
        notice={notice}
        dismissedNoticeIds={new Set(['notice-1'])}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.queryByText('Action is blocked.')).not.toBeInTheDocument();
  });
});
