import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, SUPABASE_BASE_URL } from './supabaseClient'
import NewsletterModal from './NewsletterModal'
import NewsletterPopup from './NewsletterPopup'

// Kategorien-Reihenfolge für die Filter-Pills (oberste sind die wichtigsten)
const FILTER_CATS = [
  'Alle',
  'Kleidung Baby (0-12 Monate)',
  'Kleidung Kleinkind (1-4 J)',
  'Kleidung Kind (5-12 J)',
  'Kleidung Teenager (13+ J)',
  'Kleidung Erwachsen Damen',
  'Kleidung Erwachsen Herren',
  'Schuhe Baby',
  'Schuhe Kind',
  'Schuhe Erwachsen',
  'Spielzeug',
  'Bücher',
  'Sport & Freizeit',
  'Möbel',
  'Kinderwagen & Buggys',
  'Babyausstattung',
  'Autositze & Sicherheit',
  'Schwangerschaft & Stillen',
  'Accessoires',
  'Taschen & Rucksäcke',
  'Sonstiges',
]

const PRICE_RANGES = [
  { label: 'Alle Preise', min: 0, max: Infinity },
  { label: 'Bis CHF 10', min: 0, max: 10 },
  { label: 'CHF 10 – 30', min: 10, max: 30 },
  { label: 'CHF 30 – 80', min: 30, max: 80 },
  { label: 'Über CHF 80', min: 80, max: Infinity },
]

export default function App() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [photos, setPhotos] = useState({}) // item_id -> first photo url
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('Alle')
  const [priceIdx, setPriceIdx] = useState(0)
  const [sort, setSort] = useState('neueste')

  useEffect(() => {
    const load = async () => {
      // Verfügbare Items laden
      const { data: itemsData } = await supabase
        .from('items')
        .select('id, name, category, price, brand, size, description, added')
        .eq('status', 'verfügbar')
        .order('added', { ascending: false })
        .limit(500)
      
      setItems(itemsData || [])

      // Fotos laden (eines pro Item, das erste)
      if (itemsData && itemsData.length > 0) {
        const ids = itemsData.map(i => i.id)
        const photoMap = {}
        // In Chunks abfragen, weil .in() ist auf ~1000 begrenzt
        for (let i = 0; i < ids.length; i += 200) {
          const chunk = ids.slice(i, i + 200)
          const { data: photoData } = await supabase
            .from('item_photos')
            .select('item_id, storage_path, reihenfolge')
            .in('item_id', chunk)
            .order('reihenfolge', { ascending: true })
          
          if (photoData) {
            for (const p of photoData) {
              if (!photoMap[p.item_id]) {
                photoMap[p.item_id] = `${SUPABASE_BASE_URL}/storage/v1/object/public/item-fotos/${p.storage_path}`
              }
            }
          }
        }
        setPhotos(photoMap)
      }

      setLoading(false)
    }
    load()
  }, [])

  // Filter + Sort
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let r = items.filter(i => {
      if (cat !== 'Alle' && i.category !== cat) return false
      const p = Number(i.price || 0)
      const range = PRICE_RANGES[priceIdx]
      if (p < range.min || p > range.max) return false
      if (q) {
        const haystack = `${i.name} ${i.brand || ''} ${i.size || ''} ${i.category || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    if (sort === 'preis-aufsteigend') r = r.sort((a, b) => Number(a.price) - Number(b.price))
    else if (sort === 'preis-absteigend') r = r.sort((a, b) => Number(b.price) - Number(a.price))
    // Default 'neueste' = bereits sortiert

    return r
  }, [items, search, cat, priceIdx, sort])

  // Wie viele Items haben Fotos?
  const itemsWithPhotos = useMemo(() => {
    return items.filter(i => photos[i.id]).length
  }, [items, photos])

  return (
    <>
      <Topbar />

      <section className="hero">
        <div className="hero-decoration hero-decoration-left" aria-hidden="true">✦</div>
        <div className="hero-decoration hero-decoration-right" aria-hidden="true">✦</div>
        <div className="container">
          <div className="hero-tagline ui">♡ Mit Liebe kuratiert seit 2023</div>
          <h1>Familien-Schätze für <em>Familien</em></h1>
          <p className="sub">
            Secondhand & Neuware · Konsignation in Gommiswald
          </p>
          {!loading && items.length > 0 && (
            <div className="stats">
              <div className="stat">
                <strong>{items.length}</strong>
                Artikel verfügbar
              </div>
              <div className="stat">
                <strong>{new Set(items.map(i => i.category)).size}</strong>
                Kategorien
              </div>
            </div>
          )}
        </div>
      </section>

      <main className="container">
        {/* Filter-Leiste */}
        <div className="filterbar ui">
          <input
            type="search"
            placeholder="Suche nach Marke, Größe, Artikel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
          <select value={cat} onChange={e => setCat(e.target.value)} className="filter-select">
            {FILTER_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={priceIdx} onChange={e => setPriceIdx(Number(e.target.value))} className="filter-select">
            {PRICE_RANGES.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} className="filter-select">
            <option value="neueste">Neueste zuerst</option>
            <option value="preis-aufsteigend">Preis aufsteigend</option>
            <option value="preis-absteigend">Preis absteigend</option>
          </select>
        </div>

        {/* Item-Grid */}
        {loading ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <div>Schaufenster wird vorbereitet…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <p style={{ fontSize: 18, fontFamily: 'Cormorant Garamond, serif' }}>
              Keine Artikel mit diesen Filtern gefunden.
            </p>
            <button className="btn btn-secondary" onClick={() => { setSearch(''); setCat('Alle'); setPriceIdx(0); }} style={{ marginTop: 12 }}>
              Filter zurücksetzen
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-soft)', fontFamily: 'Inter' }}>
              {filtered.length} {filtered.length === 1 ? 'Treffer' : 'Treffer'}
            </div>
            <div className="grid">
              {filtered.map(item => (
                <div key={item.id} className="card" onClick={() => navigate(`/artikel/${item.id}`)}>
                  <div className="card-img">
                    {photos[item.id] ? (
                      <img src={photos[item.id]} alt={item.name} loading="lazy" />
                    ) : (
                      <span className="card-img-placeholder">·· ·</span>
                    )}
                    {item.brand && item.brand !== 'Unbekannt' && item.brand !== 'Unknown' && item.brand !== 'Nicht bekannt' && (
                      <div className="card-img-badges">
                        <span className="badge brand">{item.brand}</span>
                      </div>
                    )}
                  </div>
                  <div className="card-info">
                    <div className="card-cat">{item.category}{item.size && ` · ${item.size}`}</div>
                    <div className="card-name">{item.name}</div>
                    <div className="card-price">CHF {Number(item.price).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <HowItWorks />
      <WantedNow />
      <VisitUs />
      <Footer />
      <NewsletterPopup />
    </>
  )
}

function HowItWorks() {
  return (
    <section className="info-section info-section-soft">
      <div className="container">
        <div className="section-head">
          <span className="section-eyebrow">♡ Familienbörse</span>
          <h2 className="section-title">Wie das bei uns funktioniert</h2>
          <p className="section-sub">Ganz unkompliziert, mit viel Liebe und einem grünen Daumen für die Umwelt.</p>
        </div>
        <div className="how-grid">
          <div className="how-card how-card-pink">
            <div className="how-emoji" aria-hidden="true">🧸</div>
            <h3 className="how-title">Du findest Schätze</h3>
            <p>Im Laden in Gommiswald und hier online warten sorgfältig ausgewählte Kindersachen auf ein neues Zuhause — secondhand mit Herz, ergänzt durch kuratierte Neuware.</p>
          </div>
          <div className="how-card how-card-mint">
            <div className="how-emoji" aria-hidden="true">👶</div>
            <h3 className="how-title">Du bringst, was zu klein wurde</h3>
            <p>Deine Kinder wachsen schneller als ihre Hosen? Bring uns, was noch in guter Form ist — wir verkaufen es für dich und du bekommst deinen Anteil ausbezahlt.</p>
          </div>
          <div className="how-card how-card-yellow">
            <div className="how-emoji" aria-hidden="true">💚</div>
            <h3 className="how-title">Familien helfen Familien</h3>
            <p>Lieblingsstücke bekommen ein zweites Zuhause, dein Budget freut sich, und gemeinsam tun wir der Umwelt etwas Gutes — Win-Win-Win für die ganze Familie.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function WantedNow() {
  const items = ['Lego', 'Duplo', 'Playmobil', 'Tiptoi-Bücher', 'Grosse Zewidecken']
  return (
    <section className="info-section">
      <div className="container">
        <div className="wanted-banner">
          <div className="wanted-stars" aria-hidden="true">✦ ✦ ✦</div>
          <h2 className="section-title wanted-title">Diese Schätze suchen wir gerade besonders</h2>
          <ul className="wanted-list ui">
            {items.map(x => <li key={x}>{x}</li>)}
          </ul>
          <p className="wanted-foot">Du hast etwas davon zuhause? Bring es gerne vorbei — wir freuen uns!</p>
        </div>
      </div>
    </section>
  )
}

function VisitUs() {
  const hours = [
    { day: 'Montag', time: 'Geschlossen', closed: true },
    { day: 'Dienstag – Freitag', time: '08.30 – 11.30 · 13.30 – 18.00' },
    { day: 'Samstag', time: '08.30 – 16.00' },
  ]
  return (
    <section className="info-section info-section-soft">
      <div className="container">
        <div className="section-head">
          <span className="section-eyebrow">✿ Komm vorbei</span>
          <h2 className="section-title">Besuche uns in Gommiswald</h2>
          <p className="section-sub">Wir freuen uns auf euch — Eltern, Grosseltern und natürlich die Kleinen.</p>
        </div>
        <div className="visit-grid">
          <div className="visit-card">
            <h3 className="visit-card-title">📅 Öffnungszeiten</h3>
            <table className="hours-table ui">
              <tbody>
                {hours.map(h => (
                  <tr key={h.day}>
                    <td>{h.day}</td>
                    <td className={h.closed ? 'hours-closed' : ''}>{h.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="visit-tip ui">💡 Tipp: Für eine entspannte Stöberzeit kommt am besten unter der Woche vorbei.</p>
          </div>
          <div className="visit-card">
            <h3 className="visit-card-title">🎁 Sachen vorbeibringen</h3>
            <p className="visit-intro">Damit alle Familien Freude daran haben, nehmen wir gerne an:</p>
            <ul className="rules-list ui">
              <li>Saisonale, saubere Kleidung & Schuhe — ohne Flecken oder Löcher</li>
              <li>Spielzeug, das vollzählig und funktionstüchtig ist (Spiele und Puzzles bitte vollständig)</li>
              <li>Bücher in gutem Zustand</li>
            </ul>
            <p className="visit-note ui">Bitte voranmelden ab 5 Artikeln. An Samstagen und in den Schulferien nehmen wir leider keine neuen Sachen entgegen.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Topbar() {
  const [showNewsletter, setShowNewsletter] = useState(false)
  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <a href="/" className="topbar-logo">
            <img src="/logo.png" alt="Rüegg's Familienbörse" className="topbar-logo-img" />
          </a>
          <div className="topbar-actions ui">
            <div className="topbar-info">
              <span>📍 Gommiswald</span>
              <span>📞 076 200 90 04</span>
            </div>
            <button
              onClick={() => setShowNewsletter(true)}
              className="btn-topbar btn-topbar-secondary"
            >
              🔔 Benachrichtigen
            </button>
            <a
              href="https://vendor-portal-ie8v.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-topbar"
            >
              Lieferanten-Login →
            </a>
          </div>
        </div>
      </div>
      {showNewsletter && (
        <NewsletterModal
          onClose={() => setShowNewsletter(false)}
          quelle="topbar"
          showGutschein={false}
        />
      )}
    </>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid ui">
          <div>
            <h4>Adresse</h4>
            <p style={{ margin: 0 }}>
              Rüegg's Familienbörse<br />
              Ernetschwilerstrasse 21<br />
              8737 Gommiswald
            </p>
          </div>
          <div>
            <h4>Kontakt</h4>
            <p style={{ margin: 0 }}>
              Telefon: 076 200 90 04<br />
              E-Mail: info@familienboerse.ch
            </p>
          </div>
          <div>
            <h4>Öffnungszeiten</h4>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>
              Mo geschlossen<br />
              Di – Fr 08.30–11.30 · 13.30–18.00<br />
              Sa 08.30–16.00
            </p>
          </div>
          <div>
            <h4>Für Lieferanten</h4>
            <p style={{ margin: 0 }}>
              <a
                href="https://vendor-portal-ie8v.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'underline' }}
              >
                Lieferanten-Portal →
              </a><br />
              Artikel einliefern + Auszahlungen einsehen.
            </p>
          </div>
        </div>
        <div className="footer-bottom ui">
          © 2026 Rüegg's Familienbörse · <a href="https://familienboerse.ch">familienboerse.ch</a>
        </div>
      </div>
    </footer>
  )
}
