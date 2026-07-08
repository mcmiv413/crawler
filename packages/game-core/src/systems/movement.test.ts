/**
 * Test layer: unit
 * Behavior: validateMove accepts walkable floor movement and rejects walls, occupied enemy tiles, out-of-bounds positions, and moves outside a dungeon run.
 * Proof: Assertions check result.valid and newPosition for a legal east move and exact failure reasons for wall, enemy, bounds, and missing-run cases.
 * Validation: pnpm vitest run packages/game-core/src/systems/movement.test.ts
 */
import { describe, it, expect } from 'vitest'
import { validateMove } from './movement.js'

type Position = { x: number; y: number }
type MapCell = { tile: { walkable: boolean; type: string } }

// Helper to create a cell map key
const key = (pos: Position) => `${pos.x},${pos.y}`

function createState(
  cells: Map<string, MapCell>,
  playerPos: Position,
  enemies: Map<string, { position: Position }> = new Map(),
) {
  return {
    run: {
      floor: { cells, entrance: { x: 0, y: 0 }, exit: { x: 10, y: 10 } },
      enemies,
      items: new Map(),
      turnCount: 0,
      isActive: true,
      runId: 'run1',
    },
    player: { position: playerPos },
  } as any
}

describe('validateMove', () => {
  it('allows a valid move on a floor tile', () => {
    const cells = new Map([
      [key({ x: 5, y: 5 }), { tile: { walkable: true, type: 'floor' } }],
      [key({ x: 6, y: 5 }), { tile: { walkable: true, type: 'floor' } }],
    ])
    const state = createState(cells, { x: 5, y: 5 })

    const result = validateMove(state, 'E')
    expect(result.valid).toBe(true)
    expect(result.newPosition).toEqual({ x: 6, y: 5 })
  })

  it('blocks movement by a wall', () => {
    const cells = new Map([
      [key({ x: 5, y: 5 }), { tile: { walkable: true, type: 'floor' } }],
      [key({ x: 6, y: 5 }), { tile: { walkable: false, type: 'wall' } }],
    ])
    const state = createState(cells, { x: 5, y: 5 })

    const result = validateMove(state, 'E')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('Tile is not walkable')
  })

  it('blocks movement onto an enemy', () => {
    const enemyPos = { x: 6, y: 5 }
    const cells = new Map([
      [key({ x: 5, y: 5 }), { tile: { walkable: true, type: 'floor' } }],
      [key(enemyPos), { tile: { walkable: true, type: 'floor' } }],
    ])
    const enemies = new Map([[key(enemyPos), { position: enemyPos }]])
    const state = createState(cells, { x: 5, y: 5 }, enemies)

    const result = validateMove(state, 'E')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('Tile occupied by enemy')
  })

  it('blocks movement out of bounds', () => {
    const cells = new Map([
      [key({ x: 0, y: 0 }), { tile: { walkable: true, type: 'floor' } }],
    ])
    const state = createState(cells, { x: 0, y: 0 })

    const result = validateMove(state, 'W')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('Out of bounds')
  })

  it('blocks movement when not in a dungeon run', () => {
    const state = {
      run: null,
      player: { position: { x: 5, y: 5 } },
    } as any

    const result = validateMove(state, 'N')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('Not in a dungeon run')
  })
})
