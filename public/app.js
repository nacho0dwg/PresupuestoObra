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

// Imágenes de arquitectura brutalista/minimalista — rotan cada 12 horas
const IMAGENES_ARQ = [
  {
    url: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=440&auto=format&fit=crop&q=80',
    nombre: 'BARBICAN CENTRE',
    arquitecto: 'Chamberlin, Powell & Bon — 1982',
  },
  {
    url: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=440&auto=format&fit=crop&q=80',
    nombre: 'ESTRUCTURA EXPUESTA',
    arquitecto: 'Brutalismo tardío — s. XX',
  },
  {
    url: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=440&auto=format&fit=crop&q=80',
    nombre: 'GEOMETRÍA EN HORMIGÓN',
    arquitecto: 'Movimiento Moderno',
  },
  {
    url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=440&auto=format&fit=crop&q=80',
    nombre: 'PLANTA LIBRE',
    arquitecto: 'Le Corbusier — 1952',
  },
  {
    url: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=440&auto=format&fit=crop&q=80',
    nombre: 'MASA Y VACÍO',
    arquitecto: 'Tadao Ando — 1989',
  },
  {
    url: 'https://images.unsplash.com/photo-1565117798655-7d0a7a96cfe2?w=440&auto=format&fit=crop&q=80',
    nombre: 'SALK INSTITUTE',
    arquitecto: 'Louis Kahn — 1965',
  },
];

let preciosActuales = null;
let datosActuales   = null;
let resultadoActual = null;
let dolarCache      = null;
let usdActivo       = false;

// ===== Formateo de números en formato argentino =====
function formatearPesos(valor) {
  return '$ ' + valor.toLocaleString('es-AR', {
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

  actualizarHeaderMeta();
}

// ===== Actualizar meta del header con los precios actuales =====
function actualizarHeaderMeta() {
  if (!preciosActuales) return;
  const p = preciosActuales;

  const elMes = document.getElementById('headerMes');
  const elICC = document.getElementById('headerICC');

  if (elMes && p.mesReferencia) {
    elMes.textContent = p.mesReferencia.toUpperCase();
  }
  if (elICC) {
    if (p.actualizadoConICC && p.variacionICC != null) {
      elICC.textContent = `ICC +${p.variacionICC.toFixed(1)}%`;
    } else {
      elICC.textContent = 'SIN ICC';
    }
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
  const elTotal = document.getElementById('totalValor');
  animarContador(elTotal, resultado.total, 1200);
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

  // Nombre del proyecto
  const elNombre = document.getElementById('resultadoNombre');
  if (elNombre) {
    const nombre = datosActuales?.nombreProyecto;
    if (nombre) { elNombre.textContent = nombre.toUpperCase(); elNombre.hidden = false; }
    else elNombre.hidden = true;
  }

  // Resetear toggle USD
  usdActivo = false;
  const btnToggle = document.getElementById('toggleUSD');
  if (btnToggle) { btnToggle.textContent = 'Ver en USD'; btnToggle.classList.remove('activo'); btnToggle.disabled = false; }

  // Ocultar conversión USD hasta que cargue
  const elUSD = document.getElementById('conversionUSD');
  if (elUSD) elUSD.hidden = true;

  document.getElementById('seccionFormulario').hidden = true;
  const seccionResultado = document.getElementById('seccionResultado');
  seccionResultado.hidden = false;
  seccionResultado.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Cargar cotización y guardar en historial (no-blocking)
  cargarDolar();
  if (!cargandoDesdeHash) guardarEnHistorial();
}

// ===== Eventos del formulario =====
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
    nombreProyecto: document.getElementById('nombreProyecto')?.value.trim() || null,
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
  document.getElementById('comparativa').hidden = true;
  document.getElementById('conversionUSD').hidden = true;
  const btnComparar = document.getElementById('btnComparar');
  if (btnComparar) btnComparar.textContent = '⇄ Steel Frame';
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
  document.getElementById('historialPanel').hidden = true;
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

// ===== Etiquetas para el PDF =====
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

// ===== Exportar a PDF — rediseño completo =====
function generarPDF() {
  if (!datosActuales || !resultadoActual) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const M     = 18;
  const ANCHO = 210 - M * 2;

  const FONDO = [247, 246, 242];
  const NEGRO = [26, 26, 26];
  const ROJO  = [192, 57, 43];
  const GRIS  = [150, 146, 138];
  const BORDE = [210, 207, 200];

  const fechaHoy = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  // Fondo crema
  doc.setFillColor(...FONDO);
  doc.rect(0, 0, 210, 297, 'F');

  // Grilla de cruces (marca de agua)
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.15);
  const PASO = 10; const TAM = 1.6;
  for (let px = 5; px < 210; px += PASO)
    for (let py = 5; py < 297; py += PASO) {
      doc.line(px, py - TAM, px, py + TAM);
      doc.line(px - TAM, py, px + TAM, py);
    }

  // ── HEADER ──────────────────────────────────────────────────────────────────
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NEGRO);
  doc.text('PRESUPUESTO\xB7OBRA', M, 15);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...GRIS);
  doc.text('C\xD3RDOBA \xB7 ARG', M, 20.5);

  // Logo del estudio (si existe)
  const logoB64 = localStorage.getItem(LOGO_KEY);
  if (logoB64) {
    try { doc.addImage(logoB64, 210 - M - 35, 10, 35, 12, '', 'FAST'); } catch { /* sin logo */ }
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...GRIS);
  doc.text(`Generado el ${fechaHoy}`, 210 - M, logoB64 ? 26 : 20.5, { align: 'right' });

  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.4);
  doc.line(M, 27, 210 - M, 27);

  let y = 36;

  // Nombre del proyecto
  const nombreProyecto = datosActuales.nombreProyecto;
  if (nombreProyecto) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...NEGRO);
    doc.text(nombreProyecto.toUpperCase(), M, y);
    y += 7;
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS);
    doc.text('PROYECTO \xB7 C\xD3RDOBA, ARGENTINA', M, y);
    y += 10;
  }

  // ── BLOQUE 01 PARÁMETROS ─────────────────────────────────────────────────
  // Fondo del bloque
  doc.setFillColor(240, 238, 233);
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.4);

  const d = datosActuales;
  const params = [
    ['SUPERFICIE',    `${d.metros} m\xB2`],
    ['TIPO DE OBRA',  ETIQUETAS.tipoObra[d.tipoObra]],
    ['PLANTAS',       ETIQUETAS.plantas[d.plantas]],
    ['AMBIENTES',     d.ambientes ? String(d.ambientes) : 'No especificado'],
    ['BA\xD1OS',      String(d.banios)],
    ['COCINAS',       String(d.cocinas)],
    ['TERMINACIONES', ETIQUETAS.terminaciones[d.terminaciones]],
  ];

  const COL2 = M + ANCHO / 2;
  const filaH = 7;
  const bloqueH = 8 + Math.ceil(params.length / 2) * filaH;

  doc.rect(M, y, ANCHO, bloqueH, 'FD');

  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...GRIS);
  doc.text('01 \xB7 PAR\xC1METROS', M + 3, y + 5);

  let yr = y + 10;
  params.forEach(([label, valor], i) => {
    const col = i % 2 === 0 ? M + 3 : COL2 + 3;
    if (i % 2 === 0 && i > 0) yr += filaH;
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...GRIS);
    doc.text(label, col, yr);
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...NEGRO);
    doc.text(valor, col, yr + 4);
  });

  y += bloqueH + 6;

  // ── BLOQUE 02 TOTAL ───────────────────────────────────────────────────────
  doc.setFillColor(240, 238, 233);
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.4);
  doc.rect(M, y, ANCHO, 28, 'FD');

  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...GRIS);
  doc.text('02 \xB7 TOTAL ESTIMADO', M + 3, y + 5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...ROJO);
  doc.text(formatearPesos(resultadoActual.total), M + 3, y + 18);

  // USD si hay cotización
  if (dolarCache?.blue) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRIS);
    const usd = Math.round(resultadoActual.total / dolarCache.blue);
    doc.text(`≈ U$D ${usd.toLocaleString('es-AR')} (blue $${dolarCache.blue.toLocaleString('es-AR')})`, M + 3, y + 25);
  }

  y += 34;

  // ── BLOQUE 03 DESGLOSE ────────────────────────────────────────────────────
  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...GRIS);
  doc.text('03 \xB7 DESGLOSE POR CATEGOR\xCDA', M, y);
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.4);
  doc.line(M, y + 2.5, 210 - M, y + 2.5);
  y += 8;

  const categorias = [
    ['Tramites y gestiones previas',              resultadoActual.desglose.tramites],
    ['Trabajos preliminares',                     resultadoActual.desglose.preliminares],
    ['Estructura y obra gruesa (materiales)',      resultadoActual.desglose.obraGruesa],
    ['Mano de obra total',                        resultadoActual.desglose.manoDeObra],
    ['Instalaciones (sanitaria, electrica, gas)', resultadoActual.desglose.instalaciones],
    ['Terminaciones',                             resultadoActual.desglose.terminaciones],
    ['Honorarios profesionales',                  resultadoActual.desglose.honorarios],
  ];

  for (const [label, monto] of categorias) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...NEGRO);
    doc.text(label, M, y);
    doc.setFont('courier', 'bold');
    doc.text(formatearPesos(monto), 210 - M, y, { align: 'right' });
    y += 5.5;
    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.15);
    doc.line(M, y - 1, 210 - M, y - 1);
  }

  y += 2;
  doc.setDrawColor(...ROJO);
  doc.setLineWidth(0.6);
  doc.line(M, y, 210 - M, y);
  y += 5;
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NEGRO);
  doc.text('TOTAL', M, y);
  doc.setTextColor(...ROJO);
  doc.text(formatearPesos(resultadoActual.total), 210 - M, y, { align: 'right' });
  y += 10;

  // ── BLOQUE 04 PLAN DE OBRA (GANTT) ────────────────────────────────────────
  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...GRIS);
  doc.text('04 \xB7 PLAN DE OBRA \xB7 ESQUEMA REFERENCIAL', M, y);
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.4);
  doc.line(M, y + 2.5, 210 - M, y + 2.5);
  y += 8;

  const etapas = [
    ['TR\xC1MITES',     '25%', 0,    0.15],
    ['FUNDACIONES',     '30%', 0.15, 0.30],
    ['ESTRUCTURA',      '20%', 0.45, 0.25],
    ['INSTALACIONES',   '15%', 0.70, 0.18],
    ['TERMINACIONES',   '10%', 0.88, 0.12],
  ];

  const barraX = M + 36;
  const barraW = ANCHO - 36;
  const barraH = 3.5;

  for (const [nombre, pct, inicio, duracion] of etapas) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...NEGRO);
    doc.text(nombre, M, y + 3);

    // Fondo barra
    doc.setFillColor(225, 223, 216);
    doc.rect(barraX, y, barraW, barraH, 'F');

    // Barra de la etapa
    doc.setFillColor(...NEGRO);
    doc.rect(barraX + inicio * barraW, y, duracion * barraW, barraH, 'F');

    // Porcentaje de desembolso en rojo
    doc.setFont('courier', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...ROJO);
    doc.text(pct, barraX + (inicio + duracion / 2) * barraW, y + barraH + 3.5, { align: 'center' });

    y += 11;
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...GRIS);
  doc.text('Porcentajes referenciales de desembolso, se acuerdan con el comitente.', M, y);
  y += 9;

  // ── BLOQUE 05 OBSERVACIONES ───────────────────────────────────────────────
  const obsTexto = (document.getElementById('observaciones')?.value.trim()) || 'Sin observaciones adicionales.';
  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...GRIS);
  doc.text('05 \xB7 OBSERVACIONES', M, y);
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.4);
  doc.line(M, y + 2.5, 210 - M, y + 2.5);
  y += 8;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...NEGRO);
  const lineasObs = doc.splitTextToSize(obsTexto, ANCHO);
  doc.text(lineasObs, M, y);
  y += lineasObs.length * 5 + 6;

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = 275;
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.3);
  doc.line(M, footerY, 210 - M, footerY);

  // Aviso legal con borde-left rojo
  doc.setDrawColor(...ROJO);
  doc.setLineWidth(1.2);
  doc.line(M, footerY + 4, M, footerY + 13);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...GRIS);
  doc.text('Valores referenciales segun datos del IEC/CPI Cordoba.', M + 4, footerY + 7.5);
  doc.text('No constituyen presupuesto definitivo de obra.', M + 4, footerY + 12);

  // Firma
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.3);
  const firmaX = 210 - M - 55;
  doc.line(firmaX, footerY + 12, 210 - M, footerY + 12);
  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...GRIS);
  doc.text('FIRMA DEL PROFESIONAL', firmaX + 27.5, footerY + 15.5, { align: 'center' });
  doc.text('MATR\xCDCULA \xB7 COLEGIO DE ARQUITECTOS CBA', firmaX + 27.5, footerY + 19, { align: 'center' });

  const nombre = `presupuesto-${new Date().toISOString().substring(0, 10)}.pdf`;
  doc.save(nombre);
}

document.getElementById('btnExportarPDF').addEventListener('click', generarPDF);

// ===== Rotación de imagen arquitectónica (cada 12 horas) =====
async function iniciarRotacionImagenes() {
  const img       = document.getElementById('imagenArq');
  const capNombre = document.getElementById('captionNombre');
  const capArq    = document.getElementById('captionArq');
  const countdown = document.getElementById('imagenCountdown');

  if (!img) return;

  const INTERVALO_MS = 12 * 60 * 60 * 1000;
  const periodo      = Math.floor(Date.now() / INTERVALO_MS);

  let fotos = IMAGENES_ARQ;
  try {
    const resp = await fetch('/api/imagen-arquitectura');
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      fotos = data.map(f => ({
        url:       f.url,
        nombre:    f.nombre,
        arquitecto: f.fotografo,
        perfilUrl: f.perfilUrl,
      }));
    }
  } catch { /* usa imágenes hardcodeadas */ }

  const indice = periodo % fotos.length;
  const imagen = fotos[indice];

  img.src = imagen.url;
  if (capNombre) capNombre.textContent = imagen.nombre;
  if (capArq) {
    capArq.textContent = '';
    if (imagen.perfilUrl) {
      const a = document.createElement('a');
      a.href = imagen.perfilUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = imagen.arquitecto;
      capArq.appendChild(a);
    } else {
      capArq.textContent = imagen.arquitecto;
    }
  }

  function actualizarCountdown() {
    if (!countdown) return;
    const ahora         = Date.now();
    const proximoCambio = (periodo + 1) * INTERVALO_MS;
    const restante      = proximoCambio - ahora;
    const horas         = Math.floor(restante / (60 * 60 * 1000));
    const minutos       = Math.floor((restante % (60 * 60 * 1000)) / (60 * 1000));
    countdown.textContent = `↻ cambia en ${horas}h ${minutos}m`;
  }

  if (window._arqCountdownInterval) clearInterval(window._arqCountdownInterval);
  actualizarCountdown();
  window._arqCountdownInterval = setInterval(actualizarCountdown, 60 * 1000);
}

// ===== Drawer de noticias (mobile) =====
function iniciarDrawerNoticias() {
  const colNoticias   = document.getElementById('colNoticias');
  const btnDrawer     = document.getElementById('btnDrawerMobile');
  const drawerOverlay = document.getElementById('drawerOverlay');

  if (!colNoticias || !btnDrawer) return;

  let drawerAbierto = false;

  function abrirDrawer() {
    drawerAbierto = true;
    colNoticias.classList.add('drawer-open');
    btnDrawer.classList.add('activo');
    if (drawerOverlay) drawerOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function cerrarDrawer() {
    drawerAbierto = false;
    colNoticias.classList.remove('drawer-open');
    btnDrawer.classList.remove('activo');
    if (drawerOverlay) drawerOverlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  btnDrawer.addEventListener('click', () => {
    drawerAbierto ? cerrarDrawer() : abrirDrawer();
  });

  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', cerrarDrawer);
  }

  // Swipe desde el borde derecho para abrir, swipe a la derecha para cerrar
  let touchStartX = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const deltaX        = e.changedTouches[0].clientX - touchStartX;
    const desdeElBorde  = touchStartX > window.innerWidth - 32;

    if (desdeElBorde && deltaX < -30 && !drawerAbierto) {
      abrirDrawer();
    } else if (drawerAbierto && deltaX > 50) {
      cerrarDrawer();
    }
  }, { passive: true });
}

// ===== Control de carga desde hash/historial (no guardar en historial) =====
let cargandoDesdeHash = false;

// ===== Modo oscuro =====
function iniciarDarkMode() {
  const btn = document.getElementById('btnDarkMode');
  if (!btn) return;
  if (localStorage.getItem('pob-tema') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    _actualizarIconoDarkMode(true);
  }
  btn.addEventListener('click', () => {
    const oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
    if (oscuro) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('pob-tema', 'light');
      _actualizarIconoDarkMode(false);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('pob-tema', 'dark');
      _actualizarIconoDarkMode(true);
    }
  });
}

function _actualizarIconoDarkMode(oscuro) {
  const btn = document.getElementById('btnDarkMode');
  if (!btn) return;
  const icono = btn.querySelector('.btn-accion-icon');
  const texto = btn.querySelector('.btn-accion-texto');
  if (icono) icono.textContent = oscuro ? '☀' : '☾';
  if (texto) texto.textContent = oscuro ? 'Claro' : 'Oscuro';
}

// ===== Noticias desde RSS API =====
async function cargarNoticiasDesdeAPI() {
  try {
    const resp = await fetch('/api/noticias');
    const data = await resp.json();
    const items = Array.isArray(data) ? data : (data.items || []);
    if (items.length === 0) return;

    const colNoticias = document.getElementById('colNoticias');
    colNoticias.querySelectorAll('.noticia').forEach(el => el.remove());

    const TAGS = ['MERCADO', 'INDEC', 'TENDENCIA'];
    items.forEach((item, i) => {
      const art = document.createElement('article');
      art.className = 'noticia';
      if (item.link) {
        art.style.cursor = 'pointer';
        art.addEventListener('click', () => window.open(item.link, '_blank'));
      }
      art.innerHTML = `
        ${item.imagen ? `<img class="noticia-thumb" src="${item.imagen}" alt="${item.titulo}" onerror="this.style.display='none'" />` : ''}
        <div class="noticia-meta">
          <span class="noticia-fecha">${item.fecha || ''}</span>
          <span class="noticia-tag">${TAGS[i % TAGS.length]}</span>
        </div>
        <h3 class="noticia-titulo">${item.titulo}</h3>
        ${item.fuente ? `<p class="noticia-texto">${item.fuente}</p>` : ''}
      `;
      colNoticias.appendChild(art);
    });
  } catch { /* usa noticias hardcodeadas */ }
}

// ===== Conversión USD =====
async function cargarDolar() {
  try {
    const resp = await fetch('/api/dolar');
    const data = await resp.json();
    if (data.error || !resultadoActual) return;
    const partes = [];
    if (data.blue)    partes.push(`USD ${Math.round(resultadoActual.total / data.blue).toLocaleString('es-AR')} (blue)`);
    if (data.oficial) partes.push(`USD ${Math.round(resultadoActual.total / data.oficial).toLocaleString('es-AR')} (oficial)`);
    if (partes.length === 0) return;
    const el = document.getElementById('conversionUSD');
    if (el) { el.textContent = '≈ ' + partes.join(' / '); el.hidden = false; }
  } catch { /* silencioso */ }
}

// ===== Comparativa Steel Frame =====
async function toggleComparativa() {
  const comparativa = document.getElementById('comparativa');
  const btn = document.getElementById('btnComparar');
  if (!comparativa.hidden) {
    comparativa.hidden = true;
    btn.textContent = '⇄ Steel Frame';
    return;
  }
  const textoOrig = btn.textContent;
  btn.textContent = 'Cargando...';
  btn.disabled = true;
  try {
    const resp = await fetch('/api/precios-sf');
    const datosSF = await resp.json();
    const precioOrig = preciosActuales.precioM2Total;
    preciosActuales.precioM2Total = datosSF.precioM2Total;
    const resultSF = calcularPresupuesto(datosActuales);
    preciosActuales.precioM2Total = precioOrig;
    renderComparativa(resultadoActual, resultSF, datosSF);
    comparativa.hidden = false;
    btn.textContent = '✕ Cerrar comparativa';
  } catch {
    btn.textContent = textoOrig;
  } finally {
    btn.disabled = false;
  }
}

function renderComparativa(resTrad, resSF, datosSF) {
  const diff = ((resSF.total - resTrad.total) / resTrad.total * 100);
  const signo = diff >= 0 ? '+' : '';
  document.getElementById('comparativaGrid').innerHTML = `
    <div class="comp-col-header"></div>
    <div class="comp-col-header">TRADICIONAL</div>
    <div class="comp-col-header">STEEL FRAME${datosSF.esFallback ? ' *' : ''}</div>

    <div class="comp-fila-label">Total estimado</div>
    <div class="comp-fila-valor">${formatearPesos(resTrad.total)}</div>
    <div class="comp-fila-valor comp-sf">${formatearPesos(resSF.total)}</div>

    <div class="comp-fila-label">Precio m²</div>
    <div class="comp-fila-valor">${formatearPesos(resTrad.precioM2Aplicado)}</div>
    <div class="comp-fila-valor comp-sf">${formatearPesos(resSF.precioM2Aplicado)}</div>

    <div class="comp-fila-label">Diferencia</div>
    <div class="comp-fila-valor">—</div>
    <div class="comp-fila-valor comp-sf">${signo}${diff.toFixed(1)}%</div>

    <div class="comp-fila-label">Plazo aprox.</div>
    <div class="comp-fila-valor">10–12 meses</div>
    <div class="comp-fila-valor comp-sf">6–8 meses</div>

    ${datosSF.esFallback ? '<div class="comp-nota">* Precio estimado — PDF IEC Steel Frame no disponible en CPI Córdoba</div>' : ''}
  `;
}

// ===== Historial de consultas =====
const HISTORIAL_KEY = 'pob-historial';
const HISTORIAL_MAX = 10;

function cargarHistorial() {
  try { return JSON.parse(localStorage.getItem(HISTORIAL_KEY) || '[]'); } catch { return []; }
}

function guardarEnHistorial() {
  if (!datosActuales || !resultadoActual) return;
  const historial = cargarHistorial();
  historial.unshift({
    id: Date.now(),
    fecha: new Date().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    nombreProyecto: datosActuales.nombreProyecto || '',
    datos: { ...datosActuales },
    total: resultadoActual.total,
    mesReferencia: preciosActuales?.mesReferencia || '',
  });
  if (historial.length > HISTORIAL_MAX) historial.pop();
  localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial));
}

function mostrarPanelHistorial() {
  const historial = cargarHistorial();
  const lista = document.getElementById('historialLista');
  if (historial.length === 0) {
    lista.innerHTML = '<p class="historial-vacio">No hay consultas guardadas aún.</p>';
  } else {
    lista.innerHTML = historial.map((e, i) => `
      <div class="historial-item" data-index="${i}">
        <div class="historial-item-header">
          <span class="historial-nombre">${e.nombreProyecto || 'Sin nombre'}</span>
          <button class="historial-eliminar" data-id="${e.id}" title="Eliminar">×</button>
        </div>
        <div class="historial-item-datos">${e.datos.metros}m² · ${ETIQUETAS.tipoObra[e.datos.tipoObra]} · ${ETIQUETAS.terminaciones[e.datos.terminaciones]}</div>
        <div class="historial-item-total">${formatearPesos(e.total)}</div>
        <div class="historial-item-fecha">${e.fecha}</div>
      </div>
    `).join('');

    lista.querySelectorAll('.historial-item').forEach((el, i) => {
      el.addEventListener('click', ev => {
        if (!ev.target.classList.contains('historial-eliminar')) cargarDesdeHistorial(historial[i]);
      });
    });

    lista.querySelectorAll('.historial-eliminar').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        const id = parseInt(btn.dataset.id);
        const h = cargarHistorial().filter(e => e.id !== id);
        localStorage.setItem(HISTORIAL_KEY, JSON.stringify(h));
        mostrarPanelHistorial();
      });
    });
  }
  document.getElementById('historialPanel').hidden = false;
  document.getElementById('overlay').hidden = false;
}

function cargarDesdeHistorial(entrada) {
  const elNombreProyecto = document.getElementById('nombreProyecto');
  if (elNombreProyecto) elNombreProyecto.value = entrada.nombreProyecto || '';
  document.getElementById('metros').value = entrada.datos.metros;
  document.getElementById('tipoObra').value = entrada.datos.tipoObra;
  document.getElementById('plantas').value = entrada.datos.plantas;
  document.getElementById('ambientes').value = entrada.datos.ambientes || '';
  document.getElementById('banios').value = entrada.datos.banios;
  document.getElementById('cocinas').value = entrada.datos.cocinas;
  document.getElementById('terminaciones').value = entrada.datos.terminaciones;
  cerrarPanel();
  document.getElementById('seccionResultado').hidden = true;
  document.getElementById('seccionFormulario').hidden = false;
  cargandoDesdeHash = true;
  document.getElementById('formulario').dispatchEvent(new Event('submit'));
  cargandoDesdeHash = false;
}

// ===== Compartir URL (hash-based) =====
function generarHashURL() {
  if (!datosActuales) return window.location.href;
  const d = datosActuales;
  const p = new URLSearchParams({
    m2:    d.metros,
    tipo:  d.tipoObra,
    plantas: d.plantas,
    term:  d.terminaciones,
    banios: d.banios,
    cocinas: d.cocinas,
  });
  if (d.ambientes)      p.set('amb',    d.ambientes);
  if (d.nombreProyecto) p.set('nombre', d.nombreProyecto);
  return window.location.href.split('#')[0] + '#' + p.toString();
}

async function copiarURL() {
  const url = generarHashURL();
  const btn = document.getElementById('btnCompartir');
  const textoOrig = btn.textContent;
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = '✓ ¡COPIADO!';
  } catch {
    history.replaceState(null, '', url);
    btn.textContent = '✓ URL actualizada';
  }
  setTimeout(() => { btn.textContent = textoOrig; }, 2500);
}

function cargarDesdeHash() {
  if (!window.location.hash || window.location.hash.length < 5) return;
  const p = new URLSearchParams(window.location.hash.substring(1));
  if (!['m2', 'tipo', 'plantas', 'term', 'banios', 'cocinas'].every(c => p.get(c))) return;

  document.getElementById('metros').value        = p.get('m2');
  document.getElementById('tipoObra').value      = p.get('tipo');
  document.getElementById('plantas').value       = p.get('plantas');
  document.getElementById('terminaciones').value = p.get('term');
  document.getElementById('banios').value        = p.get('banios');
  document.getElementById('cocinas').value       = p.get('cocinas');
  if (p.get('amb')) document.getElementById('ambientes').value = p.get('amb');
  const elNombreProyecto = document.getElementById('nombreProyecto');
  if (elNombreProyecto && p.get('nombre')) elNombreProyecto.value = p.get('nombre');

  cargandoDesdeHash = true;
  document.getElementById('formulario').dispatchEvent(new Event('submit'));
  cargandoDesdeHash = false;
}

// ===== Presets rápidos de m² =====
document.getElementById('presetsRapidos').addEventListener('click', function (e) {
  const btn = e.target.closest('.btn-preset');
  if (!btn) return;

  document.getElementById('metros').value    = btn.dataset.m2;
  document.getElementById('ambientes').value = btn.dataset.amb;
  document.getElementById('banios').value    = btn.dataset.banios;
  document.getElementById('cocinas').value   = btn.dataset.cocinas;

  this.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('activo'));
  btn.classList.add('activo');
});

document.getElementById('metros').addEventListener('input', function () {
  document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('activo'));
});

// ===== Toggle Ver en USD =====
document.getElementById('toggleUSD').addEventListener('click', async function () {
  if (!resultadoActual) return;

  if (!dolarCache) {
    try {
      const resp = await fetch('/api/dolar');
      const data = await resp.json();
      if (!data.error && data.blue) dolarCache = data;
    } catch { /* sin datos */ }
  }

  if (!dolarCache?.blue) {
    this.textContent = 'Sin cotización';
    this.disabled = true;
    return;
  }

  usdActivo = !usdActivo;
  this.textContent = usdActivo ? 'Ver en ARS' : 'Ver en USD';
  this.classList.toggle('activo', usdActivo);

  const blue = dolarCache.blue;
  const fmt  = usdActivo
    ? v => 'U$D ' + Math.round(v / blue).toLocaleString('es-AR')
    : formatearPesos;

  document.getElementById('desgloseTramites').textContent      = fmt(resultadoActual.desglose.tramites);
  document.getElementById('desglosePreliminares').textContent  = fmt(resultadoActual.desglose.preliminares);
  document.getElementById('desgloseObraGruesa').textContent    = fmt(resultadoActual.desglose.obraGruesa);
  document.getElementById('desgloseManoDeObra').textContent    = fmt(resultadoActual.desglose.manoDeObra);
  document.getElementById('desgloseInstalaciones').textContent = fmt(resultadoActual.desglose.instalaciones);
  document.getElementById('desgloseTerminaciones').textContent = fmt(resultadoActual.desglose.terminaciones);
  document.getElementById('desgloseHonorarios').textContent    = fmt(resultadoActual.desglose.honorarios);
  document.getElementById('desgloseTotalFinal').textContent    = fmt(resultadoActual.total);
});

// ===== Botón Imprimir =====
document.getElementById('btnImprimir').addEventListener('click', () => window.print());

// ===== Animación del total =====
function animarContador(elemento, valorFinal, duracionMs) {
  const inicio = performance.now();
  function tick(ahora) {
    const t = Math.min((ahora - inicio) / duracionMs, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    elemento.textContent = formatearPesos(valorFinal * ease);
    if (t < 1) requestAnimationFrame(tick);
    else elemento.textContent = formatearPesos(valorFinal);
  }
  requestAnimationFrame(tick);
}

// ===== Logo del estudio =====
const LOGO_KEY = 'pob-logo-estudio';

function cargarLogoGuardado() {
  const b64 = localStorage.getItem(LOGO_KEY);
  const preview = document.getElementById('logoEstudioPreview');
  const btnElim = document.getElementById('btnLogoEliminar');
  if (b64) {
    preview.src = b64;
    preview.hidden = false;
    btnElim.hidden = false;
  } else {
    preview.hidden = true;
    btnElim.hidden = true;
  }
}

document.getElementById('btnLogoCargar').addEventListener('click', () => {
  document.getElementById('logoEstudioInput').click();
});

document.getElementById('logoEstudioInput').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  if (file.size > 500 * 1024) {
    alert('El archivo supera los 500kb. Elegí una imagen más pequeña.');
    this.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    localStorage.setItem(LOGO_KEY, e.target.result);
    cargarLogoGuardado();
  };
  reader.readAsDataURL(file);
  this.value = '';
});

document.getElementById('btnLogoEliminar').addEventListener('click', () => {
  localStorage.removeItem(LOGO_KEY);
  cargarLogoGuardado();
});

// ===== Event listeners para nuevos botones =====
document.getElementById('btnHistorial').addEventListener('click', mostrarPanelHistorial);
document.getElementById('btnCerrarHistorial').addEventListener('click', cerrarPanel);
document.getElementById('btnLimpiarHistorial').addEventListener('click', () => {
  localStorage.removeItem(HISTORIAL_KEY);
  mostrarPanelHistorial();
});
document.getElementById('btnComparar').addEventListener('click', toggleComparativa);
document.getElementById('btnCompartir').addEventListener('click', copiarURL);

// ===== Inicialización =====
cargarPrecios().then(cargarDesdeHash);
iniciarRotacionImagenes();
iniciarDrawerNoticias();
iniciarDarkMode();
cargarNoticiasDesdeAPI();
cargarLogoGuardado();
