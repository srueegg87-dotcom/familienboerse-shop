import { useState, useEffect } from 'react'
import NewsletterModal from './NewsletterModal'

const STORAGE_KEY = 'newsletter_popup_dismissed'
const RESHOW_DAYS = 7

export default function NewsletterPopup() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Soll das Pop-up gezeigt werden?
    let shouldShow = true
    try {
      const lastDismissed = localStorage.getItem(STORAGE_KEY)
      if (lastDismissed) {
        const ageMs = Date.now() - Number(lastDismissed)
        const ageDays = ageMs / (1000 * 60 * 60 * 24)
        if (ageDays < RESHOW_DAYS) {
          shouldShow = false
        }
      }
    } catch {}

    if (!shouldShow) return

    const timer = setTimeout(() => setShow(true), 10000) // 10 Sekunden
    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setShow(false)
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString())
    } catch {}
  }

  if (!show) return null

  return <NewsletterModal onClose={handleClose} quelle="popup" showGutschein={true} />
}
