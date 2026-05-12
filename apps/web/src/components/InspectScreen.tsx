import React, { useState, useEffect, useRef } from 'react';
import type { InspectableEntityView } from '@dungeon/presenter';
import { spriteRegistry } from '../sprites/sprite-registry.js';

const SPRITE_SIZE_LARGE = 48;
const SPRITE_SIZE_SMALL = 24;

interface SpriteDisplayProps {
  readonly entity: InspectableEntityView;
  readonly size?: 'small' | 'large';
}

function SpriteDisplay({ entity, size = 'large' }: SpriteDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spritesReady, setSpritesReady] = useState(spriteRegistry.isReady());

  const spriteSize = size === 'large' ? SPRITE_SIZE_LARGE : SPRITE_SIZE_SMALL;

  useEffect(() => {
    spriteRegistry.onReady(() => setSpritesReady(true));
    if (!spriteRegistry.isReady()) {
      spriteRegistry.load().catch(() => {
        // Silently fail if sprites can't load, ASCII fallback will be used
      });
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, spriteSize, spriteSize);

    let spriteKey: string | null = null;
    if (entity.entityType === 'enemy' && entity.templateId) {
      spriteKey = `enemy:${entity.templateId}`;
    } else if (entity.entityType === 'object' && entity.templateId) {
      spriteKey = `object:${entity.templateId}`;
    }

    // Try to get sprite
    const sprite = spriteKey ? spriteRegistry.getSprite(spriteKey) : null;

    if (sprite && spritesReady) {
      const { image, rect } = sprite;
      ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, spriteSize, spriteSize);
    } else {
      // ASCII fallback
      ctx.fillStyle = entity.color;
      ctx.font = `${spriteSize - 8}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(entity.ascii, spriteSize / 2, spriteSize / 2);
    }
  }, [entity, spritesReady, spriteSize]);

  const borderStyle = size === 'large' ? '1px solid #444' : 'none';

  return (
    <canvas
      ref={canvasRef}
      width={spriteSize}
      height={spriteSize}
      style={{
        border: borderStyle,
        backgroundColor: size === 'large' ? '#0f0f1e' : 'transparent',
        imageRendering: 'pixelated',
        display: 'block',
        margin: size === 'large' ? '0 auto 12px' : '0',
      }}
    />
  );
}

interface InspectScreenProps {
  readonly entities: readonly InspectableEntityView[];
  readonly playerSpeed: number;
}

export function InspectScreen({
  entities,
  playerSpeed,
}: InspectScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(entities[0]?.id ?? null);

  const selectedEntity = entities.find(e => e.id === selectedId);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#1a1a2e',
    color: '#ccc',
    fontFamily: 'monospace',
    fontSize: '12px',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: '8px',
    borderBottom: '1px solid #333',
    backgroundColor: '#0f0f1e',
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  };

  const listStyle: React.CSSProperties = {
    flex: '0 0 200px',
    borderRight: '1px solid #333',
    overflowY: 'auto',
    backgroundColor: '#1a1a2e',
  };

  const detailStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px',
    overflowY: 'auto',
    backgroundColor: '#1a1a2e',
    display: 'flex',
    flexDirection: 'column',
  };

  const rowStyle = (isSelected: boolean): React.CSSProperties => ({
    padding: '8px',
    borderBottom: '1px solid #222',
    cursor: 'pointer',
    backgroundColor: isSelected ? '#2a2a4e' : '#1a1a2e',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    userSelect: 'none',
  });

  const asciiBoxStyle = (color: string): React.CSSProperties => ({
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #444',
    backgroundColor: '#0f0f1e',
    fontWeight: 'bold',
    fontSize: '16px',
    color,
  });

  const emptyStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#fff',
  };

  const descriptionStyle: React.CSSProperties = {
    color: '#999',
    marginBottom: '16px',
    lineHeight: '1.4',
  };

  const statsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '16px',
    fontSize: '11px',
  };

  const statRowStyle: React.CSSProperties = {
    backgroundColor: '#0f0f1e',
    padding: '8px',
    borderRadius: '2px',
  };

  const statLabelStyle: React.CSSProperties = {
    color: '#999',
  };

  const statValueStyle: React.CSSProperties = {
    color: '#fff',
    fontWeight: 'bold',
  };

  const affinityTableStyle: React.CSSProperties = {
    width: '100%',
    marginBottom: '16px',
    fontSize: '11px',
    borderCollapse: 'collapse',
  };

  const affinityCellStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderBottom: '1px solid #222',
    textAlign: 'left',
  };

  const statusBadgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 6px',
    backgroundColor: '#2a2a4e',
    border: '1px solid #444',
    borderRadius: '2px',
    marginRight: '6px',
    marginBottom: '6px',
    fontSize: '10px',
  };

  if (entities.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>Inspect</div>
        <div style={emptyStyle}>Nothing visible to inspect.</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Inspect</div>
      <div style={contentStyle}>
        <div style={listStyle}>
          {entities.map(entity => (
            <div
              key={entity.id}
              style={rowStyle(entity.id === selectedId)}
              onClick={() => setSelectedId(entity.id)}
            >
              <SpriteDisplay entity={entity} size="small" />
              <div>{entity.name}</div>
            </div>
          ))}
        </div>

        {selectedEntity ? (
          <div style={detailStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
              <SpriteDisplay entity={selectedEntity} />
              <div style={titleStyle}>{selectedEntity.name}</div>
            </div>
            <div style={descriptionStyle}>{selectedEntity.description}</div>

            {selectedEntity.entityType === 'enemy' && (
              <>
                {selectedEntity.health !== undefined && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={statLabelStyle}>Health</div>
                    <div style={{ ...statValueStyle, marginTop: '4px' }}>
                      {selectedEntity.health} / {selectedEntity.maxHealth}
                    </div>
                  </div>
                )}

                <div style={statsGridStyle}>
                  {selectedEntity.attack !== undefined && (
                    <div style={statRowStyle}>
                      <div style={statLabelStyle}>ATK</div>
                      <div style={statValueStyle}>{selectedEntity.attack}</div>
                    </div>
                  )}
                  {selectedEntity.defense !== undefined && (
                    <div style={statRowStyle}>
                      <div style={statLabelStyle}>DEF</div>
                      <div style={statValueStyle}>{selectedEntity.defense}</div>
                    </div>
                  )}
                  {selectedEntity.speed !== undefined && (
                    <div style={statRowStyle}>
                      <div style={statLabelStyle}>SPD</div>
                      <div style={statValueStyle}>{selectedEntity.speed}</div>
                    </div>
                  )}
                  {selectedEntity.tier !== undefined && (
                    <div style={statRowStyle}>
                      <div style={statLabelStyle}>TIER</div>
                      <div style={statValueStyle}>{selectedEntity.tier}</div>
                    </div>
                  )}
                </div>

                {selectedEntity.isFasterThanPlayer !== undefined && (
                  <div style={{ marginBottom: '12px', fontSize: '11px', color: selectedEntity.isFasterThanPlayer ? '#ff6644' : '#44ff44' }}>
                    {selectedEntity.isFasterThanPlayer ? '⚡ Faster than you' : '✓ Slower than you'}
                  </div>
                )}

                {selectedEntity.archetype && (
                  <div style={{ marginBottom: '12px', fontSize: '11px' }}>
                    <span style={statLabelStyle}>Archetype: </span>
                    <span style={statValueStyle}>{selectedEntity.archetype}</span>
                  </div>
                )}

                {selectedEntity.affinities && Object.keys(selectedEntity.affinities).length > 0 && (
                  <>
                    <div style={statLabelStyle}>Affinities:</div>
                    <table style={affinityTableStyle}>
                      <tbody>
                        {Object.entries(selectedEntity.affinities).map(([type, value]) => (
                          <tr key={type}>
                            <td style={affinityCellStyle}>{type}</td>
                            <td style={{ ...affinityCellStyle, textAlign: 'right' }}>
                              {value > 0 ? '+' : ''}{value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {selectedEntity.statuses && selectedEntity.statuses.length > 0 && (
                  <>
                    <div style={statLabelStyle}>Statuses:</div>
                    <div style={{ marginTop: '6px' }}>
                      {selectedEntity.statuses.map((status) => (
                        <span key={status} style={statusBadgeStyle}>
                          {status}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {selectedEntity.entityType === 'item' && (
              <div style={{ ...asciiBoxStyle(selectedEntity.color), width: '40px', height: '40px', marginTop: '12px' }}>
                {selectedEntity.ascii}
              </div>
            )}
          </div>
        ) : (
          <div style={emptyStyle}>Select an entity to inspect.</div>
        )}
      </div>
    </div>
  );
}
