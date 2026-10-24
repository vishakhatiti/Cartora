import { gmail } from '@googleapis/gmail';
import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../../utils/AppError.js';
import { buildRawMessage } from './mime.js';

/** Sends mail through the Gmail API using an OAuth2 refresh token (no SMTP, no password). */
export function createGmailMailer(env, { gmailClient } = {}) {
  let client = gmailClient;
  if (!client) {
    const auth = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
    client = gmail({ version: 'v1', auth });
  }
  return {
    async send({ to, subject, text, html }) {
      const raw = buildRawMessage({ from: `Cartora <${env.EMAIL_USER}>`, to, subject, text, html });
      try {
        await client.users.messages.send({ userId: 'me', requestBody: { raw } });
      } catch (err) {
        // Log the reason (for example invalid_grant when the refresh token expired), never the secrets.
        console.error(`Gmail send failed: ${err?.message ?? 'unknown error'}`);
        throw new AppError(502, 'We could not send the email. Please try again shortly.', 'EMAIL_FAILED');
      }
    },
  };
}

/**
 * Picks a mailer from the configuration.
 *  - Gmail credentials present: real emails.
 *  - Missing in development/test: prints the message to the server console so flows can be tried locally.
 *  - Missing in production: refuses, so a misconfigured server cannot pretend to send mail.
 */
export function createMailer(env) {
  const configured = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN && env.EMAIL_USER;
  if (configured) return createGmailMailer(env);

  if (env.NODE_ENV === 'production') {
    return {
      async send() {
        throw new AppError(503, 'Email is not configured on the server.', 'EMAIL_NOT_CONFIGURED');
      },
    };
  }
  return {
    async send({ to, subject, text }) {
      if (env.NODE_ENV !== 'test') console.log(`[dev mail] to=${to} subject="${subject}"\n${text}`);
    },
  };
}
