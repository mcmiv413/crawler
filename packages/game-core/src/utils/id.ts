const UUID_BYTE_COUNT = 16;
const FALLBACK_SEED_SALT = 0x9e3779b9;
const FALLBACK_ZERO_STATE = 0x6d2b79f5;

let fallbackSequence = 0;

export function generateId(): string {
  const webCrypto = getWebCrypto();
  if (webCrypto?.randomUUID !== undefined) {
    return webCrypto.randomUUID();
  }

  return createUuidV4(webCrypto);
}

function createUuidV4(webCrypto?: WebCryptoLike): string {
  const bytes = fillRandomBytes(new Uint8Array(UUID_BYTE_COUNT), webCrypto);
  const versionByte = bytes.at(6);
  const variantByte = bytes.at(8);
  if (versionByte === undefined || variantByte === undefined) {
    throw new Error('UUID byte generation requires 16 bytes');
  }
  bytes[6] = (versionByte & 0x0f) | 0x40;
  bytes[8] = (variantByte & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10).join(''),
  ].join('-');
}

function fillRandomBytes(bytes: Uint8Array, webCrypto?: WebCryptoLike): Uint8Array {
  if (webCrypto?.getRandomValues !== undefined) {
    return webCrypto.getRandomValues(bytes);
  }

  let state = createFallbackSeed();
  for (let index = 0; index < bytes.length; index += 1) {
    state = nextXorshift32(state);
    bytes[index] = state & 0xff;
  }

  return bytes;
}

function createFallbackSeed(): number {
  fallbackSequence = (fallbackSequence + 1) >>> 0;
  const perfSeed = getPerformanceSeed();
  const pidSeed = getPidSeed();
  const seed = (perfSeed ^ pidSeed ^ fallbackSequence ^ FALLBACK_SEED_SALT) >>> 0;
  return seed === 0 ? FALLBACK_ZERO_STATE : seed;
}

function nextXorshift32(state: number): number {
  let next = state >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

interface WebCryptoLike {
  readonly randomUUID?: () => string;
  readonly getRandomValues?: (bytes: Uint8Array) => Uint8Array;
}

function getWebCrypto(): WebCryptoLike | undefined {
  const maybeCrypto = Reflect.get(globalThis, 'crypto');
  if (isObjectLike(maybeCrypto) === false) {
    return undefined;
  }

  const randomUUID = Reflect.get(maybeCrypto, 'randomUUID');
  const getRandomValues = Reflect.get(maybeCrypto, 'getRandomValues');

  return {
    randomUUID: typeof randomUUID === 'function'
      ? (): string => (randomUUID as () => string).call(maybeCrypto)
      : undefined,
    getRandomValues: typeof getRandomValues === 'function'
      ? (bytes): Uint8Array => (getRandomValues as (bytes: Uint8Array) => Uint8Array).call(maybeCrypto, bytes)
      : undefined,
  };
}

function getPerformanceSeed(): number {
  const maybePerformance = Reflect.get(globalThis, 'performance');
  if (isObjectLike(maybePerformance) === false) {
    return 0;
  }

  const now = Reflect.get(maybePerformance, 'now');
  const timeOrigin = Reflect.get(maybePerformance, 'timeOrigin');
  const nowValue = typeof now === 'function' ? (now as () => number).call(maybePerformance) : 0;
  const timeOriginValue = typeof timeOrigin === 'number' ? timeOrigin : 0;
  return ((timeOriginValue >>> 0) ^ ((nowValue * 1_000_000) >>> 0)) >>> 0;
}

function getPidSeed(): number {
  const maybeProcess = Reflect.get(globalThis, 'process');
  if (isObjectLike(maybeProcess) === false) {
    return 0;
  }

  const pid = Reflect.get(maybeProcess, 'pid');
  return typeof pid === 'number' ? pid >>> 0 : 0;
}

function isObjectLike(value: unknown): value is object {
  return Object(value) === value;
}
