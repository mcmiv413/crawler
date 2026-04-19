import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AbilityDropdown } from './AbilityDropdown';
import type { AbilityView, EntityView } from '@dungeon/presenter';

describe('AbilityDropdown', () => {
  it('does not assign targetId for self-targeted abilities when enemies are in range', () => {
    const onSelect = vi.fn();

    const abilities: AbilityView[] = [
      {
        id: 'second_wind',
        name: 'Second Wind',
        description: 'Heal yourself',
        ready: true,
        cooldownRemaining: 0,
        requiresTarget: false, // Self-targeted
        requiresDirection: false,
      },
    ];

    const enemies: EntityView[] = [
      {
        id: 'enemy1',
        x: 2,
        y: 2,
        ascii: 'g',
        color: '#0f0',
        name: 'Goblin',
        type: 'enemy',
        health: 10,
        maxHealth: 10,
        templateId: 'goblin',
      },
    ];

    render(
      <AbilityDropdown
        abilities={abilities}
        enemies={enemies}
        playerX={0}
        playerY={0}
        onSelect={onSelect}
      />
    );

    // Click the ability button
    const abilityButton = screen.getByText('Second Wind');
    fireEvent.click(abilityButton);

    // Should call onSelect with just abilityId, no targetId
    expect(onSelect).toHaveBeenCalledWith({ abilityId: 'second_wind' });
    expect(onSelect).not.toHaveBeenCalledWith(
      expect.objectContaining({ targetId: expect.anything() })
    );
  });

  it('assigns targetId for target-requiring abilities when enemies are in range', () => {
    const onSelect = vi.fn();

    const abilities: AbilityView[] = [
      {
        id: 'fireball',
        name: 'Fireball',
        description: 'Deal fire damage',
        ready: true,
        cooldownRemaining: 0,
        requiresTarget: true, // Requires target
        requiresDirection: false,
      },
    ];

    const enemies: EntityView[] = [
      {
        id: 'enemy1',
        x: 2,
        y: 2,
        ascii: 'g',
        color: '#0f0',
        name: 'Goblin',
        type: 'enemy',
        health: 10,
        maxHealth: 10,
        templateId: 'goblin',
      },
    ];

    render(
      <AbilityDropdown
        abilities={abilities}
        enemies={enemies}
        playerX={0}
        playerY={0}
        onSelect={onSelect}
      />
    );

    const abilityButton = screen.getByText('Fireball');
    fireEvent.click(abilityButton);

    // Should call onSelect with targetId for target-requiring abilities
    expect(onSelect).toHaveBeenCalledWith({ abilityId: 'fireball', targetId: 'enemy1' });
  });
});
