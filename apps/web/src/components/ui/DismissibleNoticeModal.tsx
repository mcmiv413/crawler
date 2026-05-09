import React, { useMemo } from 'react';
import type { DismissibleNotice } from '@dungeon/presenter';
import { ModalBackdrop } from './ModalBackdrop.js';
import { ModalCard } from './ModalCard.js';

interface DismissibleNoticeModalProps {
  notice: DismissibleNotice | undefined;
  dismissedNoticeIds: Set<string>;
  onDismiss: (noticeId: string) => void;
  title?: string;
  accentColor?: string;
}

/**
 * Reusable modal for displaying and dismissing action-blocked notices.
 *
 * Tracks dismissed notice IDs so the modal stays hidden until a new notice
 * (with a different id) arrives.
 */
export function DismissibleNoticeModal({
  notice,
  dismissedNoticeIds,
  onDismiss,
  title = 'Warning',
  accentColor = '#fa0',
}: DismissibleNoticeModalProps) {
  // Show modal if notice exists AND it hasn't been dismissed yet
  const isVisible = useMemo(
    () => notice !== undefined && !dismissedNoticeIds.has(notice.id),
    [notice, dismissedNoticeIds]
  );

  if (!isVisible || !notice) return null;

  const visibleNotice = notice;

  return (
    <ModalBackdrop onClose={() => onDismiss(visibleNotice.id)}>
      <ModalCard
        title={title}
        onClose={() => onDismiss(visibleNotice.id)}
        accentColor={accentColor}
      >
        <div
          style={{
            color: '#ccc',
            fontSize: 13,
            lineHeight: 1.5,
            wordWrap: 'break-word',
          }}
        >
          {visibleNotice.message}
        </div>
      </ModalCard>
    </ModalBackdrop>
  );
}
