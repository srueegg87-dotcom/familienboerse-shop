// api/ricardo-push.js — schickt 2×/Woche (Di & Fr) eine Ricardo-Importliste
// der NEU dazugekommenen Markenartikel (≥ CHF 15) per E-Mail an den Laden.
// Wird per Vercel Cron aufgerufen (Authorization: Bearer CRON_SECRET).
//
//   GET /api/ricardo-push            -> erzeugt + mailt (Cron; braucht CRON_SECRET)
//   GET /api/ricardo-push?dryRun=1   -> zählt nur (ohne Mail, ohne Auth)
//
// Env (Shop-Vercel): SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY|*_ANON_KEY,
//                    RESEND_API_KEY (+ optional RESEND_FROM, RICARDO_NOTIFY_TO), CRON_SECRET
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

export const config = { maxDuration: 60 }

const MIN_PRICE = 15
const BATCH = 100
const VERSION = 'v1.0.0'

function getClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase-Env fehlt')
  return createClient(url, key, { auth: { persistSession: false } })
}
const hasBrand = (i) => {
  const b = (i.marke || i.brand || '').trim().toLowerCase()
  return b && !['unbekannt', 'keine marke erkennbar', 'keine marke sichtbar', 'keine', '-'].includes(b)
}
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
function ricardoRow(it) {
  const marke = (it.marke || it.brand || '').trim()
  const groesse = (it.groesse || it.size || '').trim()
  const preis = Number(it.price || 0).toFixed(2)
  let titel = (it.name || 'Artikel').trim()
  if (marke && !titel.toLowerCase().includes(marke.toLowerCase())) titel = `${marke} ${titel}`
  if (groesse && !titel.includes(groesse)) titel = `${titel} Gr.${groesse}`
  titel = titel.slice(0, 60)
  const ref = String(it.sku || '').slice(0, 40)
  const eck = [marke && `Marke: ${marke}`, groesse && `Grösse: ${groesse}`, it.farbe && `Farbe: ${it.farbe}`,
    it.material && `Material: ${it.material}`, it.zustand && `Zustand: ${it.zustand}`, it.category && `Kategorie: ${it.category}`].filter(Boolean).join(' · ')
  const teile = []
  if (it.description) teile.push(stripHtml(it.description))
  if (eck) teile.push(eck)
  teile.push(`Preis: CHF ${preis}`)
  teile.push("Secondhand aus Rüegg's Familienbörse, Gommiswald. Abholung oder Versand möglich.")
  return [titel, ref, teile.join('\n\n').slice(0, 5000)]
}
function xlsxBase64(rows) {
  const header = ['Titel', 'Referenz-Nr.', 'Beschreibung', '', '', '', '', '', '', '', '', '', '', '', VERSION]
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Import')
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
}

export default async function handler(req, res) {
  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true'
  if (!dryRun) {
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' })
  }
  try {
    const sb = getClient()
    // "neu seit letztem Push": Fr -> 3 Tage zurück (seit Di), sonst 4 Tage (Di seit Fr)
    const now = new Date()
    const daysBack = now.getUTCDay() === 5 ? 3 : 4
    const cutoff = new Date(now.getTime() - daysBack * 864e5).toISOString()

    // Neue, verfügbare Artikel laden (paginiert), dann auf Marke + Preis filtern
    let all = [], from = 0
    while (true) {
      const { data, error } = await sb.from('items')
        .select('sku,name,description,price,category,brand,marke,size,groesse,farbe,material,zustand,created_at,status')
        .eq('status', 'verfügbar').gte('created_at', cutoff)
        .order('created_at', { ascending: true }).range(from, from + 999)
      if (error) throw new Error('items: ' + error.message)
      all = all.concat(data)
      if (data.length < 1000) break
      from += 1000
    }
    const candidates = all.filter(i => Number(i.price || 0) >= MIN_PRICE && hasBrand(i))

    if (dryRun) {
      return res.status(200).json({ dryRun: true, cutoff, neue_geprueft: all.length, ricardo_tauglich: candidates.length, listen: Math.ceil(candidates.length / BATCH) })
    }
    if (!candidates.length) {
      await sendMail('Ricardo: keine neuen Artikel', `<p>Seit ${cutoff.slice(0, 10)} sind keine neuen Markenartikel ab CHF ${MIN_PRICE} dazugekommen. Diese Woche nichts hochzuladen.</p>`, [])
      return res.status(200).json({ ok: true, sent: 0 })
    }

    // In Listen à 100 + je eine .xlsx-Attachment
    const stamp = now.toISOString().slice(0, 10)
    const attachments = []
    for (let i = 0; i < candidates.length; i += BATCH) {
      const part = candidates.slice(i, i + BATCH)
      attachments.push({ filename: `ricardo_${stamp}_${attachments.length + 1}.xlsx`, content: xlsxBase64(part.map(ricardoRow)) })
    }
    const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#1A1714;line-height:1.5;max-width:600px">
      <h2 style="color:#c4936a">Ricardo-Liste – neue Artikel</h2>
      <p><strong>${candidates.length}</strong> neue Markenartikel (ab CHF ${MIN_PRICE}) seit ${cutoff.slice(0, 10)}.</p>
      <p>Im Anhang ${attachments.length} Datei(en) à max. ${BATCH} Artikel im Ricardo-Vorlagenformat.</p>
      <p style="font-size:13px;color:#777">Hochladen über „Inserate importieren" auf Ricardo, danach Preis/Fotos/Kategorie/Versand ergänzen. Alle Listen findest du auch jederzeit im Admin-Portal unter „Ricardo".</p>
    </div>`
    const r = await sendMail(`Ricardo: ${candidates.length} neue Artikel (${stamp})`, html, attachments)
    return res.status(200).json({ ok: true, sent: candidates.length, files: attachments.length, mail: r })
  } catch (e) {
    console.error('[ricardo-push]', e)
    return res.status(500).json({ error: e.message })
  }
}

async function sendMail(subject, html, attachments) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { skipped: 'RESEND_API_KEY fehlt' }
  const FROM = process.env.RESEND_FROM || "Rüegg's Familienbörse <onboarding@resend.dev>"
  const TO = process.env.RICARDO_NOTIFY_TO || process.env.SHOP_NOTIFY_TO || 'info@familienboerse.ch'
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html, attachments })
  })
  const data = await r.json().catch(() => ({}))
  return r.ok ? { id: data.id } : { error: data?.message || 'mail failed' }
}
