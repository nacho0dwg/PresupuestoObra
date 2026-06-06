const axios = require('axios');
const pdfParse = require('pdf-parse');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const URL_INDEC_API  = 'https://apis.indec.gob.ar/series/api/series/';
const URL_INDEC_WEB  = 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31';
const URL_INDEC_BASE = 'https://www.indec.gob.ar';
const ID_ICC = '11.3_ICC_0_0_26';
const RUTA_HISTORICO = path.join(__dirname, '..', 'data', 'icc-historico.json');

const NOMBRES_MES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const NOMBRES_MES_LOWER = [
  '', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatearMes(mesStr) {
  const [anio, mes] = mesStr.split('-');
  return `${NOMBRES_MES[parseInt(mes)]} ${anio}`;
}

// ===== Histórico local =====

function leerHistorico() {
  try {
    return JSON.parse(fs.readFileSync(RUTA_HISTORICO, 'utf8'));
  } catch {
    return [];
  }
}

function guardarEnHistorico(mes, variacion) {
  const historico = leerHistorico();
  if (historico.find(e => e.mes === mes)) return; // ya existe
  historico.push({ mes, variacion });
  historico.sort((a, b) => a.mes.localeCompare(b.mes));
  fs.writeFileSync(RUTA_HISTORICO, JSON.stringify(historico, null, 2), 'utf8');
  console.log(`[ICC] Histórico actualizado: ${mes} → ${variacion}%`);
}

// Escribe el array completo (para upsert desde el admin)
function guardarHistoricoCompleto(historico) {
  historico.sort((a, b) => a.mes.localeCompare(b.mes));
  fs.writeFileSync(RUTA_HISTORICO, JSON.stringify(historico, null, 2), 'utf8');
}

// Calcula factor acumulado con los datos del histórico local
function calcularDesdeHistorico(fechaDesde) {
  const historico = leerHistorico();
  const relevantes = historico
    .filter(e => e.mes > fechaDesde)
    .sort((a, b) => a.mes.localeCompare(b.mes));

  if (relevantes.length === 0) return null;

  let factor = 1;
  for (const { variacion } of relevantes) {
    factor *= (1 + variacion / 100);
  }

  const ultimo = relevantes[relevantes.length - 1];
  return {
    factor,
    variacionTotal: Math.round((factor - 1) * 10000) / 100,
    hastaElMes: formatearMes(ultimo.mes),
    mesesAplicados: relevantes.length,
    fuente: 'histórico',
  };
}

// ===== Scraping de la página web del INDEC =====

function extraerMesDelTexto(texto) {
  const fragmento = texto.toLowerCase().substring(0, 1500);
  for (let i = 1; i <= 12; i++) {
    const regex = new RegExp(`${NOMBRES_MES_LOWER[i]}\\s+(?:de\\s+)?(20\\d{2})`);
    const match = fragmento.match(regex);
    if (match) return `${match[1]}-${String(i).padStart(2, '0')}`;
  }
  return null;
}

function extraerVariacionDelTexto(texto) {
  const matchSuba = texto.match(/registra\s+una\s+suba\s+de\s+([\d]+[,\.][\d]+)\s*%/i);
  if (matchSuba) return parseFloat(matchSuba[1].replace(',', '.'));

  const matchBaja = texto.match(/registra\s+una\s+baja\s+de\s+([\d]+[,\.][\d]+)\s*%/i);
  if (matchBaja) return -parseFloat(matchBaja[1].replace(',', '.'));

  return null;
}

async function scrapearPaginaINDEC() {
  const opciones = { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } };

  const respWeb = await axios.get(URL_INDEC_WEB, opciones);
  const $ = cheerio.load(respWeb.data);
  const links = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('/uploads/informesdeprensa/icc_')) {
      links.push(href.startsWith('http') ? href : URL_INDEC_BASE + href);
    }
  });

  if (links.length === 0) throw new Error('No se encontraron PDFs de ICC en la página del INDEC');

  // El nombre de archivo incluye fecha → el último alfabéticamente es el más reciente
  links.sort();
  const urlPDF = links[links.length - 1];
  console.log(`[ICC] PDF encontrado: ${urlPDF}`);

  const respPDF = await axios.get(urlPDF, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  const { text } = await pdfParse(Buffer.from(respPDF.data));

  const mes = extraerMesDelTexto(text);
  const variacion = extraerVariacionDelTexto(text);

  if (!mes || variacion === null) {
    throw new Error(`PDF descargado pero no se pudo extraer datos (mes: ${mes}, variación: ${variacion})`);
  }

  guardarEnHistorico(mes, variacion);
  return { mes, variacion };
}

// ===== Función principal =====

async function obtenerVariacionICC(fechaDesde) {
  const opciones = { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } };

  // Intento 1: API INDEC con start_date
  try {
    const resp = await axios.get(`${URL_INDEC_API}?ids=${ID_ICC}&start_date=${fechaDesde}`, opciones);
    const data = resp.data?.data;
    if (data && data.length > 0) {
      let factor = 1, mesesAplicados = 0;
      for (let i = 1; i < data.length; i++) {
        const v = data[i][1];
        if (v != null) { factor *= (1 + v / 100); mesesAplicados++; }
      }
      if (mesesAplicados > 0) {
        const ultimo = data[data.length - 1];
        return {
          factor,
          variacionTotal: Math.round((factor - 1) * 10000) / 100,
          hastaElMes: formatearMes(ultimo[0].substring(0, 7)),
          mesesAplicados,
          fuente: 'INDEC',
        };
      }
    }
  } catch { /* sigue */ }

  // Intento 2: API INDEC con limit=5
  try {
    const resp = await axios.get(`${URL_INDEC_API}?ids=${ID_ICC}&limit=5`, opciones);
    const data = resp.data?.data;
    if (data && data.length > 0) {
      const filtrado = data.filter(e => e[0].substring(0, 7) > fechaDesde);
      if (filtrado.length > 0) {
        let factor = 1;
        for (const [, v] of filtrado) if (v != null) factor *= (1 + v / 100);
        const ultimo = filtrado[filtrado.length - 1];
        return {
          factor,
          variacionTotal: Math.round((factor - 1) * 10000) / 100,
          hastaElMes: formatearMes(ultimo[0].substring(0, 7)),
          mesesAplicados: filtrado.length,
          fuente: 'INDEC',
        };
      }
    }
  } catch { /* sigue */ }

  // Intento 3: scraping de la página web del INDEC (actualiza el histórico si funciona)
  try {
    await scrapearPaginaINDEC();
  } catch (err) {
    console.warn('[ICC] Scraping web INDEC fallido:', err.message);
  }

  // Fallback: histórico local (semilla + cualquier scraping previo exitoso)
  const resultado = calcularDesdeHistorico(fechaDesde);
  if (resultado) {
    console.log(`[ICC] Usando histórico local: ${resultado.mesesAplicados} mes(es) hasta ${resultado.hastaElMes}`);
    return resultado;
  }

  throw new Error('No se pudo obtener el ICC por ninguna vía disponible');
}

module.exports = { obtenerVariacionICC, leerHistorico, guardarHistoricoCompleto };
