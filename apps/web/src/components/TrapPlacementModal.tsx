import React from 'react';
import type { Direction } from '@dungeon/contracts';
import { btnStyle, colors, FONT_STACK } from '../styles.js';
import { ModalBackdrop, ModalCard } from './ui/index.js';

interface TrapPlacementModalProps {
  onSelect: (direction: Direction) => void;
  onCancel: () => void;
  validDirections?: Set<Direction>;
}

const allDirections: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const directionLabels: Record<Direction, string> = {
  N: '↑',
  S: '↓',
  E: '→',
  W: '←',
  NE: '↗',
  NW: '↖',
  SE: '↘',
  SW: '↙',
};

function DirectionButton({
  direction,
  isValid,
  onSelect,
  gridColumn,
  gridRow,
}: {
  direction: Direction;
  isValid: boolean;
  onSelect: (d: Direction) => void;
  gridColumn: number;
  gridRow: number;
}) {
  return (
    <button
      onClick={() => onSelect(direction)}
      disabled={!isValid}
      aria-label={direction}
      style={{
        gridColumn,
        gridRow,
        width: '100%',
        padding: 10,
        background: isValid ? colors.card : colors.inset,
        color: isValid ? colors.text : colors.muted,
        border: `1px solid ${isValid ? colors.border : colors.border2}`,
        cursor: isValid ? 'pointer' : 'not-allowed',
        fontSize: 16,
        fontFamily: FONT_STACK,
        borderRadius: '2px',
      }}
    >
      {directionLabels[direction]}
    </button>
  );
}

export function TrapPlacementModal({
  onSelect,
  onCancel,
  validDirections = new Set(allDirections),
}: TrapPlacementModalProps) {
  const isValid = (direction: Direction): boolean => validDirections.has(direction);

  // Positions for 3x3 grid (centre is empty player tile)
  const gridPositions: Record<Direction, { col: number; row: number }> = {
    NW: { col: 1, row: 1 },
    N: { col: 2, row: 1 },
    NE: { col: 3, row: 1 },
    W: { col: 1, row: 2 },
    E: { col: 3, row: 2 },
    SW: { col: 1, row: 3 },
    S: { col: 2, row: 3 },
    SE: { col: 3, row: 3 },
  };

  return (
    <ModalBackdrop onClose={onCancel}>
      <ModalCard title="SELECT DIRECTION" onClose={onCancel} maxWidth={320}>
        <p style={{ color: colors.muted, fontSize: 11, marginTop: 0, marginBottom: 12 }}>
          Choose where to place the trap
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 60px)',
            gridTemplateRows: 'repeat(3, 60px)',
            gap: 4,
            justifyContent: 'center',
            margin: '12px 0',
          }}
        >
          {allDirections.map((dir) => {
            const pos = gridPositions[dir];
            return (
              <DirectionButton
                key={dir}
                direction={dir}
                isValid={isValid(dir)}
                onSelect={onSelect}
                gridColumn={pos.col}
                gridRow={pos.row}
              />
            );
          })}
        </div>

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button onClick={onCancel} style={btnStyle}>
            Cancel
          </button>
        </div>
      </ModalCard>
    </ModalBackdrop>
  );
}
