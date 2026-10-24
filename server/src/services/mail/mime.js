const CRLF = /[\r\n]/;

function header(name, value) {
  if (CRLF.test(value)) throw new Error(`Invalid ${name} header`); // blocks header injection
  return `${name}: ${value}`;
}

const encodeSubject = (subject) => `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
const wrap = (base64) => base64.replace(/(.{76})/g, '$1\r\n');

/** Build a base64url RFC 2822 message (text + html) in the form the Gmail API expects. */
export function buildRawMessage({ from, to, subject, text, html }) {
  const boundary = `cartora_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const part = (type, body) => [
    `--${boundary}`,
    `Content-Type: ${type}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    wrap(Buffer.from(body, 'utf8').toString('base64')),
  ].join('\r\n');

  const message = [
    header('From', from),
    header('To', to),
    header('Subject', encodeSubject(subject)),
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    part('text/plain', text),
    part('text/html', html),
    `--${boundary}--`,
    '',
  ].join('\r\n');

  return Buffer.from(message, 'utf8').toString('base64url');
}
