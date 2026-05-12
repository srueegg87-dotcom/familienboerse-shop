import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCart } from './CartContext'
import { supabase } from './supabaseClient'
import { Topbar, Footer } from './App.jsx'

const SHIPPING_COST = 7.00 // CHF, Schweizer Post B-Post Pauschal

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    customer_first_name: '', customer_last_name: '',
    customer_email: '', customer_phone: '',
    billing_address: '', billing_zip: '', billing_city: '',
    delivery_type: 'pickup',
    different_shipping: false,
    shipping_first_name: '', shipping_last_name: '',
    shipping_address: '', shipping_zip: '', shipping_city: '',
    payment_method: 'cash_pickup',
    notiz: '',
  })
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherInfo, setVoucherInfo] = useState(null)
  const [voucherErr, setVoucherErr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  // Wenn Warenkorb leer → zurück zur Startseite
  useEffect(() => { if (items.length === 0) navigate('/') }, [items.length, navigate])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const shippingCost = form.delivery_type === 'shipping' ? SHIPPING_COST : 0
  const baseTotal = subtotal + shippingCost

  let voucherDiscount = 0
  if (voucherInfo) {
    if (voucherInfo.type === 'percent') {
      voucherDiscount = subtotal * (Number(voucherInfo.percent) / 100)
      if (voucherInfo.max_discount) voucherDiscount = Math.min(voucherDiscount, Number(voucherInfo.max_discount))
    } else {
      voucherDiscount = Math.min(Number(voucherInfo.remaining_amount || 0), baseTotal)
    }
    voucherDiscount = Number(voucherDiscount.toFixed(2))
  }
  const total = Math.max(0, baseTotal - voucherDiscount)

  const checkVoucher = async () => {
    const code = voucherCode.trim().toUpperCase()
    if (!code) { setVoucherErr('Bitte Code eingeben.'); return }
    const { data, error } = await supabase.rpc('validate_voucher', { p_code: code, p_order_total: subtotal })
    if (error) { setVoucherErr('Fehler: ' + error.message); return }
    if (!data?.valid) { setVoucherErr(data?.message || 'Ungültiger Code'); setVoucherInfo(null); return }
    setVoucherInfo(data); setVoucherErr('')
  }
  const removeVoucher = () => { setVoucherInfo(null); setVoucherCode(''); setVoucherErr('') }

  const validate = () => {
    if (!form.customer_first_name.trim()) return 'Bitte Vornamen eintragen.'
    if (!form.customer_last_name.trim()) return 'Bitte Nachnamen eintragen.'
    if (!form.customer_email.trim() || !form.customer_email.includes('@')) return 'Bitte gültige E-Mail eintragen.'
    if (!form.billing_address.trim()) return 'Bitte Strasse und Hausnummer eintragen.'
    if (!form.billing_zip.trim() || !form.billing_city.trim()) return 'Bitte PLZ und Ort eintragen.'
    if (form.delivery_type === 'shipping' && form.different_shipping) {
      if (!form.shipping_first_name.trim() || !form.shipping_last_name.trim()) return 'Bitte Vor- und Nachname für die Lieferadresse eintragen.'
      if (!form.shipping_address.trim()) return 'Bitte Strasse / Hausnummer für die Lieferadresse eintragen.'
      if (!form.shipping_zip.trim() || !form.shipping_city.trim()) return 'Bitte PLZ und Ort für die Lieferadresse eintragen.'
    }
    return null
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    const v = validate()
    if (v) { setErr(v); return }
    setSubmitting(true)

    try {
      // 1) Beleg-Nr holen
      const { data: nr } = await supabase.rpc('get_next_online_order_nr')

      // 2) Bestellung anlegen
      const useShippingAddr = form.delivery_type === 'shipping'
      const useDifferent = useShippingAddr && form.different_shipping
      const shipFirst = useDifferent ? form.shipping_first_name.trim() : form.customer_first_name.trim()
      const shipLast  = useDifferent ? form.shipping_last_name.trim()  : form.customer_last_name.trim()
      const shipAddr  = useDifferent ? form.shipping_address.trim()    : form.billing_address.trim()
      const shipZip   = useDifferent ? form.shipping_zip.trim()        : form.billing_zip.trim()
      const shipCity  = useDifferent ? form.shipping_city.trim()       : form.billing_city.trim()

      const orderRow = {
        order_nr: nr,
        customer_first_name: form.customer_first_name.trim(),
        customer_last_name: form.customer_last_name.trim(),
        customer_name: `${form.customer_first_name.trim()} ${form.customer_last_name.trim()}`,
        customer_email: form.customer_email.trim().toLowerCase(),
        customer_phone: form.customer_phone.trim() || null,
        billing_address: form.billing_address.trim(),
        billing_zip: form.billing_zip.trim(),
        billing_city: form.billing_city.trim(),
        delivery_type: form.delivery_type,
        shipping_first_name: useShippingAddr ? shipFirst : null,
        shipping_last_name: useShippingAddr ? shipLast : null,
        shipping_name: useShippingAddr ? `${shipFirst} ${shipLast}` : null,
        shipping_address: useShippingAddr ? shipAddr : null,
        shipping_zip: useShippingAddr ? shipZip : null,
        shipping_city: useShippingAddr ? shipCity : null,
        shipping_cost: shippingCost,
        payment_method: form.payment_method,
        payment_status: 'pending',
        subtotal,
        discount_amount: voucherDiscount,
        total,
        voucher_id: voucherInfo?.id || null,
        voucher_code: voucherInfo?.code || null,
        voucher_amount: voucherInfo ? voucherDiscount : null,
        notiz: form.notiz.trim() || null,
        status: 'neu',
      }
      const { data: created, error: orderErr } = await supabase.from('online_orders').insert([orderRow]).select().single()
      if (orderErr) throw orderErr

      // 3) order_items anlegen
      const orderItemRows = items.map(it => ({
        order_id: created.id,
        item_id: it.id,
        name: it.name,
        sku: it.sku || null,
        category: it.category || null,
        price: Number(it.price || 0),
        vendor_id: it.vendor_id || null,
        vendor_name: it.vendor_name || null,
      }))
      await supabase.from('online_order_items').insert(orderItemRows)

      // 4) Items reservieren (status = 'reserviert')
      const itemIds = items.map(i => i.id)
      await supabase.from('items').update({ status: 'reserviert' }).in('id', itemIds)

      // 5) Voucher: bei Rechnung/Bar direkt abbuchen; bei Online erst nach Zahlung
      if (voucherInfo && form.payment_method !== 'online') {
        if (voucherInfo.type === 'percent') {
          await supabase.from('vouchers').update({ status: 'eingeloest', redeemed_at: new Date().toISOString() }).eq('id', voucherInfo.id)
        } else {
          const newRem = Math.max(0, Number(voucherInfo.remaining_amount || 0) - voucherDiscount)
          const patch = { remaining: newRem }
          if (newRem <= 0.005) { patch.status = 'eingeloest'; patch.redeemed_at = new Date().toISOString() }
          await supabase.from('vouchers').update(patch).eq('id', voucherInfo.id)
        }
      }

      // 6) Benachrichtigungs-Mail an info@familienboerse.ch (Best-Effort, fail-silent)
      try {
        await fetch('/api/notify-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: created, items: orderItemRows })
        })
      } catch (mailErr) {
        console.warn('Mail-Versand fehlgeschlagen (Bestellung trotzdem ok):', mailErr)
      }

      clear()
      navigate(`/bestellung/${created.id}`)
    } catch (e) {
      setErr('Bestellung fehlgeschlagen: ' + (e.message || e))
    } finally {
      setSubmitting(false)
    }
  }

  if (items.length === 0) return null

  return (
    <>
      <Topbar />
      <main className="container checkout-page">
        <div className="checkout-head">
          <Link to="/" className="link-back">← Zurück zum Shop</Link>
          <h1>Bestellung abschliessen</h1>
        </div>

        <div className="checkout-grid">
          <form onSubmit={submit} className="checkout-form">

            <section className="checkout-section">
              <h2>Deine Daten</h2>
              <div className="form-row form-row-2">
                <label>Vorname *<input type="text" value={form.customer_first_name} onChange={e => set('customer_first_name', e.target.value)} required /></label>
                <label>Nachname *<input type="text" value={form.customer_last_name} onChange={e => set('customer_last_name', e.target.value)} required /></label>
              </div>
              <div className="form-row">
                <label>Strasse und Hausnummer *<input type="text" value={form.billing_address} onChange={e => set('billing_address', e.target.value)} required placeholder="z.B. Bahnhofstrasse 12" /></label>
              </div>
              <div className="form-row form-row-2">
                <label>PLZ *<input type="text" value={form.billing_zip} onChange={e => set('billing_zip', e.target.value)} required pattern="[0-9]{4}" placeholder="8737" /></label>
                <label>Ort *<input type="text" value={form.billing_city} onChange={e => set('billing_city', e.target.value)} required placeholder="Gommiswald" /></label>
              </div>
              <div className="form-row form-row-2">
                <label>E-Mail *<input type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} required /></label>
                <label>Telefon (optional)<input type="tel" value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} /></label>
              </div>
            </section>

            <section className="checkout-section">
              <h2>Auslieferung</h2>
              <div className="radio-cards">
                <label className={`radio-card ${form.delivery_type === 'pickup' ? 'active' : ''}`}>
                  <input type="radio" name="delivery" checked={form.delivery_type === 'pickup'} onChange={() => set('delivery_type', 'pickup')} />
                  <div>
                    <div className="radio-card-title">🏠 Abholung im Laden</div>
                    <div className="radio-card-sub">Gommiswald, gratis · Wir reservieren für 7 Tage.</div>
                  </div>
                  <div className="radio-card-price">CHF 0.00</div>
                </label>
                <label className={`radio-card ${form.delivery_type === 'shipping' ? 'active' : ''}`}>
                  <input type="radio" name="delivery" checked={form.delivery_type === 'shipping'} onChange={() => set('delivery_type', 'shipping')} />
                  <div>
                    <div className="radio-card-title">📦 Schweizer Post (B-Post)</div>
                    <div className="radio-card-sub">2–5 Werktage · Pauschal CHF {SHIPPING_COST.toFixed(2)}</div>
                  </div>
                  <div className="radio-card-price">CHF {SHIPPING_COST.toFixed(2)}</div>
                </label>
              </div>

              {form.delivery_type === 'shipping' && (
                <>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={form.different_shipping} onChange={e => set('different_shipping', e.target.checked)} />
                    <span>Lieferadresse weicht von der oben angegebenen Adresse ab</span>
                  </label>
                  {form.different_shipping && (
                    <div className="address-fields">
                      <div className="form-row form-row-2">
                        <label>Vorname *<input type="text" value={form.shipping_first_name} onChange={e => set('shipping_first_name', e.target.value)} required /></label>
                        <label>Nachname *<input type="text" value={form.shipping_last_name} onChange={e => set('shipping_last_name', e.target.value)} required /></label>
                      </div>
                      <div className="form-row"><label>Strasse und Hausnummer *<input type="text" value={form.shipping_address} onChange={e => set('shipping_address', e.target.value)} required /></label></div>
                      <div className="form-row form-row-2">
                        <label>PLZ *<input type="text" value={form.shipping_zip} onChange={e => set('shipping_zip', e.target.value)} required pattern="[0-9]{4}" /></label>
                        <label>Ort *<input type="text" value={form.shipping_city} onChange={e => set('shipping_city', e.target.value)} required /></label>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="checkout-section">
              <h2>Gutschein</h2>
              {voucherInfo ? (
                <div className="voucher-applied">
                  <div>
                    <div className="voucher-code">{voucherInfo.code}</div>
                    <div className="voucher-sub">
                      {voucherInfo.type === 'percent'
                        ? `${voucherInfo.percent} % Rabatt`
                        : `Guthaben CHF ${Number(voucherInfo.remaining_amount).toFixed(2)}`}
                      {voucherDiscount > 0 && ` · −CHF ${voucherDiscount.toFixed(2)}`}
                    </div>
                  </div>
                  <button type="button" onClick={removeVoucher} className="link-remove">Entfernen</button>
                </div>
              ) : (
                <div className="voucher-row">
                  <input type="text" placeholder="z.B. ABCD-1234-EFGH" value={voucherCode} onChange={e => setVoucherCode(e.target.value.toUpperCase())} className="voucher-input" />
                  <button type="button" onClick={checkVoucher} className="btn-secondary">Einlösen</button>
                </div>
              )}
              {voucherErr && <p className="form-err">{voucherErr}</p>}
            </section>

            <section className="checkout-section">
              <h2>Bezahlung</h2>
              <div className="radio-cards">
                <label className="radio-card disabled">
                  <input type="radio" name="payment" disabled />
                  <div>
                    <div className="radio-card-title">💳 Karte / TWINT online <span className="badge-soon">bald verfügbar</span></div>
                    <div className="radio-card-sub">Sofortzahlung via SumUp — wird gerade vorbereitet.</div>
                  </div>
                </label>
                <label className={`radio-card ${form.payment_method === 'cash_pickup' ? 'active' : ''} ${form.delivery_type === 'shipping' ? 'hidden' : ''}`}>
                  <input type="radio" name="payment" checked={form.payment_method === 'cash_pickup'} onChange={() => set('payment_method', 'cash_pickup')} />
                  <div>
                    <div className="radio-card-title">💵 Bar / TWINT bei Abholung</div>
                    <div className="radio-card-sub">Bezahlung im Laden vor Ort.</div>
                  </div>
                </label>
                <label className={`radio-card ${form.payment_method === 'invoice' ? 'active' : ''}`}>
                  <input type="radio" name="payment" checked={form.payment_method === 'invoice'} onChange={() => set('payment_method', 'invoice')} />
                  <div>
                    <div className="radio-card-title">📄 Rechnung per E-Mail (Vorkasse)</div>
                    <div className="radio-card-sub">Du erhältst die Rechnung mit IBAN per Mail. Versand nach Zahlungseingang.</div>
                  </div>
                </label>
              </div>
              {form.delivery_type === 'shipping' && form.payment_method === 'cash_pickup' && (
                <p className="form-hint">⚠️ Bei Versand ist „Bar bei Abholung" nicht möglich — wähle „Rechnung".</p>
              )}
            </section>

            <section className="checkout-section">
              <h2>Notiz (optional)</h2>
              <textarea value={form.notiz} onChange={e => set('notiz', e.target.value)} rows={3} placeholder="Wünsche, Anmerkungen…" />
            </section>

            {err && <p className="form-err form-err-big">{err}</p>}

            <button type="submit" className="btn-submit" disabled={submitting || (form.delivery_type === 'shipping' && form.payment_method === 'cash_pickup')}>
              {submitting ? 'Bestellung wird gesendet…' : `Bestellung absenden — CHF ${total.toFixed(2)}`}
            </button>
            <p className="checkout-legal">Mit dem Absenden bestätigst du unsere Geschäftsbedingungen. Du kannst innerhalb von 14 Tagen vom Kauf zurücktreten (Detailbestimmungen im Laden).</p>
          </form>

          {/* Order Summary */}
          <aside className="checkout-summary">
            <h3>Deine Bestellung</h3>
            <div className="summary-items">
              {items.map(it => (
                <div key={it.id} className="summary-item">
                  {it.photo && <img src={it.photo} alt="" />}
                  <div className="summary-item-info">
                    <div className="summary-item-name">{it.name}</div>
                    <div className="summary-item-meta">{it.category}{it.size ? ` · ${it.size}` : ''}</div>
                  </div>
                  <div className="summary-item-price">CHF {Number(it.price).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="summary-row"><span>Zwischensumme</span><span>CHF {subtotal.toFixed(2)}</span></div>
            <div className="summary-row"><span>Versand</span><span>{shippingCost > 0 ? `CHF ${shippingCost.toFixed(2)}` : 'gratis'}</span></div>
            {voucherDiscount > 0 && <div className="summary-row summary-row-discount"><span>Gutschein {voucherInfo.code}</span><span>−CHF {voucherDiscount.toFixed(2)}</span></div>}
            <div className="summary-total"><span>Total</span><span>CHF {total.toFixed(2)}</span></div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  )
}
