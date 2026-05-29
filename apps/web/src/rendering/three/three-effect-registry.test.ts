/**
 * Tests for the Three.js effect module registry.
 *
 * The registry maps AnimationId strings to ThreeEffectModule implementations.
 * It is intentionally separate from the canvas-based AnimationModule registry
 * in apps/web/src/animations/registry.ts.
 *
 * Duplicate-registration policy: last write wins (overwrite silently).
 * This matches the pattern used by the canvas animation registry and allows
 * hot-reload scenarios to re-register updated modules without error.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  register,
  get,
  clear,
} from './three-effect-registry.js';
import type {
  ThreeEffectContext,
  ThreeEffectModule,
  ThreeEffectScreenPosition,
} from './three-effect-types.js';

// ---------------------------------------------------------------------------
// Local test instance type
// ---------------------------------------------------------------------------

/**
 * A handle returned by ThreeEffectModule.create.
 * The real impl will be an Object3D or a container of Three objects.
 */
interface ThreeEffectInstance {
  readonly id: string;
  isDisposed: boolean;
}

// ---------------------------------------------------------------------------
// Local fixture factories — no imports from @dungeon/content
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<ThreeEffectContext> = {}): ThreeEffectContext {
  return {
    renderer: {},
    scene: {
      add: vi.fn(),
      remove: vi.fn(),
    },
    camera: {},
    canvasWidth: 720,
    canvasHeight: 528,
    vpLeft: 0,
    vpTop: 0,
    tileSize: 24,
    ...overrides,
  };
}

function makeEffect(id = 'effect-1'): ThreeEffectInstance {
  return { id, isDisposed: false };
}

/**
 * Build a ThreeEffectModule with vi.fn() methods so call counts are trackable.
 */
function makeModule(label = 'default'): ThreeEffectModule<ThreeEffectInstance> & {
  create: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
} {
  const instance = makeEffect(label);
  return {
    create: vi.fn((_ctx: ThreeEffectContext) => instance),
    setPosition: vi.fn((_effect: ThreeEffectInstance, _position: ThreeEffectScreenPosition) => {}),
    update: vi.fn((_effect: ThreeEffectInstance, _progress: number) => {}),
    dispose: vi.fn((_effect: ThreeEffectInstance) => {}),
  };
}

// Stable literal IDs — never imported from content packages
const ID_HEALING_PULSE = 'fx.self.test-healing-pulse' as const;
const ID_FIRE_BLAST = 'fx.impact.test-fire-blast' as const;
const ID_SHADOW_STEP = 'fx.utility.test-shadow-step' as const;

// ---------------------------------------------------------------------------
// Suite: registration
// ---------------------------------------------------------------------------

describe('register', () => {
  beforeEach(() => {
    clear();
  });

  it('stores a module so it can be retrieved by id', () => {
    const mod = makeModule('healing');
    register(ID_HEALING_PULSE, mod);
    expect(get(ID_HEALING_PULSE)).toBe(mod);
  });

  it('stores multiple modules independently', () => {
    const modA = makeModule('healing');
    const modB = makeModule('fire');
    register(ID_HEALING_PULSE, modA);
    register(ID_FIRE_BLAST, modB);

    expect(get(ID_HEALING_PULSE)).toBe(modA);
    expect(get(ID_FIRE_BLAST)).toBe(modB);
  });

  it('stores three independent modules', () => {
    const modA = makeModule('healing');
    const modB = makeModule('fire');
    const modC = makeModule('shadow');
    register(ID_HEALING_PULSE, modA);
    register(ID_FIRE_BLAST, modB);
    register(ID_SHADOW_STEP, modC);

    expect(get(ID_HEALING_PULSE)).toBe(modA);
    expect(get(ID_FIRE_BLAST)).toBe(modB);
    expect(get(ID_SHADOW_STEP)).toBe(modC);
  });

  it('overwrites a previously registered module on duplicate id (last-write-wins)', () => {
    const first = makeModule('first');
    const second = makeModule('second');

    register(ID_HEALING_PULSE, first);
    register(ID_HEALING_PULSE, second);

    // second registration must win; first is evicted
    expect(get(ID_HEALING_PULSE)).toBe(second);
    expect(get(ID_HEALING_PULSE)).not.toBe(first);
  });

  it('does not cross-contaminate unrelated ids after an overwrite', () => {
    const original = makeModule('original');
    const replacement = makeModule('replacement');
    const unrelated = makeModule('unrelated');

    register(ID_HEALING_PULSE, original);
    register(ID_FIRE_BLAST, unrelated);
    register(ID_HEALING_PULSE, replacement);

    expect(get(ID_HEALING_PULSE)).toBe(replacement);
    expect(get(ID_FIRE_BLAST)).toBe(unrelated);
  });
});

// ---------------------------------------------------------------------------
// Suite: resolution
// ---------------------------------------------------------------------------

describe('get', () => {
  beforeEach(() => {
    clear();
  });

  it('returns undefined for an id that was never registered', () => {
    expect(get(ID_HEALING_PULSE)).toBeUndefined();
  });

  it('returns undefined for an empty string id', () => {
    expect(get('' as any)).toBeUndefined();
  });

  it('returns undefined for an id with a similar but non-matching prefix', () => {
    register(ID_HEALING_PULSE, makeModule());
    expect(get('test.healing' as any)).toBeUndefined();
    expect(get('test.healing.puls' as any)).toBeUndefined();
    expect(get('TEST.HEALING.PULSE' as any)).toBeUndefined();
  });

  it('returns the exact same module reference that was registered', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);
    const retrieved = get(ID_HEALING_PULSE);
    expect(retrieved).toBe(mod);
  });

  it('is case-sensitive: upper-case id does not resolve lower-case registration', () => {
    register(ID_HEALING_PULSE, makeModule());
    expect(get(ID_HEALING_PULSE.toUpperCase() as any)).toBeUndefined();
  });

  it('does not return a module registered under a different id', () => {
    register(ID_HEALING_PULSE, makeModule('healing'));
    expect(get(ID_FIRE_BLAST)).toBeUndefined();
  });

  it('returns undefined after clear() empties the registry', () => {
    register(ID_HEALING_PULSE, makeModule());
    clear();
    expect(get(ID_HEALING_PULSE)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suite: module lifecycle — create
// ---------------------------------------------------------------------------

describe('ThreeEffectModule.create', () => {
  beforeEach(() => {
    clear();
  });

  it('create is callable with a context and returns an effect instance', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);

    const ctx = makeContext();
    const effect = get(ID_HEALING_PULSE)!.create(ctx);

    expect(effect).toBeDefined();
    expect((effect as any).id).toBe('default');
  });

  it('create receives the exact context that was passed', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);
    const ctx = makeContext();

    get(ID_HEALING_PULSE)!.create(ctx);

    expect(mod.create).toHaveBeenCalledWith(ctx);
  });

  it('create can be called multiple times producing independent instances', () => {
    let counter = 0;
    const multiModule: ThreeEffectModule<ThreeEffectInstance> = {
      create: vi.fn((_ctx: ThreeEffectContext) => makeEffect(`effect-${++counter}`)),
      setPosition: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
    };

    register(ID_HEALING_PULSE, multiModule);
    const resolved = get(ID_HEALING_PULSE)!;
    const ctx = makeContext();

    const a = resolved.create(ctx);
    const b = resolved.create(ctx);

    expect((a as any).id).toBe('effect-1');
    expect((b as any).id).toBe('effect-2');
    expect(a).not.toBe(b);
  });

  it('create does not throw for a minimal valid context', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);

    expect(() => {
      get(ID_HEALING_PULSE)!.create(makeContext());
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Suite: module lifecycle — setPosition
// ---------------------------------------------------------------------------

describe('ThreeEffectModule.setPosition', () => {
  beforeEach(() => {
    clear();
  });

  it('setPosition is callable with an effect and screen position', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);
    const effect = makeEffect();
    const position = { x: 120, y: 144, z: 0 } as const;

    expect(() => {
      get(ID_HEALING_PULSE)!.setPosition(effect, position);
    }).not.toThrow();
    expect(mod.setPosition).toHaveBeenCalledWith(effect, position);
  });
});

// ---------------------------------------------------------------------------
// Suite: module lifecycle — update
// ---------------------------------------------------------------------------

describe('ThreeEffectModule.update', () => {
  beforeEach(() => {
    clear();
  });

  it('update is callable with an effect and progress 0', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);
    const effect = makeEffect();

    expect(() => {
      get(ID_HEALING_PULSE)!.update(effect, 0);
    }).not.toThrow();
  });

  it('update is callable with progress 0.5', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);
    const effect = makeEffect();

    expect(() => {
      get(ID_HEALING_PULSE)!.update(effect, 0.5);
    }).not.toThrow();
  });

  it('update is callable with progress 1', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);
    const effect = makeEffect();

    expect(() => {
      get(ID_HEALING_PULSE)!.update(effect, 1);
    }).not.toThrow();
  });

  it('update receives the exact effect and progress values', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);
    const effect = makeEffect('my-effect');

    get(ID_HEALING_PULSE)!.update(effect, 0.75);

    expect(mod.update).toHaveBeenCalledWith(effect, 0.75);
  });

  it('update can be called multiple times on the same effect', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);
    const effect = makeEffect();
    const resolved = get(ID_HEALING_PULSE)!;

    resolved.update(effect, 0);
    resolved.update(effect, 0.25);
    resolved.update(effect, 0.5);
    resolved.update(effect, 1);

    expect(mod.update).toHaveBeenCalledTimes(4);
  });

  it('update does not mutate progress: module receives the value passed', () => {
    const capturedProgressValues: number[] = [];
    const mod: ThreeEffectModule<ThreeEffectInstance> = {
      create: vi.fn(() => makeEffect()),
      setPosition: vi.fn(),
      update: vi.fn((_effect, progress) => { capturedProgressValues.push(progress); }),
      dispose: vi.fn(),
    };
    register(ID_FIRE_BLAST, mod);
    const effect = makeEffect();
    const resolved = get(ID_FIRE_BLAST)!;

    resolved.update(effect, 0.1);
    resolved.update(effect, 0.9);

    expect(capturedProgressValues).toEqual([0.1, 0.9]);
  });
});

// ---------------------------------------------------------------------------
// Suite: module lifecycle — dispose
// ---------------------------------------------------------------------------

describe('ThreeEffectModule.dispose', () => {
  beforeEach(() => {
    clear();
  });

  it('dispose is callable with an effect and does not throw', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);
    const effect = makeEffect();

    expect(() => {
      get(ID_HEALING_PULSE)!.dispose(effect);
    }).not.toThrow();
  });

  it('dispose receives the exact effect reference', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);
    const effect = makeEffect('dispose-target');

    get(ID_HEALING_PULSE)!.dispose(effect);

    expect(mod.dispose).toHaveBeenCalledWith(effect);
    expect(mod.dispose).toHaveBeenCalledTimes(1);
  });

  it('dispose is called only once per effect in normal usage', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);
    const effect = makeEffect();

    get(ID_HEALING_PULSE)!.dispose(effect);

    expect(mod.dispose).toHaveBeenCalledTimes(1);
  });

  it('dispose on a different module does not call dispose on another module', () => {
    const modA = makeModule('A');
    const modB = makeModule('B');
    register(ID_HEALING_PULSE, modA);
    register(ID_FIRE_BLAST, modB);

    const effectA = makeEffect('A-instance');
    get(ID_HEALING_PULSE)!.dispose(effectA);

    expect(modA.dispose).toHaveBeenCalledTimes(1);
    expect(modB.dispose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite: full lifecycle integration
// ---------------------------------------------------------------------------

describe('full effect lifecycle (create → update → dispose)', () => {
  beforeEach(() => {
    clear();
  });

  it('runs create → update → dispose without error', () => {
    const mod = makeModule('lifecycle');
    register(ID_HEALING_PULSE, mod);
    const resolved = get(ID_HEALING_PULSE)!;
    const ctx = makeContext();

    const effect = resolved.create(ctx);
    resolved.update(effect, 0);
    resolved.update(effect, 0.5);
    resolved.update(effect, 1);
    resolved.dispose(effect);

    expect(mod.create).toHaveBeenCalledTimes(1);
    expect(mod.update).toHaveBeenCalledTimes(3);
    expect(mod.dispose).toHaveBeenCalledTimes(1);
  });

  it('instance produced by create is the same object passed to update and dispose', () => {
    const capturedInstances: ThreeEffectInstance[] = [];
    const mod: ThreeEffectModule<ThreeEffectInstance> = {
      create: vi.fn((_ctx) => {
        const inst = makeEffect('tracked');
        capturedInstances.push(inst);
        return inst;
      }),
      setPosition: vi.fn(),
      update: vi.fn((effect) => { capturedInstances.push(effect); }),
      dispose: vi.fn((effect) => { capturedInstances.push(effect); }),
    };

    register(ID_FIRE_BLAST, mod);
    const resolved = get(ID_FIRE_BLAST)!;
    const ctx = makeContext();

    const created = resolved.create(ctx);
    resolved.update(created, 0.5);
    resolved.dispose(created);

    // All three references must be the same object
    expect(capturedInstances[0]).toBe(capturedInstances[1]);
    expect(capturedInstances[0]).toBe(capturedInstances[2]);
  });

  it('two independent modules run full lifecycles without interfering', () => {
    const modA = makeModule('A');
    const modB = makeModule('B');
    register(ID_HEALING_PULSE, modA);
    register(ID_FIRE_BLAST, modB);

    const ctx = makeContext();
    const effectA = get(ID_HEALING_PULSE)!.create(ctx);
    const effectB = get(ID_FIRE_BLAST)!.create(ctx);

    get(ID_HEALING_PULSE)!.update(effectA, 0.3);
    get(ID_FIRE_BLAST)!.update(effectB, 0.7);

    get(ID_HEALING_PULSE)!.dispose(effectA);
    get(ID_FIRE_BLAST)!.dispose(effectB);

    expect(modA.create).toHaveBeenCalledTimes(1);
    expect(modA.update).toHaveBeenCalledWith(effectA, 0.3);
    expect(modA.dispose).toHaveBeenCalledWith(effectA);

    expect(modB.create).toHaveBeenCalledTimes(1);
    expect(modB.update).toHaveBeenCalledWith(effectB, 0.7);
    expect(modB.dispose).toHaveBeenCalledWith(effectB);
  });
});

// ---------------------------------------------------------------------------
// Suite: edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  beforeEach(() => {
    clear();
  });

  it('get with a unicode id returns undefined when not registered', () => {
    expect(get('test.♥.pulse' as any)).toBeUndefined();
  });

  it('register and get round-trip a unicode id', () => {
    const unicodeId = 'test.♥.pulse' as any;
    const mod = makeModule();
    register(unicodeId, mod);
    expect(get(unicodeId)).toBe(mod);
  });

  it('registry holds many modules without collision', () => {
    const count = 100;
    const mods: Array<[string, ThreeEffectModule<ThreeEffectInstance>]> = [];
    for (let i = 0; i < count; i++) {
      const id = `test.bulk.effect-${i}` as any;
      const mod = makeModule(`bulk-${i}`);
      register(id, mod);
      mods.push([id, mod]);
    }

    for (const [id, mod] of mods) {
      expect(get(id as any)).toBe(mod);
    }
  });

  it('registering with a special-character id does not throw', () => {
    const specialId = 'test.effect/slash+plus=equals' as any;
    const mod = makeModule();
    expect(() => register(specialId, mod)).not.toThrow();
    expect(get(specialId)).toBe(mod);
  });

  it('registering the same object under two different ids returns the same reference for each', () => {
    const shared = makeModule('shared');
    register(ID_HEALING_PULSE, shared);
    register(ID_FIRE_BLAST, shared);

    expect(get(ID_HEALING_PULSE)).toBe(shared);
    expect(get(ID_FIRE_BLAST)).toBe(shared);
  });

  it('clear() removes all registered modules', () => {
    register(ID_HEALING_PULSE, makeModule());
    register(ID_FIRE_BLAST, makeModule());
    register(ID_SHADOW_STEP, makeModule());

    clear();

    expect(get(ID_HEALING_PULSE)).toBeUndefined();
    expect(get(ID_FIRE_BLAST)).toBeUndefined();
    expect(get(ID_SHADOW_STEP)).toBeUndefined();
  });

  it('register works normally after clear()', () => {
    register(ID_HEALING_PULSE, makeModule('before-clear'));
    clear();

    const fresh = makeModule('after-clear');
    register(ID_HEALING_PULSE, fresh);

    expect(get(ID_HEALING_PULSE)).toBe(fresh);
  });

  it('update with boundary progress values 0 and 1 does not throw', () => {
    const mod = makeModule();
    register(ID_HEALING_PULSE, mod);
    const effect = makeEffect();

    expect(() => get(ID_HEALING_PULSE)!.update(effect, 0)).not.toThrow();
    expect(() => get(ID_HEALING_PULSE)!.update(effect, 1)).not.toThrow();
  });

  it('update with negative progress is forwarded as-is (range clamping is caller responsibility)', () => {
    const received: number[] = [];
    const mod: ThreeEffectModule<ThreeEffectInstance> = {
      create: vi.fn(() => makeEffect()),
      setPosition: vi.fn(),
      update: vi.fn((_e, p) => { received.push(p); }),
      dispose: vi.fn(),
    };
    register(ID_SHADOW_STEP, mod);

    get(ID_SHADOW_STEP)!.update(makeEffect(), -0.1);

    expect(received).toEqual([-0.1]);
  });

  it('update with progress > 1 is forwarded as-is (range clamping is caller responsibility)', () => {
    const received: number[] = [];
    const mod: ThreeEffectModule<ThreeEffectInstance> = {
      create: vi.fn(() => makeEffect()),
      setPosition: vi.fn(),
      update: vi.fn((_e, p) => { received.push(p); }),
      dispose: vi.fn(),
    };
    register(ID_SHADOW_STEP, mod);

    get(ID_SHADOW_STEP)!.update(makeEffect(), 1.5);

    expect(received).toEqual([1.5]);
  });
});
