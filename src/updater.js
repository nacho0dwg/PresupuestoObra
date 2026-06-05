const dataStore = require('./dataStore');
const pdfFetcher = require('./pdfFetcher');
const indecFetcher = require('./indecFetcher');

async function verificarYActualizar() {
  const resultado = {
    exito: false,
    pdfActualizado: false,
    iccAplicado: false,
    mensaje: '',
    datos: null,
  };

  const guardados = dataStore.leerPrecios();
  let nuevos = { ...guardados };

  // --- Paso 1: intentar obtener PDF más reciente ---
  try {
    const urlPDF = await pdfFetcher.buscarURLPDF();
    const fechaNuevo = pdfFetcher.extraerFechaDeURL(urlPDF);           // "YYYY-MM"
    const fechaActual = (guardados.fechaPDF || '0000-00-00').substring(0, 7);

    if (fechaNuevo > fechaActual) {
      const datosPDF = await pdfFetcher.descargarYParsearPDF(urlPDF);
      nuevos = {
        ...datosPDF,
        precioM2BasicoOriginal: datosPDF.precioM2Basico,
        precioM2TotalOriginal:  datosPDF.precioM2Total,
        fuente: 'IEC - CPI Córdoba',
        actualizadoConICC: false,
        variacionICC: 0,
        iccHastaElMes: null,
        ultimaVerificacion: new Date().toISOString(),
      };
      resultado.pdfActualizado = true;
      resultado.mensaje = `PDF actualizado: ${datosPDF.mesReferencia}.`;
      console.log(`[Actualizador] PDF nuevo: ${datosPDF.mesReferencia}`);
    } else {
      nuevos.ultimaVerificacion = new Date().toISOString();
      resultado.mensaje = `PDF sin cambios (${guardados.mesReferencia}).`;
      console.log(`[Actualizador] PDF sin cambios: ${guardados.mesReferencia}`);
    }
  } catch (err) {
    nuevos.ultimaVerificacion = new Date().toISOString();
    resultado.mensaje = `No se pudo obtener el PDF: ${err.message}. Usando datos en caché.`;
    console.error('[Actualizador] Error PDF:', err.message);
  }

  // --- Paso 2: actualizar con ICC si el PDF tiene más de un mes ---
  const hoy = new Date();
  const fechaPDF = new Date(nuevos.fechaPDF || '2026-03-01');
  const mesesDesdePDF =
    (hoy.getFullYear() - fechaPDF.getFullYear()) * 12 +
    (hoy.getMonth() - fechaPDF.getMonth());

  if (mesesDesdePDF >= 1) {
    try {
      const fechaDesde = nuevos.fechaPDF.substring(0, 7); // "YYYY-MM"
      const icc = await indecFetcher.obtenerVariacionICC(fechaDesde);

      if (icc.mesesAplicados > 0) {
        const baseBasico = nuevos.precioM2BasicoOriginal || nuevos.precioM2Basico;
        const baseTotal  = nuevos.precioM2TotalOriginal  || nuevos.precioM2Total;

        nuevos = {
          ...nuevos,
          precioM2Basico:    baseBasico * icc.factor,
          precioM2Total:     baseTotal  * icc.factor,
          actualizadoConICC: true,
          variacionICC:      icc.variacionTotal,
          iccHastaElMes:     icc.hastaElMes,
        };
        resultado.iccAplicado = true;
        resultado.mensaje +=
          ` ICC aplicado: +${icc.variacionTotal}% hasta ${icc.hastaElMes}.`;
        console.log(
          `[Actualizador] ICC: +${icc.variacionTotal}% hasta ${icc.hastaElMes}`
        );
      }
    } catch (err) {
      resultado.mensaje += ` ICC no disponible: ${err.message}.`;
      console.error('[Actualizador] Error ICC:', err.message);
    }
  }

  dataStore.guardarPrecios(nuevos);
  resultado.exito = true;
  resultado.datos = nuevos;
  return resultado;
}

module.exports = { verificarYActualizar };
