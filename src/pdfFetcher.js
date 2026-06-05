const axios = require('axios');
const pdfParse = require('pdf-parse');
const cheerio = require('cheerio');

const URL_CPI = 'https://cpicordoba.org.ar';
const PATRON_PDF = 'COSTO-POR-M2-REFERENCIAL-VIVIENDA-130M2-TRADICIONAL';

const MESES = {
  ENERO: 'Enero', FEBRERO: 'Febrero', MARZO: 'Marzo',
  ABRIL: 'Abril', MAYO: 'Mayo', JUNIO: 'Junio',
  JULIO: 'Julio', AGOSTO: 'Agosto', SEPTIEMBRE: 'Septiembre',
  OCTUBRE: 'Octubre', NOVIEMBRE: 'Noviembre', DICIEMBRE: 'Diciembre',
};

// Normaliza formato argentino: "1.395.573,89" → 1395573.89
function normalizarPrecio(texto) {
  return parseFloat(texto.replace(/\./g, '').replace(',', '.'));
}

// Extrae "YYYY-MM" del nombre del archivo PDF
function extraerFechaDeURL(url) {
  const match = url.match(/(\d{4})\.(\d{2})-/);
  return match ? `${match[1]}-${match[2]}` : '0000-00';
}

// Extrae "Marzo 2026" del nombre del archivo PDF
function extraerMesDeURL(url) {
  const match = url.match(/(\d{4})\.(\d{2})-([A-ZÁÉÍÓÚÑ]+)-COSTO/i);
  if (!match) return 'Desconocido';
  const nombre = MESES[match[3].toUpperCase()] || match[3];
  return `${nombre} ${match[1]}`;
}

// Construye las URLs del mes actual y anterior como fallback
function urlsFallback() {
  const hoy = new Date();
  const urls = [];
  for (let delta = 0; delta <= 1; delta++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - delta, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const nombreMes = Object.keys(MESES)[d.getMonth()];
    urls.push(
      `${URL_CPI}/wp-content/uploads/${yyyy}/${String(d.getMonth() + 2).padStart(2, '0')}` +
      `/${yyyy}.${mm}-${nombreMes}-${PATRON_PDF}.pdf`
    );
  }
  return urls;
}

async function buscarURLPDF() {
  // Intenta scraping de la página principal
  try {
    const respuesta = await axios.get(URL_CPI, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const $ = cheerio.load(respuesta.data);
    const links = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.toUpperCase().includes(PATRON_PDF)) {
        // Normalizar a URL absoluta
        const url = href.startsWith('http') ? href : URL_CPI + href;
        links.push(url);
      }
    });

    if (links.length > 0) {
      links.sort((a, b) => extraerFechaDeURL(b).localeCompare(extraerFechaDeURL(a)));
      return links[0];
    }
  } catch (err) {
    console.warn('[pdfFetcher] No se pudo scrapear la página principal:', err.message);
  }

  // Fallback: probar URLs del mes actual y anterior directamente
  for (const url of urlsFallback()) {
    try {
      await axios.head(url, { timeout: 10000 });
      return url;
    } catch {
      // sigue al siguiente
    }
  }

  throw new Error('No se encontró el PDF del IEC en CPI Córdoba');
}

async function descargarYParsearPDF(url) {
  const respuesta = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  const data = await pdfParse(Buffer.from(respuesta.data));
  const texto = data.text;

  const precioBasico = extraerPrecio(texto, 'BÁSICO');
  const precioTotal = extraerPrecio(texto, 'CARGAS SOCIALES');

  if (!precioBasico || !precioTotal) {
    throw new Error(
      'No se pudieron extraer los precios del PDF. El formato puede haber cambiado.'
    );
  }

  return {
    precioM2Basico: precioBasico,
    precioM2Total: precioTotal,
    mesReferencia: extraerMesDeURL(url),
    fechaPDF: extraerFechaDeURL(url) + '-01',
    urlPDF: url,
  };
}

// Busca el precio en los ~300 caracteres que siguen al marcador de texto
function extraerPrecio(texto, marcador) {
  const idx = texto.toUpperCase().indexOf(marcador.toUpperCase());
  if (idx === -1) return null;

  const fragmento = texto.substring(idx, idx + 300);
  // Patrón: número en formato argentino, ej: 1.395.573,89 o 1.744.394,49
  const match = fragmento.match(/\$?\s*([\d]{1,3}(?:\.[\d]{3})*,\d{2})/);
  return match ? normalizarPrecio(match[1]) : null;
}

module.exports = { buscarURLPDF, descargarYParsearPDF, extraerFechaDeURL };
