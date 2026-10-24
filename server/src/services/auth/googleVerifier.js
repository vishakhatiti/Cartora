import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../../utils/AppError.js';

/**
 * Verifies a Google sign-in ID token (the "credential" from Google's sign-in button): signature, expiry,
 * issuer and that it was issued for OUR client id. Returns only the fields Cartora needs.
 */
export function createGoogleVerifier(clientId, { client = new OAuth2Client() } = {}) {
  return {
    async verify(credential) {
      if (!clientId) throw new AppError(503, 'Google sign-in is not configured on the server.', 'GOOGLE_NOT_CONFIGURED');
      let payload;
      try {
        const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
        payload = ticket.getPayload();
      } catch {
        throw new AppError(401, 'Google sign-in failed. Please try again.', 'GOOGLE_INVALID');
      }
      if (!payload?.sub || !payload.email) {
        throw new AppError(401, 'Google sign-in failed. Please try again.', 'GOOGLE_INVALID');
      }
      return {
        sub: String(payload.sub),
        email: String(payload.email).toLowerCase(),
        emailVerified: payload.email_verified === true,
        name: payload.name ? String(payload.name) : '',
        picture: typeof payload.picture === 'string' && payload.picture.startsWith('https://') ? payload.picture : null,
      };
    },
  };
}
