const express = require('express');
const path = require('path');
const cron = require('node-cron');
const dataStore = require('./src/dataStore');
const { verificarYActualizar } = require('./src/updater');
const { leerHistorico, guardarHistoricoCompleto } = require('./src/indecFetcher');

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
