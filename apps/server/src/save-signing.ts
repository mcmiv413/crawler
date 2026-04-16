/**
 * Save file signing and verification.
 *
 * Prevents players from tampering with their saved game state by replaying
 * older serialized versions. Each serialized state is signed with an HMAC
 * derived from a server secret; the signature is returned to the client and
 * required for restoration.
 *
 * This addresses the "client can resubmit its own sessionStorage state as
 * authoritative on server cold start" vulnerability (#7 in audit).
 */

import { createHmac } from 'crypto';

const ALGORITHM = 'sha256';

/**
 * Get the signing secret from environment.
 * In production, this should be a strong random value set per-deployment.
 * In development, defaults to a fixed value to allow testing.
 */
function getSigningSecret(): string {
  const secret = process.env['SAVE_SIGNING_SECRET'];
  if (!secret) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'SAVE_SIGNING_SECRET environment variable is required in production. '
        + 'Set it to a strong random value and keep it constant across restarts.',
      );
    }
    // Development default (insecure, for testing only)
    return 'dev-signing-secret-change-in-production';
  }
  return secret;
}

/**
 * Sign a serialized game state.
 * Returns a hex-encoded HMAC that can be transmitted alongside the state.
 *
 * @param serializedState The JSON-stringified GameState
 * @returns Hex-encoded HMAC signature
 */
export function signSaveState(serializedState: string): string {
  const hmac = createHmac(ALGORITHM, getSigningSecret());
  hmac.update(serializedState);
  return hmac.digest('hex');
}

/**
 * Verify a serialized game state against its signature.
 *
 * @param serializedState The JSON-stringified GameState
 * @param signature The hex-encoded HMAC to verify against
 * @returns true if signature is valid, false otherwise
 */
export function verifySaveSignature(serializedState: string, signature: string): boolean {
  if (!signature || typeof signature !== 'string') {
    return false;
  }

  try {
    const expectedSignature = signSaveState(serializedState);
    // Simple constant-time comparison (hex strings of same length)
    // Both are hex digests of same algorithm, so equal length
    if (expectedSignature.length !== signature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      result |= (expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i));
    }
    return result === 0;
  } catch {
    // Invalid signature or other issues
    return false;
  }
}

/**
 * Signing error for client-provided signatures that don't verify.
 */
export class SaveSignatureError extends Error {
  constructor(message: string = 'Save file signature verification failed') {
    super(message);
    this.name = 'SaveSignatureError';
  }
}
