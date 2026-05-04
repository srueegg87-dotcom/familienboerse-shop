# Familienbörse Online-Shop

Phase 1: Schaufenster + Reservieren-Funktion. Liest Items live aus der gemeinsamen Supabase-Datenbank.

## Setup

```bash
npm install
npm run dev
```

## Vercel-Deployment

### Vercel-Variablen setzen:

| Variable | Wert |
|---|---|
| `VITE_SUPABASE_URL` | `https://quhqhqhfyzqknnoldyke.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (aus Supabase Settings → API) |

### DB-Migration

Vor dem ersten Deploy: `01_reservations.sql` im Supabase SQL-Editor ausführen.

### Build-Command

`npm run build` (Vite macht das automatisch)

### Output-Directory

`dist`

## Roadmap

**Phase 1 (jetzt):**
- ✅ Schaufenster mit Filtern & Suche
- ✅ Detail-Seite
- ✅ Reservieren mit DB-Eintrag

**Phase 2 (kommt):**
- E-Mail-Versand via Resend
- Stripe-Integration für Direktkauf
- Custom-Domain `shop.familienboerse.ch`

**Phase 3 (kommt):**
- Newsletter mit Wunsch-Match
- Push-Benachrichtigung an Lieferanten
