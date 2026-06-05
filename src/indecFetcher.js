const axios = require('axios');

const URL_INDEC = 'https://apis.indec.gob.ar/series/api/series/';
const ID_ICC = '11.3_ICC_0_0_26';

const NOMBRES_MES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Convierte "2026-05-01" o "2026-05" en "Mayo 2026"
function formatearMes(fechaStr) {
  const partes = fechaStr.split('-');
  return `${NOMBRES_MES[parseInt(partes[1])]} ${partes[0]}`;
}

// fechaDesde: string "YYYY-MM" del mes del PDF
// Devuelve el factor acumulado de ICC y metadata para mostrar al usuario
async function obtenerVariacionICC(fechaDesde) {
  const url = `${URL_INDEC}?ids=${ID_ICC}&start_date=${fechaDesde}`;
  const respuesta = await axios.get(url, {
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  const series = respuesta.data?.data;
  if (!series || series.length === 0) {
    throw new Error('La API del INDEC no devolvió datos de ICC');
  }

  // El primer elemento es el mes del PDF: su variación ya está incluida en el
  // precio del PDF, por lo que se omite. Se aplica desde el mes siguiente.
  let factor = 1;
  let mesesAplicados = 0;
  for (let i = 1; i < series.length; i++) {
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
