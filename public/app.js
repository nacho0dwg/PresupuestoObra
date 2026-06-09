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

  // Nombre del proyecto
  const elNombre = document.getElementById('resultadoNombre');
  if (elNombre) {
    const nombre = datosActuales?.nombreProyecto;
    if (nombre) { elNombre.textContent = nombre.toUpperCase(); elNombre.hidden = false; }
    else elNombre.hidden = true;
  }

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

// ===== Exportar a PDF — estética arquitectónica =====
function generarPDF() {
  if (!datosActuales || !resultadoActual) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const M     = 18;
  const ANCHO = 210 - M * 2;

  // Paleta
  const FONDO = [247, 246, 242];
  const NEGRO = [26, 26, 26];
  const ROJO  = [192, 57, 43];
  const GRIS  = [130, 128, 120];
  const BORDE = [205, 203, 197];

  const fechaHoy = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // Fondo crema
  doc.setFillColor(...FONDO);
  doc.rect(0, 0, 210, 297, 'F');

  // Marca de agua: grilla de cruces
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.18);
  const PASO = 10;
  const TAM  = 1.8;
  for (let px = 5; px < 210; px += PASO) {
    for (let py = 5; py < 297; py += PASO) {
      doc.line(px, py - TAM, px, py + TAM);
      doc.line(px - TAM, py, px + TAM, py);
    }
  }

  // ── HEADER ──
  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...NEGRO);
  doc.text('PRESUPUESTO\xB7OBRA', M, 14);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...GRIS);
  doc.text('C\xD3RDOBA \xB7 ARG', M, 20);
  doc.text(`Generado el ${fechaHoy}`, 210 - M, 20, { align: 'right' });

  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.3);
  doc.line(M, 24, 210 - M, 24);

  let y = 35;

  // ── 01 PARÁMETROS ──
  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...GRIS);
  doc.text('01', M, y);
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...NEGRO);
  doc.text('PAR\xC1METROS DE LA OBRA', M + 6, y);
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.3);
  doc.line(M, y + 2.5, 210 - M, y + 2.5);
  y += 9;

  const d = datosActuales;
  const params = [
    ['SUPERFICIE',     `${d.metros} m\xB2`],
    ['TIPO DE OBRA',   ETIQUETAS.tipoObra[d.tipoObra]],
    ['PLANTAS',        ETIQUETAS.plantas[d.plantas]],
    ['AMBIENTES',      d.ambientes ? String(d.ambientes) : 'No especificado'],
    ['BA\xD1OS',       String(d.banios)],
    ['COCINAS',        String(d.cocinas)],
    ['TERMINACIONES',  ETIQUETAS.terminaciones[d.terminaciones]],
  ];

  for (const [label, valor] of params) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS);
    doc.text(label, M, y);
    doc.setTextColor(...NEGRO);
    doc.text(valor, M + 52, y);
    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.15);
    doc.line(M, y + 2.2, 210 - M, y + 2.2);
    y += 7;
  }

  y += 5;

  // ── TOTAL DESTACADO ──
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.3);
  doc.line(M, y, 210 - M, y);
  y += 6;

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...GRIS);
  doc.text('TOTAL ESTIMADO', M, y);
  y += 8;

  doc.setFont('courier', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...ROJO);
  doc.text(formatearPesos(resultadoActual.total), M, y);
  y += 6;

  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.3);
  doc.line(M, y, 210 - M, y);
  y += 11;

  // ── 02 DESGLOSE ──
  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...GRIS);
  doc.text('02', M, y);
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...NEGRO);
  doc.text('DESGLOSE POR CATEGOR\xCDA', M + 6, y);
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.3);
  doc.line(M, y + 2.5, 210 - M, y + 2.5);
  y += 9;

  const categorias = [
    ['Tramites y gestiones previas',               resultadoActual.desglose.tramites],
    ['Trabajos preliminares',                      resultadoActual.desglose.preliminares],
    ['Estructura y obra gruesa (materiales)',       resultadoActual.desglose.obraGruesa],
    ['Mano de obra total',                         resultadoActual.desglose.manoDeObra],
    ['Instalaciones (sanitaria, electrica, gas)',  resultadoActual.desglose.instalaciones],
    ['Terminaciones',                              resultadoActual.desglose.terminaciones],
    ['Honorarios profesionales',                   resultadoActual.desglose.honorarios],
  ];

  for (const [label, monto] of categorias) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...NEGRO);
    doc.text(label, M, y);
    doc.setFont('courier', 'bold');
    doc.text(formatearPesos(monto), 210 - M, y, { align: 'right' });
    y += 5.5;
    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.15);
    doc.line(M, y - 1, 210 - M, y - 1);
  }

  // Fila total del desglose
  y += 3;
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NEGRO);
  doc.text('TOTAL', M, y);
  doc.setTextColor(...ROJO);
  doc.text(formatearPesos(resultadoActual.total), 210 - M, y, { align: 'right' });
  doc.setDrawColor(...ROJO);
  doc.setLineWidth(0.5);
  doc.line(M, y + 2.5, 210 - M, y + 2.5);
  y += 12;

  // ── FUENTE DE PRECIOS ──
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
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
  y += 11;

  // ── AVISO LEGAL ──
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(1);
  doc.line(M, y, M, y + 11);
  doc.setLineWidth(0.3);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRIS);
  doc.text('Valores referenciales segun datos del IEC/CPI Cordoba.', M + 4, y + 4);
  doc.text('No constituyen presupuesto definitivo de obra.', M + 4, y + 9.5);

  // ── PIE ──
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.3);
  doc.line(0, 284, 210, 284);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...GRIS);
  doc.text('PRESUPUESTO\xB7OBRA — C\xF3rdoba, Argentina', M, 290);
  doc.text(fechaHoy, 210 - M, 290, { align: 'right' });

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
