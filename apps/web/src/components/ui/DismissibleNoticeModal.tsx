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

  if (!isVisible) return null;

  return (
    <ModalBackdrop onClose={() => notice && onDismiss(notice.id)}>
      <ModalCard
        title={title}
        onClose={() => notice && onDismiss(notice.id)}
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
          {notice?.message}
        </div>
      </ModalCard>
    </ModalBackdrop>
  );
}
