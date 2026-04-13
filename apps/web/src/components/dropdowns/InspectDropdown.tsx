/**
 * InspectDropdown - Shows a list of visible entities to inspect
 * Entities include enemies and interactive objects
 */

import React from 'react';
import type { InspectableEntityView } from '@dungeon/presenter';
import styles from '../ActionOverlay.module.css';

interface InspectDropdownProps {
  readonly entities: readonly InspectableEntityView[];
  readonly onSelect: (entity: InspectableEntityView) => void;
  readonly onCancel: () => void;
}

export function InspectDropdown({
  entities,
  onSelect,
  onCancel,
}: InspectDropdownProps) {
  if (entities.length === 0) {
    return (
      <div style={{ padding: '12px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
        Nothing visible to inspect.
      </div>
    );
  }

  return (
    <div className={styles.dropdownContent}>
      {entities.map((entity) => (
        <button
          key={entity.id}
          onClick={() => onSelect(entity)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '10px 12px',
            border: 'none',
            background: 'transparent',
            color: entity.color,
            cursor: 'pointer',
            fontSize: '13px',
            textAlign: 'left',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2a2a4e';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span style={{ fontWeight: 'bold', minWidth: '20px' }}>{entity.ascii}</span>
          <span>{entity.name}</span>
          {entity.health !== undefined && (
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#999' }}>
              {entity.health}/{entity.maxHealth}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
