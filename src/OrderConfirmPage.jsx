import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { Topbar, Footer } from './App.jsx'

export default function OrderConfirmPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: o } = await supabase.from('online_orders').select('*').eq('id', id).single()
      if (o) {
        setOrder(o)
        const { data: its } = await supabase.from('online_order_items').select('*').eq('order_id', id)
        setItems(its || [])
      }
      setLoading(false)
    })()
  }, [id])

  if (loading) return (<><Topbar /><div className="container loading"><p>Lade Bestellung…</p></div><Footer /></>)
  if (!order) return (<><Topbar /><div className="container"><h1>Bestellung nicht gefunden</h1><Link to="/">← Zur Startseite</Link></div><Footer /></>)

  const paymentLabel = {
    online: 'Karte / TWINT online',
    invoice: 'Rechnung per E-Mail',
    cash_pickup: 'Bar / TWINT bei Abholung'
  }[order.payment_method]

  return (
    <>
      <Topbar />
      <main className="container confirm-page">
        <div className="confirm-card">
          <div className="confirm-icon">✓</div>
          <h1>Vielen Dank für deine Bestellung!</h1>
          <p className="confirm-sub">Wir haben dir eine Bestätigung an <strong>{order.customer_email}</strong> geschickt.</p>

          <div className="confirm-box">
            <div className="confirm-meta">
              <div><span className="confirm-label">Bestellnummer</span><span className="confirm-val">{order.order_nr}</span></div>
              <div><span className="confirm-label">Datum</span><span className="confirm-val">{new Date(order.created_at).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
              <div><span className="confirm-label">Bezahlmethode</span><span className="confirm-val">{paymentLabel}</span></div>
            </div>

            <div className="confirm-items">
              <h3>Artikel</h3>
              {items.map(it => (
                <div key={it.id} className="confirm-item">
                  <span>{it.name}</span>
                  <span>CHF {Number(it.price).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="confirm-totals">
              <div className="confirm-row"><span>Zwischensumme</span><span>CHF {Number(order.subtotal).toFixed(2)}</span></div>
              <div className="confirm-row"><span>Versand</span><span>{Number(order.shipping_cost) > 0 ? `CHF ${Number(order.shipping_cost).toFixed(2)}` : 'gratis'}</span></div>
              {order.voucher_code && Number(order.voucher_amount) > 0 && (
                <div className="confirm-row confirm-row-discount"><span>Gutschein {order.voucher_code}</span><span>−CHF {Number(order.voucher_amount).toFixed(2)}</span></div>
              )}
              <div className="confirm-total"><span>Total</span><span>CHF {Number(order.total).toFixed(2)}</span></div>
            </div>
          </div>

          <div className="confirm-next">
            <h3>Wie geht es weiter?</h3>
            {order.delivery_type === 'pickup' ? (
              <p>Wir reservieren die Artikel für dich und melden uns sobald sie zur Abholung bereit liegen — Bezahlung dann vor Ort in Gommiswald. Wir halten sie 7 Tage für dich zurück.</p>
            ) : order.payment_method === 'invoice' ? (
              <p>Du erhältst von uns eine Rechnung per E-Mail mit IBAN. Sobald die Zahlung eingegangen ist, verpacken wir alles und schicken es per B-Post los.</p>
            ) : (
              <p>Wir bereiten dein Paket vor und schicken es per Schweizer Post B-Post los.</p>
            )}
            <p className="confirm-contact">Fragen? <a href="mailto:info@familienboerse.ch">info@familienboerse.ch</a> · 076 200 90 04</p>
          </div>

          <Link to="/" className="btn-primary">Weiter stöbern</Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
