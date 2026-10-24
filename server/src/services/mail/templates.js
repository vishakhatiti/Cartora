const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const PURPOSES = {
  verify_email: { subject: 'Verify your Cartora email', lead: 'Use this code to verify your email address.' },
  login: { subject: 'Your Cartora sign-in code', lead: 'Use this code to sign in to Cartora.' },
  reset_password: { subject: 'Reset your Cartora password', lead: 'Use this code to reset your password.' },
};

/** Build the one-time-code email for a purpose. */
export function otpEmail({ purpose, code, minutes }) {
  const { subject, lead } = PURPOSES[purpose];
  const text = `${lead}\n\nYour code: ${code}\n\nIt expires in ${minutes} minutes and works once. If you did not ask for it, you can ignore this email; nobody can use it without access to your inbox.\n\n- Cartora`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#0f172a">
<h2 style="color:#0f766e;margin:0 0 12px">Cartora</h2>
<p>${escapeHtml(lead)}</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:20px 0">${escapeHtml(code)}</p>
<p style="color:#475569;font-size:14px">It expires in ${minutes} minutes and works once. If you did not ask for it, you can ignore this email.</p>
</div>`;
  return { subject, text, html };
}
