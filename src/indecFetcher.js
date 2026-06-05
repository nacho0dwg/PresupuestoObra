const axios = require('axios');

const URL_INDEC = 'https://apis.indec.gob.ar/series/api/series/';
const ID_ICC = '11.3_ICC_0_0_26';

const NOMBRES_MES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatearMes(fechaStr) {
  const partes = fechaStr.split('-');
  return `${NOMBRES_MES[parseInt(partes[1])]} ${partes[0]}`;
}

// fechaDesde: string "YYYY-MM" del mes del PDF
async function obtenerVariacionICC(fechaDesde) {
  const opciones = { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } };
  let series = null;
  let skipFirst = false; // si skipFirst=true, el primer elemento es el mes del PDF y se omite
  const errores = [];

  // Intento 1: con start_date (devuelve desde el mes del PDF en adelante)
  try {
    const resp = await axios.get(
      `${URL_INDEC}?ids=${ID_ICC}&start_date=${fechaDesde}`,
      opciones
    );
    const data = resp.data?.data;
    if (data && data.length > 0) {
      series = data;
      skipFirst = true; // el primer elemento es el mes del PDF, ya incluido en el precio
    }
  } catch (err) {
    errores.push(`start_date: ${err.message}`);
  }

  // Intento 2: con limit=5 sin start_date, filtrando manualmente por fecha
  if (!series) {
    try {
      const resp = await axios.get(
        `${URL_INDEC}?ids=${ID_ICC}&limit=5`,
        opciones
      );
      const data = resp.data?.data;
      if (data && data.length > 0) {
        // Solo los meses posteriores al mes del PDF
        const filtrado = data.filter(e => e[0].substring(0, 7) > fechaDesde);
        if (filtrado.length > 0) {
          series = filtrado;
          skipFirst = false; // ya están filtrados, se aplican todos
        }
      }
    } catch (err) {
      errores.push(`limit=5: ${err.message}`);
    }
  }

  if (!series) {
    throw new Error(`API INDEC no disponible (${errores.join(' / ')})`);
  }

  // Calcular factor acumulado
  let factor = 1;
  let mesesAplicados = 0;
  const inicio = skipFirst ? 1 : 0;
  for (let i = inicio; i < series.length; i++) {
    const variacion = series[i][1];
    if (variacion !== null && variacion !== undefined) {
      factor *= (1 + variacion / 100);
      mesesAplicados++;
    }
  }

  const ultimoDato = series[series.length - 1];
  const hastaElMes = formatearMes(ultimoDato[0]);
  const variacionTotal = (factor - 1) * 100;

  return {
    factor,
    variacionTotal: Math.round(variacionTotal * 100) / 100,
    hastaElMes,
    mesesAplicados,
  };
}

module.exports = { obtenerVariacionICC };
