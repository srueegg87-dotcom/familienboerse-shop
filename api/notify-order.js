// Benachrichtigungs-Mail an info@familienboerse.ch bei jeder neuen Online-Bestellung.
// Versendet via Resend (resend.com) — benötigt ENV RESEND_API_KEY.
// Falls der Key fehlt, wird kein Fehler geworfen — die Bestellung läuft trotzdem.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { order, items } = req.body || {}
  if (!order) return res.status(400).json({ error: 'order fehlt' })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('RESEND_API_KEY ist nicht gesetzt — Mail wird übersprungen.')
    return res.status(200).json({ skipped: true, reason: 'RESEND_API_KEY not configured' })
  }

  const FROM = process.env.RESEND_FROM || 'Rüegg\'s Familienbörse <onboarding@resend.dev>'
  const TO = process.env.SHOP_NOTIFY_TO || 'info@familienboerse.ch'

  const deliveryLabel = order.delivery_type === 'shipping' ? 'Versand' : 'Abholung'
  const paymentLabel = {
    online: 'Karte/TWINT online',
    invoice: 'Rechnung per E-Mail',
    cash_pickup: 'Bar/TWINT bei Abholung'
  }[order.payment_method] || order.payment_method

  const subject = `Bestellung im Shop · ${deliveryLabel} · ${order.order_nr}`

  const fmtCHF = (n) => 'CHF ' + Number(n || 0).toFixed(2)
  const itemRows = (items || []).map(i =>
    `<tr><td style="padding:6px 4px;border-bottom:1px dashed #eee">${escapeHtml(i.name)}</td>
         <td style="padding:6px 4px;border-bottom:1px dashed #eee;color:#777;font-family:monospace;font-size:12px">${escapeHtml(i.sku || '—')}</td>
         <td style="padding:6px 4px;border-bottom:1px dashed #eee;text-align:right;font-weight:600">${fmtCHF(i.price)}</td></tr>`
  ).join('')

  const addressBlock = order.delivery_type === 'shipping' ? `
    <p style="margin:6px 0"><strong>Versand an:</strong><br>
      ${escapeHtml(order.shipping_name || '')}<br>
      ${escapeHtml(order.shipping_address || '')}<br>
      ${escapeHtml(order.shipping_zip || '')} ${escapeHtml(order.shipping_city || '')}
    </p>` : '<p style="margin:6px 0"><strong>Abholung im Laden</strong></p>'

  const voucherBlock = order.voucher_code && Number(order.voucher_amount) > 0
    ? `<tr><td colspan="2" style="padding:4px;color:#2A5F4F">Gutschein ${escapeHtml(order.voucher_code)}</td><td style="padding:4px;text-align:right;color:#2A5F4F">−${fmtCHF(order.voucher_amount)}</td></tr>`
    : ''

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#1A1714;line-height:1.5;max-width:640px;margin:0 auto;padding:24px;background:#faf6ee">
  <div style="background:#fff;border-radius:12px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
    <h1 style="font-family:Georgia,serif;font-weight:500;margin:0 0 4px;color:#c4936a">Neue Bestellung</h1>
    <p style="margin:0 0 18px;color:#6b5f50">Bestell-Nr <strong>${escapeHtml(order.order_nr)}</strong> · ${new Date(order.created_at || Date.now()).toLocaleString('de-CH', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>

    <h2 style="font-family:Georgia,serif;font-weight:500;font-size:18px;margin:18px 0 6px">Kunde</h2>
    <p style="margin:4px 0"><strong>${escapeHtml(order.customer_name)}</strong></p>
    <p style="margin:4px 0">✉️ <a href="mailto:${escapeHtml(order.customer_email)}" style="color:#c4936a">${escapeHtml(order.customer_email)}</a></p>
    ${order.customer_phone ? `<p style="margin:4px 0">📞 <a href="tel:${escapeHtml(order.customer_phone)}" style="color:#c4936a">${escapeHtml(order.customer_phone)}</a></p>` : ''}

    <h2 style="font-family:Georgia,serif;font-weight:500;font-size:18px;margin:18px 0 6px">Auslieferung &amp; Bezahlung</h2>
    ${addressBlock}
    <p style="margin:6px 0"><strong>Bezahlmethode:</strong> ${escapeHtml(paymentLabel)}</p>

    <h2 style="font-family:Georgia,serif;font-weight:500;font-size:18px;margin:18px 0 8px">Artikel</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr style="background:#faf6ee">
        <th style="text-align:left;padding:8px 4px;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#777">Bezeichnung</th>
        <th style="text-align:left;padding:8px 4px;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#777">SKU</th>
        <th style="text-align:right;padding:8px 4px;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#777">Preis</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot style="font-size:14px">
        <tr><td colspan="2" style="padding:6px 4px">Zwischensumme</td><td style="padding:6px 4px;text-align:right">${fmtCHF(order.subtotal)}</td></tr>
        <tr><td colspan="2" style="padding:4px">Versand</td><td style="padding:4px;text-align:right">${Number(order.shipping_cost) > 0 ? fmtCHF(order.shipping_cost) : 'gratis'}</td></tr>
        ${voucherBlock}
        <tr><td colspan="2" style="padding:8px 4px;border-top:1px solid #1A1714;font-weight:700;font-size:16px">Total</td><td style="padding:8px 4px;border-top:1px solid #1A1714;text-align:right;font-weight:700;font-size:16px;color:#c4936a">${fmtCHF(order.total)}</td></tr>
      </tfoot>
    </table>

    ${order.notiz ? `<h2 style="font-family:Georgia,serif;font-weight:500;font-size:16px;margin:18px 0 6px">Notiz vom Kunden</h2><p style="background:#FFF3CD;padding:10px 14px;border-radius:8px;margin:0">${escapeHtml(order.notiz)}</p>` : ''}

    <p style="margin:24px 0 0;padding-top:14px;border-top:1px solid #eee;font-size:12px;color:#999">
      Diese Mail wurde automatisch erstellt. Antworten gehen direkt an den Kunden (${escapeHtml(order.customer_email)}).<br>
      Im Admin-Portal unter „Online" siehst du alle Bestellungen und kannst Status setzen.
    </p>
  </div>
</body></html>`

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], reply_to: order.customer_email, subject, html })
    })
    const data = await r.json()
    if (!r.ok) {
      console.error('Resend error:', data)
      return res.status(200).json({ error: data?.message || 'Mail failed', detail: data })
    }
    return res.status(200).json({ ok: true, id: data.id })
  } catch (err) {
    console.error('Mail send exception:', err)
    return res.status(200).json({ error: err.message })
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
}
