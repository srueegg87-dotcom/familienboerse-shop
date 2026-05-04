import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, SUPABASE_BASE_URL } from './supabaseClient'
import { Topbar, Footer } from './App'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [photos, setPhotos] = useState([])
  const [activePhoto, setActivePhoto] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showReserve, setShowReserve] = useState(false)
  const [showBuy, setShowBuy] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: itemData } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .eq('status', 'verfügbar')
        .single()

      if (!itemData) {
        setLoading(false)
        return
      }
      setItem(itemData)

      const { data: photoData } = await supabase
        .from('item_photos')
        .select('storage_path, reihenfolge')
        .eq('item_id', id)
        .order('reihenfolge', { ascending: true })

      const urls = (photoData || []).map(p =>
        `${SUPABASE_BASE_URL}/storage/v1/object/public/item-fotos/${p.storage_path}`
      )
      setPhotos(urls)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <main className="container">
          <div className="loading">
            <div className="loading-spinner"></div>
            <div>Artikel wird geladen…</div>
          </div>
        </main>
      </>
    )
  }

  if (!item) {
    return (
      <>
        <Topbar />
        <main className="container">
          <div className="empty">
            <p style={{ fontSize: 18, fontFamily: 'Cormorant Garamond, serif' }}>
              Dieser Artikel ist nicht mehr verfügbar.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/')} style={{ marginTop: 16 }}>
              ← Zum Schaufenster
            </button>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const cleanBrand = (b) => {
    if (!b) return null
    const n = b.toLowerCase()
    if (['unbekannt', 'unknown', 'nicht bekannt', 'ich kenne die marke nicht'].includes(n)) return null
    return b
  }

  const brand = cleanBrand(item.brand)

  return (
    <>
      <Topbar />
      <main className="container">
        <button className="btn-back ui" onClick={() => navigate('/')}>← Zurück zum Schaufenster</button>
        
        <div className="detail">
          {/* Bilder */}
          <div className="detail-images">
            <div className="detail-img-main">
              {photos.length > 0 ? (
                <img src={photos[activePhoto]} alt={item.name} />
              ) : (
                <span className="card-img-placeholder" style={{ fontSize: 80 }}>·· ·</span>
              )}
            </div>
            {photos.length > 1 && (
              <div className="detail-thumbs">
                {photos.map((url, i) => (
                  <div
                    key={i}
                    className={`detail-thumb ${i === activePhoto ? 'active' : ''}`}
                    onClick={() => setActivePhoto(i)}
                  >
                    <img src={url} alt="" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inhalt */}
          <div className="detail-content">
            <div className="detail-cat ui">{item.category}</div>
            <h1>{item.name}</h1>
            <div className="detail-price">CHF {Number(item.price).toFixed(2)}</div>
            
            <div className="detail-meta ui">
              {brand && <span className="badge">{brand}</span>}
              {item.size && <span className="badge">Grösse {item.size}</span>}
              {item.sku && <span className="badge">Art.-Nr. {item.sku}</span>}
            </div>

            {item.description && (
              <p className="detail-desc">{item.description}</p>
            )}

            <div className="detail-actions ui">
              <button className="btn btn-primary" onClick={() => setShowReserve(true)}>
                Reservieren & abholen
              </button>
              <button className="btn btn-secondary" onClick={() => setShowBuy(true)}>
                Direkt kaufen
              </button>
            </div>

            <div style={{ marginTop: 32, padding: 20, background: 'var(--bg-soft)', borderRadius: 'var(--radius-lg)', fontFamily: 'Inter', fontSize: 14, color: 'var(--text-soft)' }}>
              <strong style={{ color: 'var(--text)' }}>📍 Abholung im Laden</strong><br />
              Rüegg's Familienbörse · Ernetschwilerstrasse 21 · 8737 Gommiswald<br />
              Reservierte Artikel sind 48 Stunden für Sie zurückgelegt.
            </div>
          </div>
        </div>
      </main>

      {showReserve && <ReserveModal item={item} onClose={() => setShowReserve(false)} />}
      {showBuy && <BuyModal item={item} onClose={() => setShowBuy(false)} />}

      <Footer />
    </>
  )
}

// ─── Reservieren-Modal ───
function ReserveModal({ item, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', telefon: '', nachricht: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      setErr('Bitte Name und E-Mail eintragen.')
      return
    }
    setSaving(true)
    setErr('')

    // 48h ab heute
    const ablauf = new Date()
    ablauf.setDate(ablauf.getDate() + 2)
    const ablaufdatum = ablauf.toISOString().split('T')[0]

    const { error } = await supabase.from('reservations').insert({
      item_id: item.id,
      kunde_name: form.name.trim(),
      kunde_email: form.email.trim(),
      kunde_telefon: form.telefon.trim() || null,
      kunde_nachricht: form.nachricht.trim() || null,
      status: 'offen',
      ablaufdatum,
    })

    setSaving(false)
    if (error) {
      setErr('Fehler: ' + error.message)
      return
    }
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-success ui">
            <div className="modal-success-icon">✓</div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif' }}>Reservierung erhalten!</h2>
            <p style={{ color: 'var(--text-soft)' }}>
              Wir halten <strong>{item.name}</strong> für Sie bis zu 48 Stunden zurück.<br />
              Sie können den Artikel im Laden abholen + bezahlen.
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
              📍 Ernetschwilerstrasse 21, 8737 Gommiswald<br />
              📞 076 200 90 04
            </p>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 20 }}>Schliessen</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Reservieren</h2>
        <p className="sub ui">
          <strong>{item.name}</strong> · CHF {Number(item.price).toFixed(2)}
        </p>

        <form onSubmit={submit} className="ui">
          <div className="field">
            <label>Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          </div>
          <div className="field">
            <label>E-Mail *</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          </div>
          <div className="field">
            <label>Telefon (optional)</label>
            <input type="tel" value={form.telefon} onChange={e => setForm({...form, telefon: e.target.value})} />
          </div>
          <div className="field">
            <label>Nachricht (optional)</label>
            <textarea value={form.nachricht} onChange={e => setForm({...form, nachricht: e.target.value})} placeholder="Wann kommen Sie vorbei?" />
          </div>

          {err && <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Abbrechen</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Speichert…' : 'Reservierung absenden'}
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16, lineHeight: 1.5 }}>
            Mit der Reservierung halten wir den Artikel bis zu 48 Stunden für Sie zurück.
            Eine Bezahlung erfolgt erst im Laden bei Abholung.
          </p>
        </form>
      </div>
    </div>
  )
}

// ─── Direkt-Kaufen-Modal (vorerst Hinweis, Stripe kommt später) ───
function BuyModal({ item, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Direkt kaufen</h2>
        <p className="sub ui">
          <strong>{item.name}</strong> · CHF {Number(item.price).toFixed(2)}
        </p>

        <div style={{ background: 'var(--accent-soft)', padding: 20, borderRadius: 'var(--radius-lg)', marginBottom: 20, fontFamily: 'Inter', fontSize: 14, color: 'var(--text)' }}>
          🚧 <strong>Online-Bezahlung kommt bald!</strong><br />
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>
            Wir bauen gerade den Online-Bezahl-Prozess auf. Bis dahin: bitte den Artikel reservieren und bequem im Laden bezahlen.
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Schliessen</button>
        </div>
      </div>
    </div>
  )
}
