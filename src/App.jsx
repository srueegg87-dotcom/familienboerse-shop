import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, SUPABASE_BASE_URL } from './supabaseClient'

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
        <div className="container">
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

      <Footer />
    </>
  )
}

export function Topbar() {
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <a href="/" className="topbar-logo">
          Rüegg's <span className="accent">Familienbörse</span>
        </a>
        <div className="topbar-actions ui">
          <div className="topbar-info">
            <span>📍 Gommiswald</span>
            <span>📞 076 200 90 04</span>
          </div>
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
            <h4>Über uns</h4>
            <p style={{ margin: 0 }}>
              Konsignation für Familien in der Schweiz. Secondhand mit Liebe ausgewählt + sorgfältig kuratierte Neuware.
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
