/** Fallback town dialogue and descriptions */

export const NPC_GREETINGS: Record<string, readonly string[]> = {
  shopkeeper: [
    'Welcome, adventurer. See anything you like?',
    'Back again? Browse my wares.',
    'Gold speaks louder than swords here.',
  ],
  healer: [
    'You look worse for wear. Let me help.',
    'Sit still. This will sting a bit.',
    'Another survivor of the depths. Come, rest.',
  ],
  informant: [
    'I hear things. Whispers from below.',
    'Careful down there. Things have changed.',
    'I might know something useful... for a price.',
  ],
  blacksmith: [
    'Need something repaired? Or forged fresh?',
    'Good steel saves lives. Remember that.',
    'Bring me materials and I\'ll make something worth carrying.',
  ],
  elder: [
    'The town grows restless. We need heroes.',
    'Every run teaches us something. Never stop learning.',
    'Be cautious. The dungeon remembers those who enter.',
  ],
};

export const FALLBACK_RUMORS: readonly string[] = [
  'They say the deeper floors shift when no one is looking.',
  'A merchant went below last week. Only his boots came back.',
  'The old mines connect to something older. Something that breathes.',
  'Frost creeps up from below some nights. Unnatural cold.',
  'I heard clicking sounds from the well last evening. Like bones.',
  'The goblins have been quiet lately. That worries me more than raids.',
  'There are rooms down there that lock behind you. Bring a key or pray.',
  'The moss on floor three glows. Beautiful, but it burns if you touch it.',
  'Someone left marks on the walls below. Warnings, maybe. Or invitations.',
  'Gold is not the only thing that glitters in the dark.',
  'The creatures below grow stronger when the corruption rises.',
  'An old adventurer told me: never fight what you cannot see.',
  'The stairs going down are easy to find. The stairs going up, less so.',
  'Some say the dungeon was a temple once, before the corruption came.',
  'Watch for traps near treasure. The dungeon teaches greed a harsh lesson.',
  'The ogres on the lower floors fear fire. Remember that.',
  'Potions are worth more than swords when poison fills the air.',
  'I have seen brave warriors return as cowards. The dungeon changes people.',
  'The blacksmith says certain blades hold enchantments. Worth seeking out.',
  'Rest well before descending. The dungeon does not forgive exhaustion.',
];

export const TOWN_DESCRIPTIONS = {
  prosperous: 'The town bustles with activity. Market stalls overflow with goods.',
  normal: 'The town goes about its business, watchful but calm.',
  fearful: 'Shuttered windows and empty streets. Fear hangs heavy.',
  corrupted: 'A dark pall lies over the town. Something is very wrong.',
} as const;

/** Rumors generated when a specific faction is growing powerful */
export const FACTION_RUMORS: Readonly<Record<string, readonly string[]>> = {
  goblin_warband: [
    'The goblin patrols have grown bold — they were spotted at the third gate last night.',
    'Traders refuse to use the east road. Too many goblin ambushes near the dungeon mouth.',
    'The warband has a leader now. Something changed them.',
    'I saw smoke rising from deep below — goblin cookfires, they say. Many of them.',
  ],
  undead_legion: [
    'The old catacombs hum with a cold wind — like the breath of a thousand dead.',
    'The last night guard vanished after hearing chanting from beneath the church. No one has seen him since.',
    'Skeletal hands claw at the stone walls after dark, carving names no one recognizes.',
    'The undead do not tire or fear. That is what terrifies me.',
  ],
  beast_swarm: [
    'Rats the size of dogs have been spotted in the storage rooms near the entrance.',
    'The spiders have been weaving webs across the second staircase. Something is nesting.',
    'The old tunnels are overrun. Every crevice holds something hungry.',
    'A golem was seen walking aboveground at dusk. It turned back before the gate.',
  ],
  shadow_cult: [
    'Someone found symbols carved into the dungeon walls — not goblin marks, something older.',
    'The imps have been spreading fire on the lower floors. Deliberate, methodical.',
    'They say the shadows whisper down there. And they know your name.',
    'Corruption seeps up from the deepest rooms. The shadow cult grows bolder.',
  ],
};

/** Messages for town prosperity rising */
export const PROSPERITY_RISING_MESSAGES: readonly string[] = [
  'The tavern rings with song for the first time in weeks.',
  'Merchants returned to the market square.',
  'New faces at the inn — word of easier dungeon runs has spread.',
  'The healer restocked her shelves. A good sign.',
  'Children play near the dungeon gate again.',
  'The town bells toll louder, echoing through every alley.',
  'Stalls brim with fresh produce, merchants haggling over bright colors.',
  'The blacksmith\'s forge glows brighter as he forges gleaming swords.',
  'A new banner unfurls above the inn, proclaiming peace and prosperity.',
  'Even the old stone walls seem to hum with newfound vigor.',
];

/** Messages for corruption/fear rising */
export const CORRUPTION_RISING_MESSAGES: readonly string[] = [
  'The herbalist packed her cart and left before dawn.',
  'Dogs howl through the night and refuse to be calmed.',
  'The well water tastes of iron. The elder says nothing.',
  'Three torches went dark on the same street, same moment.',
  'Something moved in the shadows near the dungeon gate. Too big for a rat.',
  'The innkeeper\'s sign flickered out, leaving only a rusted iron plaque.',
  'Street vendors abandoned their stalls, leaving crates of wilted produce.',
  'A child\'s laughter faded at the dungeon gate, replaced by distant clanking chains.',
  'The town council\'s meeting hall was boarded up, its doors sealed with grime.',
  'Once-bright murals on the walls now dripped with dark sludge.',
];
