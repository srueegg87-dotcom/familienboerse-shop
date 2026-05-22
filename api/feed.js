// api/feed.js — Produkt-Feed (Google Shopping RSS 2.0) für externe Plattformen.
// Eine URL, die alle verfügbaren Artikel ausgibt; Google Merchant Center und
// Meta (Facebook/Instagram) Commerce Manager lesen sie automatisch ein.
//
//   GET /api/feed            -> XML-Feed aller verfügbaren Artikel mit Foto
//   GET /api/feed?limit=50   -> nur die ersten 50 (zum Testen)
//
// Artikel-Links folgen automatisch der aufrufenden Domain (req.host); per
// Env SHOP_BASE_URL fest überschreibbar, sobald die finale Domain steht.
// Liest öffentliche Daten (status='verfügbar') – anon-Key genügt.
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

const BUCKET = 'item-fotos';
const DESC_MAX = 350;
const TITLE_MAX = 140;

function getClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase-Env fehlt (SUPABASE_URL / *_ANON_KEY)');
  return { sb: createClient(url, key, { auth: { persistSession: false } }), url };
}

const esc = (s) => String(s == null ? '' : s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const chf = (n) => Number(n || 0).toFixed(2) + ' CHF';

async function pageAll(sb, table, select, filterFn, cap) {
  let all = [], from = 0;
  while (true) {
    let q = sb.from(table).select(select).order('id', { ascending: true }).range(from, from + 999);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    all = all.concat(data);
    if (data.length < 1000 || (cap && all.length >= cap)) break;
    from += 1000;
  }
  return cap ? all.slice(0, cap) : all;
}

export default async function handler(req, res) {
  try {
    const { sb, url: supaUrl } = getClient();
    const base = (process.env.SHOP_BASE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
    const limit = req.query.limit ? Math.max(1, parseInt(req.query.limit)) : null;

    const items = await pageAll(
      sb, 'items',
      'id,name,description,price,category,brand,marke,size,groesse,verguetungsart',
      q => q.eq('status', 'verfügbar'),
      limit
    );

    // Erstes Foto je Artikel (nur Artikel mit Foto kommen in den Feed)
    const ids = items.map(i => i.id);
    const photo = {};
    for (let i = 0; i < ids.length; i += 300) {
      const { data } = await sb.from('item_photos').select('item_id,storage_path,reihenfolge').in('item_id', ids.slice(i, i + 300));
      (data || []).forEach(p => {
        const cur = photo[p.item_id];
        if (!cur || (p.reihenfolge ?? 99) < (cur.reihenfolge ?? 99)) photo[p.item_id] = p;
      });
    }

    const entries = items.filter(i => photo[i.id]).map(i => {
      const link = `${base}/artikel/${i.id}`;
      const img = `${supaUrl}/storage/v1/object/public/${BUCKET}/${photo[i.id].storage_path}`;
      const brand = (i.marke || i.brand || '').trim();
      const cond = i.verguetungsart === 'neuware' ? 'new' : 'used';
      const title = esc((i.name || 'Artikel').slice(0, TITLE_MAX));
      const desc = esc((stripHtml(i.description) || i.name || '').slice(0, DESC_MAX));
      return [
        '<item>',
        `<g:id>${esc(i.id)}</g:id>`,
        `<title>${title}</title>`,
        `<description>${desc}</description>`,
        `<link>${esc(link)}</link>`,
        `<g:image_link>${esc(img)}</g:image_link>`,
        '<g:availability>in_stock</g:availability>',
        `<g:price>${esc(chf(i.price))}</g:price>`,
        `<g:condition>${cond}</g:condition>`,
        brand ? `<g:brand>${esc(brand)}</g:brand>` : '',
        '<g:identifier_exists>no</g:identifier_exists>',
        i.category ? `<g:product_type>${esc(i.category)}</g:product_type>` : '',
        '</item>'
      ].filter(Boolean).join('');
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Rüegg's Familienbörse</title>
<link>${esc(base)}</link>
<description>Secondhand &amp; Neuware für Familien</description>
${entries.join('\n')}
</channel>
</rss>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.setHeader('X-Item-Count', String(entries.length));
    return res.status(200).send(xml);
  } catch (e) {
    console.error('[feed]', e);
    return res.status(500).json({ error: e.message });
  }
}
