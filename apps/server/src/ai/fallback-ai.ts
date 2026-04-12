import type { AiService, NpcDialogueContext, RumorContext, RunSummaryContext, NemesisNameContext, NemesisLootContext } from '@dungeon/core/ai/ai-service';
import { NPC_GREETINGS, FALLBACK_RUMORS, FALLBACK_NEMESIS_NAMES, FALLBACK_NEMESIS_TITLES, FALLBACK_NEMESIS_RUMORS, FACTION_RUMORS } from '@dungeon/content';

export class FallbackAiService implements AiService {
  async generateDialogue(context: NpcDialogueContext): Promise<string> {
    const greetings = NPC_GREETINGS[context.npc.role] ?? NPC_GREETINGS['elder']!;
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }

  async generateRumor(context: RumorContext): Promise<string> {
    // Build pool: blend faction/nemesis rumors based on world state
    let pool = [...FALLBACK_RUMORS];
    if (context.townState.fear > 30) {
      pool = [...pool, ...FALLBACK_NEMESIS_RUMORS];
    }

    // Add faction-specific rumors from context if any strong factions provided
    for (const [factionId, factionPool] of Object.entries(FACTION_RUMORS)) {
      // Use total runs as a proxy for faction knowledge (simplified heuristic)
      if (context.totalRuns > 0 && Math.random() < 0.4) {
        pool = [...pool, ...factionPool];
      }
      void factionId;
    }

    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  async generateRunSummary(context: RunSummaryContext): Promise<string> {
    const { runMetrics, playerName, floor } = context;
    if (runMetrics.causeOfEnd === 'death') {
      return `${playerName} fell on floor ${floor} after slaying ${runMetrics.enemiesKilled} enemies. The dungeon claims another soul.`;
    }
    return `${playerName} retreated from floor ${floor} having slain ${runMetrics.enemiesKilled} enemies and earned ${runMetrics.goldEarned} gold.`;
  }

  async generateNemesisName(_context: NemesisNameContext): Promise<{ name: string; title: string }> {
    const name = FALLBACK_NEMESIS_NAMES[Math.floor(Math.random() * FALLBACK_NEMESIS_NAMES.length)]!;
    const title = FALLBACK_NEMESIS_TITLES[Math.floor(Math.random() * FALLBACK_NEMESIS_TITLES.length)]!;
    return { name, title };
  }

  async generateNemesisLoot(context: NemesisLootContext): Promise<{ name: string; description: string }> {
    const { nemesisName, nemesisTitle, weaponType, rank, tier } = context;

    // Generate name based on tier and type
    const rarities = { 3: 'Legendary', 2: 'Epic', 1: 'Rare' };
    const rarity = rarities[rank as keyof typeof rarities] ?? 'Rare';

    // Fallback weapon/armor descriptors if weaponType is null
    const typeDescriptors: Record<string, string[]> = {
      blade: ['Executioner\'s Edge', 'Cleaver of Ages', 'Void Blade', 'Soul Cleaver', 'Shattered Fang'],
      bludgeon: ['Skull Smasher', 'Warlord\'s Maul', 'Dread Hammer', 'Bone Crusher', 'Reaver\'s Fist'],
      axe: ['Hatchet of Dread', 'Reaper\'s Axe', 'Bloodfallen Hatchet', 'Nightfall Axe', 'Doombringer'],
      ranged: ['Bow of Shadows', 'Darkshot Bow', 'Plague Arrow', 'Echoing Missile', 'Venom\'s Kiss'],
      armor: ['Mantle of Dread', 'Void Plate', 'Shadow Guard', 'Cursed Cuirass', 'Dreadpact Armor'],
    };

    const descriptorKey = weaponType ?? 'armor';
    const descriptors = typeDescriptors[descriptorKey] ?? typeDescriptors['armor']!;
    const descriptor = descriptors[Math.floor(Math.random() * descriptors.length)]!;

    // Create the item name
    let name: string;
    if (nemesisName && nemesisName.trim()) {
      name = `${descriptor} of ${nemesisName}`;
    } else {
      name = `${rarity} ${descriptor}`;
    }

    const description = nemesisName && nemesisName.trim()
      ? `A grim artifact left by ${nemesisName} ${nemesisTitle}. It carries the weight of their fallen might and echoes with malevolent intent.`
      : `A dangerous relic from the depths. Forged in shadow and tempered by countless battles.`;

    return { name, description };
  }
}
