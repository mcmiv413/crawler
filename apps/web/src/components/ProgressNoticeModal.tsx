import React from 'react';
import type { DismissibleNotice } from '@dungeon/presenter';
import { colors, FONT_STACK, btnStyle } from '../styles.js';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { ModalBackdrop, ModalCard } from './ui/index.js';

interface ProgressNoticeModalProps {
  notice: DismissibleNotice;
  onDismiss: () => void;
}

function accentForNotice(kind: DismissibleNotice['kind']): string {
  switch (kind) {
    case 'FACTION_LEADER_EMERGED':
      return colors.gold;
    case 'FACTION_LEADER_SLAIN':
      return colors.lime;
    case 'DUNGEON_OGRE_EMERGED':
      return colors.blood;
    default:
      return colors.steel;
  }
}

export function ProgressNoticeModal({ notice, onDismiss }: ProgressNoticeModalProps) {
  return (
    <ModalBackdrop onClose={onDismiss}>
      <ModalCard title={notice.title ?? 'Notice'} onClose={onDismiss} accentColor={accentForNotice(notice.kind)} maxWidth={540}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {notice.spriteName ? (
            <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.inset, border: `1px solid ${colors.border2}` }}>
              <ItemSpriteIcon spriteName={notice.spriteName} size={32} />
            </div>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: colors.text, fontSize: 13, lineHeight: 1.5, fontFamily: FONT_STACK }}>
              {notice.message}
            </div>
            {notice.detail ? (
              <div style={{ color: colors.muted, fontSize: 11, lineHeight: 1.5, marginTop: 8, fontFamily: FONT_STACK }}>
                {notice.detail}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onDismiss} style={{ ...btnStyle, fontSize: 11, padding: '6px 14px', margin: 0 }}>
            Continue
          </button>
        </div>
      </ModalCard>
    </ModalBackdrop>
  );
}
