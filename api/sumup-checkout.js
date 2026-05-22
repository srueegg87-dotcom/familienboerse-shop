// api/sumup-checkout.js — SumUp Online-Zahlung für den Webshop.
//   GET  /api/sumup-checkout?check=1      -> Diagnose: Key gültig? merchant_code? (kein Secret im Output)
//   POST { action:'create', amount, currency, checkout_reference, description }
//                                          -> erstellt SumUp-Checkout, liefert { id, ... }
//   POST { action:'status', checkout_id } -> Status des Checkouts (PAID/PENDING/FAILED)
//
// Env (im Shop-Vercel-Projekt): SUMUP_API_KEY (Pflicht), SUMUP_MERCHANT_CODE (optional; sonst via /me)
const SUMUP_API = 'https://api.sumup.com/v0.1';

async function sumupFetch(path, opts = {}) {
  const key = process.env.SUMUP_API_KEY;
  const r = await fetch(`${SUMUP_API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
  return { status: r.status, ok: r.ok, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.SUMUP_API_KEY) {
    const found = Object.keys(process.env).filter(k => /sum.?up/i.test(k));
    return res.status(500).json({
      error: 'SUMUP_API_KEY fehlt im Shop-Projekt (Vercel-Env)',
      gefundene_sumup_variablen: found,
      hinweis: found.length ? 'Variable existiert, aber NICHT als SUMUP_API_KEY benannt – exakt so umbenennen.' : 'Keine SumUp-Variable sichtbar – evtl. nur für Preview/Development statt Production gesetzt, oder Redeploy fehlt.'
    });
  }

  try {
    // Diagnose
    if (req.method === 'GET' && req.query.check === '1') {
      const me = await sumupFetch('/me');
      if (!me.ok) {
        return res.status(me.status).json({ ok: false, status: me.status, detail: me.data?.detail || me.data?.error_message || me.data });
      }
      return res.status(200).json({
        ok: true,
        merchant_code: me.data?.merchant_profile?.merchant_code || null,
        company: me.data?.merchant_profile?.company_name || null,
        country: me.data?.merchant_profile?.country || null,
        env_merchant_code_set: !!process.env.SUMUP_MERCHANT_CODE,
      });
    }

    if (req.method === 'POST') {
      const { action, amount, currency = 'CHF', checkout_reference, checkout_id, description } = req.body || {};

      if (action === 'create') {
        if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'amount fehlt/ungültig' });
        let merchantCode = process.env.SUMUP_MERCHANT_CODE;
        if (!merchantCode) {
          const me = await sumupFetch('/me');
          merchantCode = me.data?.merchant_profile?.merchant_code;
        }
        const body = {
          checkout_reference: checkout_reference || `RFB-${Date.now()}`,
          amount: Number(Number(amount).toFixed(2)),
          currency,
          merchant_code: merchantCode,
          description: description || "Rüegg's Familienbörse",
        };
        const r = await sumupFetch('/checkouts', { method: 'POST', body: JSON.stringify(body) });
        return res.status(r.status).json(r.data);
      }

      if (action === 'status') {
        if (!checkout_id) return res.status(400).json({ error: 'checkout_id fehlt' });
        const r = await sumupFetch(`/checkouts/${encodeURIComponent(checkout_id)}`);
        return res.status(r.status).json(r.data);
      }

      return res.status(400).json({ error: 'Unbekannte action (create|status)' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[sumup-checkout]', e);
    return res.status(500).json({ error: e.message });
  }
}
