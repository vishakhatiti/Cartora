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

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

/** Order confirmation. Demo orders say so plainly: no money was charged and no payment company was involved. */
export function orderConfirmationEmail({ order, orderUrl }) {
  const demoLine = order.payment?.demo ? 'Demo Mode — No Real Money Charged. This order was paid with a simulated payment.' : '';
  const lines = order.items.map((i) => `${i.title} x ${i.qty}  ${money(i.unitPriceCents * i.qty)}`);
  const text = [
    `Thank you for your order ${order.orderNumber}.`, '', ...lines, '',
    `Subtotal: ${money(order.subtotalCents)}`, `Shipping: ${order.shippingCents === 0 ? 'Free' : money(order.shippingCents)}`, `Total: ${money(order.totalCents)}`,
    ...(demoLine ? ['', demoLine] : []), '', `View your order: ${orderUrl}`, '', '- Cartora',
  ].join('\n');
  const rows = order.items.map((i) => `<tr><td style="padding:4px 0">${escapeHtml(i.title)} × ${i.qty}</td><td style="text-align:right">${money(i.unitPriceCents * i.qty)}</td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">
<h2 style="color:#0f766e;margin:0 0 12px">Cartora</h2>
<p>Thank you for your order <strong>${escapeHtml(order.orderNumber)}</strong>.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
<p style="font-size:14px">Subtotal ${money(order.subtotalCents)} · Shipping ${order.shippingCents === 0 ? 'Free' : money(order.shippingCents)}<br><strong>Total ${money(order.totalCents)}</strong></p>
${demoLine ? `<p style="background:#fef3c7;padding:8px 12px;border-radius:8px;font-size:14px"><strong>${escapeHtml(demoLine)}</strong></p>` : ''}
<p><a href="${escapeHtml(orderUrl)}">View your order</a></p>
</div>`;
  return { subject: `Your Cartora order ${order.orderNumber}`, text, html };
}
