// Multiplicadores según CLAUDE.md
const MULTIPLICADORES = {
  tipoObra: {
    nueva:             1.00,
    refaccion_total:   0.85,
    refaccion_parcial: 0.45,
  },
  plantas: {
    '1': 1.00,
    '2': 1.08,
    '3': 1.15,
  },
  terminaciones: {
    economica: 0.80,
    estandar:  1.00,
    premium:   1.35,
    lujo:      1.70,
  },
};

// Proporciones del desglose sobre el total
const DESGLOSE_PESOS = {
  tramites:      0.05,
  preliminares:  0.03,
  obraGruesa:    0.20,
  manoDeObra:    0.32,
  instalaciones: 0.14,
  terminaciones: 0.21,
  honorarios:    0.05,
};

let preciosActuales = null;
let datosActuales   = null;
let resultadoActual = null;

// ===== Formateo de números en formato argentino =====
function formatearPesos(valor) {
  return '$ ' + valor.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ===== Cargar precios desde el servidor =====
async function cargarPrecios() {
  try {
    const respuesta = await fetch('/api/precios');
    if (!respuesta.ok) throw new Error('Error en respuesta del servidor');
    preciosActuales = await respuesta.json();
    actualizarPanelEstado();
  } catch (error) {
    console.error('Error al cargar precios:', error);
    // Fallback con valores hardcodeados de Marzo 2026
    preciosActuales = {
      mesReferencia: 'Marzo 2026',
      precioM2Basico: 1395573.89,
      precioM2Total: 1744394.49,
      fuente: 'IEC - CPI Córdoba (datos locales)',
      ultimaActualizacion: '2026-03-01',
      actualizadoConICC: false,
    };
    actualizarPanelEstado();
  }
}

// ===== Actualizar panel de estado con los datos cargados =====
function actualizarPanelEstado() {
  if (!preciosActuales) return;
  const p = preciosActuales;

  document.getElementById('estadoFuente').textContent = p.fuente || '—';
  document.getElementById('estadoMes').textContent = p.mesReferencia || '—';
  document.getElementById('estadoBaseTotal').textContent =
    p.precioM2TotalOriginal ? formatearPesos(p.precioM2TotalOriginal) : formatearPesos(p.precioM2Total);

  const seccionICC = document.getElementById('estadoSeccionICC');
  if (p.actualizadoConICC) {
    seccionICC.style.display = '';
    const etiquetaFuente = p.iccFuente === 'histórico' ? ' (datos históricos)' : '';
    document.getElementById('estadoICC').textContent =
      `+${p.variacionICC.toFixed(2)}% hasta ${p.iccHastaElMes}${etiquetaFuente}`;
    document.getElementById('estadoTotal').textContent = formatearPesos(p.precioM2Total);
  } else {
    seccionICC.style.display = 'none';
  }

  if (p.ultimaVerificacion) {
    const fecha = new Date(p.ultimaVerificacion);
    document.getElementById('estadoVerificacion').textContent =
      fecha.toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
  } else {
    document.getElementById('estadoVerificacion').textContent = 'Nunca';
  }
}

// ===== Lógica de cálculo =====
function calcularPresupuesto(datos) {
  const { metros, tipoObra, plantas, banios, cocinas, terminaciones } = datos;
  const precioM2 = preciosActuales.precioM2Total;

  const precioBase = metros * precioM2;
  const conPlantas = precioBase * MULTIPLICADORES.plantas[plantas];
  const conTerminaciones = conPlantas * MULTIPLICADORES.terminaciones[terminaciones];
  const conTipoObra = conTerminaciones * MULTIPLICADORES.tipoObra[tipoObra];

  // Instalaciones adicionales sobre el precio base
  const baniosExtra = Math.max(0, banios - 1);
  const ajusteInstalaciones = precioBase * (baniosExtra * 0.025 + cocinas * 0.015);

  const total = conTipoObra + ajusteInstalaciones;

  return {
    total,
    precioM2Aplicado: precioM2,
    desglose: {
      tramites:      total * DESGLOSE_PESOS.tramites,
      preliminares:  total * DESGLOSE_PESOS.preliminares,
      obraGruesa:    total * DESGLOSE_PESOS.obraGruesa,
      manoDeObra:    total * DESGLOSE_PESOS.manoDeObra,
      instalaciones: total * DESGLOSE_PESOS.instalaciones,
      terminaciones: total * DESGLOSE_PESOS.terminaciones,
      honorarios:    total * DESGLOSE_PESOS.honorarios,
    },
  };
}

// ===== Validación del formulario =====
function validarFormulario() {
  const errores = [];
  const campos = ['metros', 'tipoObra', 'plantas', 'banios', 'cocinas', 'terminaciones'];

  campos.forEach(id => {
    const el = document.getElementById(id);
    const vacio = !el.value || el.value === '';
    el.classList.toggle('invalido', vacio);
    if (vacio) errores.push(id);
  });

  const metros = parseFloat(document.getElementById('metros').value);
  if (!isNaN(metros) && metros <= 0) {
    document.getElementById('metros').classList.add('invalido');
    errores.push('metros_invalido');
  }

  return errores;
}

// ===== Mostrar resultado =====
function mostrarResultado(resultado) {
  document.getElementById('totalValor').textContent = formatearPesos(resultado.total);
  document.getElementById('infoFuente').textContent =
    `Precio m² aplicado: ${formatearPesos(resultado.precioM2Aplicado)} — Basado en ${preciosActuales.mesReferencia} (${preciosActuales.fuente})`;

  document.getElementById('desgloseTramites').textContent      = formatearPesos(resultado.desglose.tramites);
  document.getElementById('desglosePreliminares').textContent  = formatearPesos(resultado.desglose.preliminares);
  document.getElementById('desgloseObraGruesa').textContent    = formatearPesos(resultado.desglose.obraGruesa);
  document.getElementById('desgloseManoDeObra').textContent    = formatearPesos(resultado.desglose.manoDeObra);
  document.getElementById('desgloseInstalaciones').textContent = formatearPesos(resultado.desglose.instalaciones);
  document.getElementById('desgloseTerminaciones').textContent = formatearPesos(resultado.desglose.terminaciones);
  document.getElementById('desgloseHonorarios').textContent    = formatearPesos(resultado.desglose.honorarios);
  document.getElementById('desgloseTotalFinal').textContent    = formatearPesos(resultado.total);

  document.getElementById('seccionFormulario').hidden = true;
  const seccionResultado = document.getElementById('seccionResultado');
  seccionResultado.hidden = false;
  seccionResultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== Eventos =====
document.getElementById('formulario').addEventListener('submit', function (e) {
  e.preventDefault();

  const errores = validarFormulario();
  const divError = document.getElementById('errorFormulario');

  if (errores.length > 0) {
    divError.textContent = 'Por favor completá todos los campos obligatorios (marcados con *).';
    divError.hidden = false;
    return;
  }

  divError.hidden = true;

  const datos = {
    metros:        parseFloat(document.getElementById('metros').value),
    tipoObra:      document.getElementById('tipoObra').value,
    plantas:       document.getElementById('plantas').value,
    ambientes:     parseInt(document.getElementById('ambientes').value) || null,
    banios:        parseInt(document.getElementById('banios').value) || 1,
    cocinas:       parseInt(document.getElementById('cocinas').value) || 1,
    terminaciones: document.getElementById('terminaciones').value,
  };

  datosActuales   = datos;
  const resultado = calcularPresupuesto(datos);
  resultadoActual = resultado;
  mostrarResultado(resultado);
});

document.getElementById('btnNuevaConsulta').addEventListener('click', function () {
  document.getElementById('seccionResultado').hidden = true;
  document.getElementById('seccionFormulario').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('btnInfo').addEventListener('click', function () {
  document.getElementById('panelEstado').hidden = false;
  document.getElementById('overlay').hidden = false;
});

document.getElementById('btnCerrarPanel').addEventListener('click', cerrarPanel);
document.getElementById('overlay').addEventListener('click', cerrarPanel);

function cerrarPanel() {
  document.getElementById('panelEstado').hidden = true;
  document.getElementById('overlay').hidden = true;
}

document.getElementById('btnActualizar').addEventListener('click', async function () {
  const btn = this;
  const divMensaje = document.getElementById('estadoMensaje');
  btn.disabled = true;
  btn.textContent = 'Verificando...';
  divMensaje.hidden = true;

  try {
    const respuesta = await fetch('/api/actualizar', { method: 'POST' });
    const resultado = await respuesta.json();

    if (resultado.exito && resultado.datos) {
      preciosActuales = resultado.datos;
      actualizarPanelEstado();
    }

    divMensaje.textContent = resultado.mensaje || 'Actualización completada.';
    divMensaje.className = 'estado-mensaje' + (resultado.exito ? ' estado-mensaje-ok' : ' estado-mensaje-error');
    divMensaje.hidden = false;
  } catch {
    divMensaje.textContent = 'Error al conectar con el servidor.';
    divMensaje.className = 'estado-mensaje estado-mensaje-error';
    divMensaje.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verificar actualizaciones';
  }
});

// ===== Exportar a PDF =====

const ETIQUETAS = {
  tipoObra: {
    nueva:             'Construcción nueva',
    refaccion_parcial: 'Refacción parcial',
    refaccion_total:   'Refacción total',
  },
  plantas: { '1': '1 planta', '2': '2 plantas', '3': '3 plantas o más' },
  terminaciones: {
    economica: 'Económica',
    estandar:  'Estándar',
    premium:   'Premium',
    lujo:      'Lujo',
  },
};

function generarPDF() {
  if (!datosActuales || !resultadoActual) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const M      = 18;          // margen izquierdo/derecho
  const ANCHO  = 210 - M * 2; // 174mm ancho útil
  const AZUL   = [26, 79, 122];
  const NARANJA = [232, 119, 34];
  const GRIS   = [90, 106, 120];
  const NEGRO  = [30, 42, 53];

  const fechaHoy = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  let y = 0;

  // ── ENCABEZADO ──────────────────────────────────────────────────────────
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PresupuestoObra', M, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Presupuesto de obra estimado', M, 22);
  doc.text(`Generado el ${fechaHoy}`, M, 29);

  y = 44;

  // ── PARÁMETROS ──────────────────────────────────────────────────────────
  doc.setTextColor(...AZUL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PARAMETROS DE LA OBRA', M, y);
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.4);
  doc.line(M, y + 2, M + ANCHO, y + 2);
  y += 8;

  const d = datosActuales;
  const params = [
    ['Superficie',     `${d.metros} m\xB2`],
    ['Tipo de obra',   ETIQUETAS.tipoObra[d.tipoObra]],
    ['Plantas',        ETIQUETAS.plantas[d.plantas]],
    ['Ambientes',      d.ambientes ? String(d.ambientes) : 'No especificado'],
    ['Ba\xF1os',       String(d.banios)],
    ['Cocinas',        String(d.cocinas)],
    ['Terminaciones',  ETIQUETAS.terminaciones[d.terminaciones]],
  ];

  doc.setFontSize(10);
  for (const [label, valor] of params) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRIS);
    doc.text(label + ':', M, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...NEGRO);
    doc.text(valor, M + 48, y);
    y += 7;
  }

  y += 3;

  // ── TOTAL DESTACADO ─────────────────────────────────────────────────────
  doc.setFillColor(242, 244, 247);
  doc.roundedRect(M, y, ANCHO, 22, 3, 3, 'F');
  doc.setFillColor(...NARANJA);
  doc.roundedRect(M, y, 4, 22, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text('TOTAL ESTIMADO', M + ANCHO / 2, y + 8, { align: 'center' });

  doc.setFontSize(19);
  doc.setTextColor(...AZUL);
  doc.text(formatearPesos(resultadoActual.total), M + ANCHO / 2, y + 18, { align: 'center' });

  y += 29;

  // ── DESGLOSE ────────────────────────────────────────────────────────────
  doc.setTextColor(...AZUL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DESGLOSE POR CATEGORIA', M, y);
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.4);
  doc.line(M, y + 2, M + ANCHO, y + 2);
  y += 8;

  const categorias = [
    ['Tramites y gestiones previas',           resultadoActual.desglose.tramites],
    ['Trabajos preliminares',                  resultadoActual.desglose.preliminares],
    ['Estructura y obra gruesa (materiales)',   resultadoActual.desglose.obraGruesa],
    ['Mano de obra total',                     resultadoActual.desglose.manoDeObra],
    ['Instalaciones (sanitaria, electrica, gas)', resultadoActual.desglose.instalaciones],
    ['Terminaciones',                          resultadoActual.desglose.terminaciones],
    ['Honorarios profesionales',               resultadoActual.desglose.honorarios],
  ];

  doc.setFontSize(9.5);
  for (const [label, monto] of categorias) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...NEGRO);
    doc.text(label, M + 2, y);
    doc.setFont('helvetica', 'bold');
    doc.text(formatearPesos(monto), M + ANCHO, y, { align: 'right' });
    y += 6.5;
    doc.setDrawColor(208, 216, 224);
    doc.setLineWidth(0.15);
    doc.line(M, y - 1.5, M + ANCHO, y - 1.5);
  }

  // Fila total del desglose
  doc.setFillColor(...AZUL);
  doc.rect(M, y - 1, ANCHO, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL', M + 2, y + 4.5);
  doc.text(formatearPesos(resultadoActual.total), M + ANCHO, y + 4.5, { align: 'right' });
  y += 14;

  // ── FUENTE DE PRECIOS ────────────────────────────────────────────────────
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRIS);
  doc.text(`Precio m\xB2 aplicado: ${formatearPesos(resultadoActual.precioM2Aplicado)}`, M, y);
  y += 5.5;

  const p = preciosActuales || {};
  let fuenteTexto = `Base: ${p.mesReferencia || ''}`;
  if (p.actualizadoConICC) {
    const fuente = p.iccFuente === 'historico' ? 'datos historicos' : (p.iccFuente || 'ICC');
    fuenteTexto += `, actualizado con ${fuente} hasta ${p.iccHastaElMes || ''}`;
  }
  doc.text(fuenteTexto, M, y);
  y += 10;

  // ── AVISO LEGAL ──────────────────────────────────────────────────────────
  doc.setFillColor(248, 249, 251);
  doc.setDrawColor(208, 216, 224);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, ANCHO, 13, 2, 2, 'FD');
  doc.setFillColor(...NARANJA);
  doc.roundedRect(M, y, 3, 13, 1, 1, 'F');

  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text(
    'Valores referenciales segun datos del IEC/CPI Cordoba.',
    M + 6, y + 5.5
  );
  doc.text(
    'No constituyen presupuesto definitivo de obra.',
    M + 6, y + 10.5
  );

  // ── PIE DE PÁGINA ────────────────────────────────────────────────────────
  doc.setFillColor(...AZUL);
  doc.rect(0, 285, 210, 12, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('PresupuestoObra — Cordoba, Argentina', M, 292);
  doc.text(fechaHoy, 210 - M, 292, { align: 'right' });

  const nombre = `presupuesto-${new Date().toISOString().substring(0, 10)}.pdf`;
  doc.save(nombre);
}

document.getElementById('btnExportarPDF').addEventListener('click', generarPDF);

// ===== Inicialización =====
cargarPrecios();
