import { useState, useEffect } from 'react'
import NewsletterModal from './NewsletterModal'

const STORAGE_KEY = 'newsletter_popup_dismissed'
const RESHOW_DAYS = 7
const DELAY_MS = 5000  // 5 Sekunden

export default function NewsletterPopup() {
  const [showTeaser, setShowTeaser] = useState(false)  // kleiner Banner unten rechts
  const [showModal, setShowModal] = useState(false)    // großes Modal nach Klick
  const [animateOut, setAnimateOut] = useState(false)

  useEffect(() => {
    let shouldShow = true
    try {
      const lastDismissed = localStorage.getItem(STORAGE_KEY)
      if (lastDismissed) {
        const ageMs = Date.now() - Number(lastDismissed)
        const ageDays = ageMs / (1000 * 60 * 60 * 24)
        if (ageDays < RESHOW_DAYS) shouldShow = false
      }
    } catch {}

    if (!shouldShow) return

    const timer = setTimeout(() => setShowTeaser(true), DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  const dismissTeaser = () => {
    setAnimateOut(true)
    setTimeout(() => {
      setShowTeaser(false)
      try {
        localStorage.setItem(STORAGE_KEY, Date.now().toString())
      } catch {}
    }, 350)
  }

  const openModal = () => {
    setShowModal(true)
    setShowTeaser(false)
  }

  const closeModal = () => {
    setShowModal(false)
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString())
    } catch {}
  }

  return (
    <>
      {showTeaser && (
        <div className={`newsletter-teaser ${animateOut ? 'slide-out' : 'slide-in'}`}>
          <button className="teaser-close" onClick={dismissTeaser} aria-label="Schliessen">×</button>
          <div className="teaser-icon">🎁</div>
          <div className="teaser-content">
            <div className="teaser-title">10 % Rabatt geschenkt!</div>
            <div className="teaser-sub">Newsletter abonnieren + Gutschein sichern.</div>
          </div>
          <button className="teaser-cta" onClick={openModal}>
            Jetzt sichern →
          </button>
        </div>
      )}
      {showModal && (
        <NewsletterModal
          onClose={closeModal}
          quelle="popup"
          showGutschein={true}
        />
      )}
    </>
  )
}
