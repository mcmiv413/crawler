import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface ParsedSprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AtlasEntry {
  name: string;
  xy: [number, number];
  size: [number, number];
  index: number;
}

/**
 * Parse libGDX .atlas format.
 * Modern (non-legacy) libGDX TexturePacker output uses top-left origin,
 * matching canvas coordinates — no y-flip needed.
 */
function parseAtlas(atlasPath: string): {
  sprites: Record<string, ParsedSprite>;
  atlasHeight: number;
} {
  const content = readFileSync(atlasPath, 'utf-8');
  const lines = content.split('\n');

  let atlasHeight = 1024;
  const spritesByName = new Map<string, AtlasEntry[]>();

  let i = 0;

  // Parse header (first 5 lines)
  for (let j = 0; j < 5 && j < lines.length; j++) {
    const line = lines[j];
    if (!line) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith('size:')) {
      const match = trimmed.match(/size:\s*(\d+),(\d+)/);
      if (match && match[1] && match[2]) {
        atlasHeight = parseInt(match[2], 10);
      }
    }
  }
  i = 5; // Start parsing sprites after the header

  // Parse sprite entries
  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }

    // Skip empty lines and indented lines
    if (line.trim() === '' || line.startsWith(' ') || line.startsWith('\t')) {
      i++;
      continue;
    }

    // This is a sprite name (no leading whitespace)
    const spriteName = line.trim();
    const entry: AtlasEntry = { name: spriteName, xy: [0, 0], size: [0, 0], index: -1 };

    // Read the next few lines for this sprite's properties
    i++;
    while (i < lines.length) {
      const propLine = lines[i];
      if (!propLine || (!propLine.startsWith(' ') && !propLine.startsWith('\t'))) {
        break; // Next sprite entry
      }

      const trimmed = propLine.trim();
      if (trimmed.startsWith('xy:')) {
        const match = trimmed.match(/xy:\s*(\d+),\s*(\d+)/);
        if (match && match[1] && match[2]) {
          entry.xy = [parseInt(match[1], 10), parseInt(match[2], 10)];
        }
      } else if (trimmed.startsWith('size:')) {
        const match = trimmed.match(/size:\s*(\d+),\s*(\d+)/);
        if (match && match[1] && match[2]) {
          entry.size = [parseInt(match[1], 10), parseInt(match[2], 10)];
        }
      } else if (trimmed.startsWith('index:')) {
        const match = trimmed.match(/index:\s*(-?\d+)/);
        if (match && match[1]) {
          entry.index = parseInt(match[1], 10);
        }
      }
      i++;
    }

    if (!spritesByName.has(spriteName)) {
      spritesByName.set(spriteName, []);
    }
    spritesByName.get(spriteName)?.push(entry);
  }

  // Convert to output format
  const sprites: Record<string, ParsedSprite> = {};

  for (const [name, entries] of spritesByName.entries()) {
    // Sort by index to ensure frame 0 comes first
    entries.sort((a, b) => (a.index === -1 ? 0 : a.index) - (b.index === -1 ? 0 : b.index));

    for (let frameIdx = 0; frameIdx < entries.length; frameIdx++) {
      const entry = entries[frameIdx];
      if (!entry) continue;
      const [rawX, rawY] = entry.xy;
      const [w, h] = entry.size;

      const spriteKey = entries.length === 1 ? name : `${name}#${frameIdx}`;
      sprites[spriteKey] = {
        x: rawX,
        y: rawY,
        w,
        h,
      };
    }

    // If multi-frame, add a plain key pointing to frame 0
    if (entries.length > 1) {
      const firstEntry = entries[0];
      if (firstEntry) {
        const [rawX, rawY] = firstEntry.xy;
        const [w, h] = firstEntry.size;
        sprites[name] = { x: rawX, y: rawY, w, h };
      }
    }
  }

  return { sprites, atlasHeight };
}

function main() {
  const atlasPath = resolve(process.cwd(), 'packages/content/src/sprites/Dawnlike.atlas');
  const outputPath = resolve(process.cwd(), 'packages/content/src/sprites/dawnlike-atlas-raw.ts');

  try {
    const { sprites, atlasHeight } = parseAtlas(atlasPath);

    // Generate TypeScript output
    const entries = Object.entries(sprites)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, rect]) => `  '${key}': { x: ${rect.x}, y: ${rect.y}, w: ${rect.w}, h: ${rect.h} }`)
      .join(',\n');

    const output = `// AUTO-GENERATED — do not edit. Run: pnpm parse-atlas
export const DAWNLIKE_ATLAS: Record<string, { x: number; y: number; w: number; h: number }> = {
${entries}
};
export const ATLAS_HEIGHT = ${atlasHeight};
`;

    writeFileSync(outputPath, output, 'utf-8');
    console.log(`✓ Generated ${outputPath}`);
    console.log(`✓ Parsed ${Object.keys(sprites).length} sprite entries`);
    console.log(`✓ Atlas height: ${atlasHeight}`);
  } catch (error) {
    console.error('Error parsing atlas:', error);
    process.exit(1);
  }
}

main();
