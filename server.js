require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');
const RssParser = require('rss-parser');
const dataStore = require('./src/dataStore');
const { verificarYActualizar } = require('./src/updater');
const { leerHistorico, guardarHistoricoCompleto } = require('./src/indecFetcher');

let _pdfSF = null;
try { _pdfSF = require('./src/pdfFetcherSF'); } catch { /* Steel Frame PDF fetcher no disponible */ }

const rssParser = new RssParser({ timeout: 10000 });

// Caches en memoria para endpoints externos
const cache = {
  imagen:   { data: null, ts: 0 },
  noticias: { data: null, ts: 0 },
  dolar:    { data: null, ts: 0 },
  sf:       { data: null, ts: 0 },
};
const TTL = { imagen: 43200000, noticias: 21600000, dolar: 3600000, sf: 43200000 };

const app = express();
const PUERTO = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Devuelve los precios actuales (con todos los campos de estado)
app.get('/api/precios', (req, res) => {
  try {
    res.json(dataStore.leerPrecios());
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron cargar los precios' });
  }
});

// Fuerza una actualización manual desde el frontend
app.post('/api/actualizar', async (req, res) => {
  try {
    const resultado = await verificarYActualizar();
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: error.message });
  }
});

// Panel de administración
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Devuelve el historial ICC completo
app.get('/api/icc', (req, res) => {
  try {
    res.json(leerHistorico());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agrega o actualiza una variación ICC en el histórico
app.post('/api/icc', (req, res) => {
  const { mes, variacion } = req.body;

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: 'Formato de mes inválido. Use YYYY-MM' });
  }
  const varNum = parseFloat(variacion);
  if (isNaN(varNum)) {
    return res.status(400).json({ error: 'Variación inválida' });
  }

  try {
    const historico = leerHistorico();
    const idx = historico.findIndex(e => e.mes === mes);
    if (idx >= 0) {
      historico[idx].variacion = varNum;
    } else {
      historico.push({ mes, variacion: varNum });
    }
    guardarHistoricoCompleto(historico);
    console.log(`[Admin] ICC guardado: ${mes} → ${varNum}%`);
    res.json({ exito: true, historico });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Imagen de arquitectura (Unsplash) ───────────────────────────────────────
app.get('/api/imagen-arquitectura', async (req, res) => {
  const ahora = Date.now();
  if (cache.imagen.data && ahora - cache.imagen.ts < TTL.imagen) return res.json(cache.imagen.data);

  const key = process.env.UNSPLASH_ACCESS_KEY;
  console.log('[Unsplash] Key presente:', !!key, '| Longitud:', key ? key.length : 0);
  if (!key) return res.json({ fallback: true });

  try {
    const resp = await axios.get('https://api.unsplash.com/photos/random', {
      params: { query: 'architecture brutalist concrete minimal', count: 6, orientation: 'portrait' },
      headers: { Authorization: `Client-ID ${key}` },
      timeout: 8000,
    });
    const fotos = resp.data.map(f => ({
      url: f.urls.regular,
      nombre: (f.description || f.alt_description || 'ARQUITECTURA').toUpperCase().substring(0, 40),
      fotografo: f.user.name,
      perfilUrl: `${f.user.links.html}?utm_source=presupuesto_obra&utm_medium=referral`,
    }));
    cache.imagen = { data: fotos, ts: ahora };
    res.json(fotos);
  } catch (err) {
    console.warn('[Unsplash] Error mensaje:', err.message);
    console.warn('[Unsplash] HTTP status:', err.response?.status);
    console.warn('[Unsplash] Respuesta body:', JSON.stringify(err.response?.data));
    res.json({ fallback: true });
  }
});

// ─── Noticias via RSS ─────────────────────────────────────────────────────────
app.get('/api/noticias', async (req, res) => {
  const ahora = Date.now();
  if (cache.noticias.data && ahora - cache.noticias.ts < TTL.noticias) return res.json(cache.noticias.data);

  const feeds = [
    'https://www.plataformaarquitectura.cl/cl/rss',
    'https://www.archdaily.cl/cl/rss',
  ];

  for (const feedUrl of feeds) {
    try {
      const feed = await rssParser.parseURL(feedUrl);
      const items = feed.items.slice(0, 3).map(item => ({
        titulo: item.title || '',
        link: item.link || '',
        fecha: item.pubDate
          ? new Date(item.pubDate).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }).toUpperCase()
          : '',
        imagen: item.enclosure?.url
          || item['media:content']?.['$']?.url
          || item['media:thumbnail']?.['$']?.url
          || null,
        fuente: feed.title || '',
      }));
      cache.noticias = { data: items, ts: ahora };
      return res.json(items);
    } catch { /* intenta el siguiente feed */ }
  }

  cache.noticias = { data: [], ts: ahora };
  res.json({ fallback: true, items: [] });
});

// ─── Cotización dólar (dolarapi.com) ─────────────────────────────────────────
app.get('/api/dolar', async (req, res) => {
  const ahora = Date.now();
  if (cache.dolar.data && ahora - cache.dolar.ts < TTL.dolar) return res.json(cache.dolar.data);

  try {
    const resp = await axios.get('https://dolarapi.com/v1/dolares', { timeout: 8000 });
    console.log('[Dolar] Respuesta raw:', JSON.stringify(resp.data));
    const blue    = resp.data.find(d => d.casa === 'blue');
    const oficial = resp.data.find(d => d.casa === 'oficial');
    console.log('[Dolar] blue:', blue, '| oficial:', oficial);
    if (!blue && !oficial) throw new Error('Sin datos de dólar');
    const data = { blue: blue?.venta ?? null, oficial: oficial?.venta ?? null };
    console.log('[Dolar] Enviando:', data);
    cache.dolar = { data, ts: ahora };
    res.json(data);
  } catch (err) {
    console.warn('[Dolar] Error:', err.message);
    res.json({ error: true });
  }
});

// ─── Precios Steel Frame (PDF IEC) ────────────────────────────────────────────
app.get('/api/precios-sf', async (req, res) => {
  const ahora = Date.now();
  if (cache.sf.data && ahora - cache.sf.ts < TTL.sf) return res.json(cache.sf.data);

  if (_pdfSF) {
    try {
      const urlPDF = await _pdfSF.buscarURLPDF();
      const datos  = await _pdfSF.descargarYParsearPDF(urlPDF);
      const result = { ...datos, fuente: 'IEC - CPI Córdoba (Steel Frame)', esFallback: false };
      cache.sf = { data: result, ts: ahora };
      return res.json(result);
    } catch (err) {
      console.warn('[SF] PDF no encontrado:', err.message);
    }
  }

  // Fallback: 0.92× del precio tradicional
  const base = dataStore.leerPrecios();
  const result = {
    precioM2Total:  base.precioM2Total  * 0.92,
    precioM2Basico: base.precioM2Basico * 0.92,
    mesReferencia:  base.mesReferencia,
    fuente:         'Estimado — PDF Steel Frame no disponible (0.92× tradicional)',
    esFallback:     true,
  };
  cache.sf = { data: result, ts: ahora };
  res.json(result);
});

// Verificación automática el día 12 de cada mes a las 9:00 AM
cron.schedule('0 9 12 * *', () => {
  console.log('[Cron] Día 12 — verificando PDF del IEC...');
  verificarYActualizar();
});

app.listen(PUERTO, () => {
  console.log(`Servidor corriendo en http://localhost:${PUERTO}`);

  // Actualización al arrancar (no bloquea el servidor)
  verificarYActualizar()
    .then(r => console.log('[Inicio]', r.mensaje))
    .catch(err => console.error('[Inicio] Error:', err.message));
});
