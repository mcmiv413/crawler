import type { Direction } from '@dungeon/contracts';

interface TrapPlacementModalProps {
  onSelect: (direction: Direction) => void;
  onCancel: () => void;
  validDirections?: Set<Direction>;
}

const directions: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
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

export function TrapPlacementModal({
  onSelect,
  onCancel,
  validDirections = new Set(directions),
}: TrapPlacementModalProps) {
  const isValid = (direction: Direction): boolean => validDirections.has(direction);

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: '#1a1a1a',
      border: '2px solid #666',
      padding: '20px',
      borderRadius: '8px',
      zIndex: 1000,
      minWidth: '300px',
    }}>
      <h2 style={{ marginTop: 0, color: '#fff' }}>Select Direction</h2>
      <p style={{ color: '#aaa', fontSize: '14px' }}>Choose where to place the trap</p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 60px)',
        gap: '4px',
        justifyContent: 'center',
        margin: '20px 0',
      }}>
        {/* N */}
        <div style={{ gridColumn: '2' }}>
          <button
            onClick={() => onSelect('N')}
            disabled={!isValid('N')}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: isValid('N') ? '#444' : '#222',
              color: isValid('N') ? '#fff' : '#666',
              border: '1px solid #666',
              cursor: isValid('N') ? 'pointer' : 'not-allowed',
              fontSize: '16px',
            }}>
            {directionLabels.N}
          </button>
        </div>

        {/* NE */}
        <button
          onClick={() => onSelect('NE')}
          disabled={!isValid('NE')}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isValid('NE') ? '#444' : '#222',
            color: isValid('NE') ? '#fff' : '#666',
            border: '1px solid #666',
            cursor: isValid('NE') ? 'pointer' : 'not-allowed',
            fontSize: '16px',
          }}>
          {directionLabels.NE}
        </button>

        {/* E */}
        <button
          onClick={() => onSelect('E')}
          disabled={!isValid('E')}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isValid('E') ? '#444' : '#222',
            color: isValid('E') ? '#fff' : '#666',
            border: '1px solid #666',
            cursor: isValid('E') ? 'pointer' : 'not-allowed',
            fontSize: '16px',
          }}>
          {directionLabels.E}
        </button>

        {/* W */}
        <button
          onClick={() => onSelect('W')}
          disabled={!isValid('W')}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isValid('W') ? '#444' : '#222',
            color: isValid('W') ? '#fff' : '#666',
            border: '1px solid #666',
            cursor: isValid('W') ? 'pointer' : 'not-allowed',
            fontSize: '16px',
          }}>
          {directionLabels.W}
        </button>

        {/* SE */}
        <button
          onClick={() => onSelect('SE')}
          disabled={!isValid('SE')}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isValid('SE') ? '#444' : '#222',
            color: isValid('SE') ? '#fff' : '#666',
            border: '1px solid #666',
            cursor: isValid('SE') ? 'pointer' : 'not-allowed',
            fontSize: '16px',
          }}>
          {directionLabels.SE}
        </button>

        {/* SW */}
        <button
          onClick={() => onSelect('SW')}
          disabled={!isValid('SW')}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isValid('SW') ? '#444' : '#222',
            color: isValid('SW') ? '#fff' : '#666',
            border: '1px solid #666',
            cursor: isValid('SW') ? 'pointer' : 'not-allowed',
            fontSize: '16px',
          }}>
          {directionLabels.SW}
        </button>

        {/* S */}
        <div style={{ gridColumn: '2' }}>
          <button
            onClick={() => onSelect('S')}
            disabled={!isValid('S')}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: isValid('S') ? '#444' : '#222',
              color: isValid('S') ? '#fff' : '#666',
              border: '1px solid #666',
              cursor: isValid('S') ? 'pointer' : 'not-allowed',
              fontSize: '16px',
            }}>
            {directionLabels.S}
          </button>
        </div>

        {/* SW */}
        <div style={{ gridColumn: '1' }}>
          <button
            onClick={() => onSelect('SW')}
            disabled={!isValid('SW')}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: isValid('SW') ? '#444' : '#222',
              color: isValid('SW') ? '#fff' : '#666',
              border: '1px solid #666',
              cursor: isValid('SW') ? 'pointer' : 'not-allowed',
              fontSize: '16px',
            }}>
            {directionLabels.SW}
          </button>
        </div>
      </div>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            backgroundColor: '#333',
            color: '#fff',
            border: '1px solid #666',
            cursor: 'pointer',
            borderRadius: '4px',
          }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
