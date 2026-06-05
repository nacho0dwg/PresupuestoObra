const express = require('express');
const path = require('path');
const cron = require('node-cron');
const dataStore = require('./src/dataStore');
const { verificarYActualizar } = require('./src/updater');

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
