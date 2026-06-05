const fs = require('fs');
const path = require('path');

const RUTA_PRECIOS = path.join(__dirname, '..', 'data', 'precios.json');

const FALLBACK = {
  mesReferencia: 'Marzo 2026',
  precioM2Basico: 1395573.89,
  precioM2Total: 1744394.49,
  precioM2BasicoOriginal: 1395573.89,
  precioM2TotalOriginal: 1744394.49,
  fuente: 'IEC - CPI Córdoba (datos locales)',
  urlPDF: null,
  fechaPDF: '2026-03-01',
  actualizadoConICC: false,
  variacionICC: 0,
  iccHastaElMes: null,
  ultimaVerificacion: null,
};

function leerPrecios() {
  try {
    return JSON.parse(fs.readFileSync(RUTA_PRECIOS, 'utf8'));
  } catch {
    return { ...FALLBACK };
  }
}

function guardarPrecios(datos) {
  fs.writeFileSync(RUTA_PRECIOS, JSON.stringify(datos, null, 2), 'utf8');
}

module.exports = { leerPrecios, guardarPrecios };
