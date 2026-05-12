import { useState } from 'react'
import { supabase } from './supabaseClient'

const KATEGORIEN = [
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
]

/**
 * Newsletter-Modal — gemeinsam genutzt von Pop-up + Topbar-Button
 * @param {object} props
 * @param {function} props.onClose
 * @param {string} props.quelle - 'popup' | 'topbar' | 'footer'
 * @param {boolean} props.showGutschein - true für Pop-up (Gutschein-Story), false für Topbar
 */
export default function NewsletterModal({ onClose, quelle = 'topbar', showGutschein = false }) {
  const [form, setForm] = useState({
    email: '',
    name: '',
    kategorien: [],
    groessen: '',
    marken: '',
    tags: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [err, setErr] = useState('')

  const toggleKat = (k) => {
    setForm(f => ({
      ...f,
      kategorien: f.kategorien.includes(k)
        ? f.kategorien.filter(x => x !== k)
        : [...f.kategorien, k]
    }))
  }

  const splitTags = (s) => s.split(/[,;\n]/).map(x => x.trim()).filter(Boolean)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.email.trim()) {
      setErr('Bitte E-Mail eintragen.')
      return
    }
    setSaving(true)
    setErr('')

    const { error } = await supabase.from('newsletter_subscribers').insert({
      email: form.email.trim().toLowerCase(),
      name: form.name.trim() || null,
      wunsch_kategorien: form.kategorien,
      wunsch_groessen: splitTags(form.groessen),
      wunsch_marken: splitTags(form.marken),
      wunsch_tags: splitTags(form.tags),
      quelle,
    })

    setSaving(false)
    if (error) {
      // Duplikat-E-Mail freundlich abfangen
      if (error.code === '23505' || error.message?.includes('duplicate')) {
        setErr('Diese E-Mail ist bereits angemeldet — danke! 💚')
      } else {
        setErr('Fehler: ' + error.message)
      }
      return
    }

    // Pop-up Flag: 7 Tage nicht mehr zeigen
    try {
      localStorage.setItem('newsletter_popup_dismissed', Date.now().toString())
    } catch {}

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-success ui">
            <div className="modal-success-icon">✓</div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              {showGutschein ? 'Gutschein-Code unterwegs!' : 'Anmeldung erhalten!'}
            </h2>
            <p style={{ color: 'var(--text-soft)' }}>
              {showGutschein ? (
                <>Dein <strong>10 % Willkommens-Gutschein</strong> kommt per E-Mail zu dir.<br />
                Gültig bei Abholung im Laden.</>
              ) : (
                <>Wir benachrichtigen dich, sobald passende Artikel reinkommen.</>
              )}
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
              📧 Du kannst dich jederzeit wieder abmelden.
            </p>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 20 }}>
              Schliessen
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        {showGutschein && (
          <div className="gutschein-banner ui">
            <div className="gutschein-icon">🎁</div>
            <div>
              <div className="gutschein-title">10 % Rabatt geschenkt!</div>
              <div className="gutschein-sub">Trag deine E-Mail ein und kriege den Gutschein per Mail.</div>
            </div>
          </div>
        )}

        <h2 style={{ marginTop: showGutschein ? 8 : 0 }}>
          {showGutschein ? 'Newsletter abonnieren' : 'Benachrichtigung einrichten'}
        </h2>
        <p className="sub ui">
          {showGutschein
            ? 'Erhalte exklusive Neuzugänge und Aktionen direkt in dein Postfach.'
            : 'Sag uns, was du suchst – wir melden uns, sobald passende Artikel reinkommen.'}
        </p>

        <form onSubmit={submit} className="ui">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>E-Mail *</label>
              <input type="email" value={form.email}
                onChange={e => setForm({...form, email: e.target.value})} required />
            </div>
            <div className="field">
              <label>Name (optional)</label>
              <input type="text" value={form.name}
                onChange={e => setForm({...form, name: e.target.value})} />
            </div>
          </div>

          {!showGutschein && (
            <>
              <div className="field">
                <label>Welche Kategorien interessieren dich?</label>
                <div className="kat-grid">
                  {KATEGORIEN.map(k => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => toggleKat(k)}
                      className={`kat-pill ${form.kategorien.includes(k) ? 'active' : ''}`}
                    >
                      {k.replace(/Kleidung /, 'K. ').replace(/\(.*\)/, '').trim()}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Grössen (durch Komma trennen)</label>
                  <input type="text" value={form.groessen}
                    onChange={e => setForm({...form, groessen: e.target.value})}
                    placeholder="z.B. 116, 122, 128" />
                </div>
                <div className="field">
                  <label>Marken (optional)</label>
                  <input type="text" value={form.marken}
                    onChange={e => setForm({...form, marken: e.target.value})}
                    placeholder="z.B. Lego, H&M" />
                </div>
              </div>

              <div className="field">
                <label>Was suchst du sonst noch? (Stichwörter)</label>
                <input type="text" value={form.tags}
                  onChange={e => setForm({...form, tags: e.target.value})}
                  placeholder="z.B. Strider, Reitstiefel, Hochstuhl" />
              </div>
            </>
          )}

          {err && <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Abbrechen
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Speichert…' : (showGutschein ? '🎁 Gutschein sichern' : 'Benachrichtigung aktivieren')}
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16, lineHeight: 1.5 }}>
            {showGutschein
              ? 'Wir senden dir den Gutschein-Code + ab und zu Neuigkeiten. Jederzeit abbestellbar.'
              : 'Du erhältst nur Mails zu Artikeln, die zu deinen Wünschen passen. Jederzeit abbestellbar.'}
          </p>
        </form>
      </div>
    </div>
  )
}
