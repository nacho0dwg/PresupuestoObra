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

// ===== Exportar a PDF — layout rediseñado =====
async function generarPDF() {
  if (!datosActuales || !resultadoActual) return;

  const { jsPDF } = window.jspdf;

  // ── 1. Logo: cargar dimensiones reales antes de crear el doc ─────────────
  const logoB64 = localStorage.getItem(LOGO_KEY);
  let logoInfo  = null;

  if (logoB64) {
    logoInfo = await new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 28, MAX_H = 14;
        const ratio = img.naturalWidth / img.naturalHeight;
        let w, h;
        if (ratio > 2)        { w = MAX_W; h = MAX_W / ratio; }
        else if (ratio < 0.5) { h = MAX_H; w = MAX_H * ratio; }
        else if (MAX_W / ratio <= MAX_H) { w = MAX_W; h = MAX_W / ratio; }
        else                  { h = MAX_H; w = MAX_H * ratio; }
        const fmt = logoB64.includes('data:image/png') ? 'PNG' : 'JPEG';
        resolve({ data: logoB64, fmt, w, h });
      };
      img.onerror = () => resolve(null);
      img.src = logoB64;
    });
  }

  // ── 2. Constantes ─────────────────────────────────────────────────────────
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 18;
  const W = 174; // 210 - 2×18

  // Colores pre-mezclados sobre BG [247,246,242] para simular opacidades
  const BG   = [247, 246, 242];
  const BLK  = [26, 26, 26];
  const RED  = [192, 57, 43];
  const BLKF = [240, 238, 233]; // fondo de bloque (ligeramente más oscuro que BG)
  const WM   = [227, 226, 223]; // opacidad 0.08 — marca de agua
  const BRD  = [217, 216, 213]; // opacidad 0.12 — borde de bloque
  const DIV  = [198, 197, 194]; // opacidad 0.20 — líneas divisorias
  const G28  = [178, 177, 174]; // opacidad 0.28 — escala de meses
  const G30  = [173, 172, 169]; // opacidad 0.30 — línea firma, nota italic
  const G38  = [153, 152, 150]; // opacidad 0.38 — labels de sección, fecha
  const G40  = [148, 148, 145]; // opacidad 0.40 — subtítulo, footer
  const G45  = [136, 135, 133]; // opacidad 0.45 — labels de fila
  const G55  = [111, 111, 109]; // opacidad 0.55 — texto observaciones
  const G60  = [99, 98, 97];    // opacidad 0.60 — labels desglose
  const SEP  = [230, 229, 225]; // opacidad 0.07 — separadores de fila

  // Geometría
  const P   = 4;  // padding interno de bloque
  const GAP = 3;  // separación entre bloques

  // Columnas sección central
  const CL_W = 58;
  const CL_X = M;
  const CR_X = M + CL_W + 2;
  const CR_W = W - CL_W - 2; // 114mm

  // Alturas bloque parámetros
  const SEC_H  = 5;   // label de sección + gap
  const PROW_H = 8.5; // altura por fila de parámetro
  const PARAMS_H = P + SEC_H + 7 * PROW_H + P; // 4+5+59.5+4 = 72.5mm

  // Gantt (debe tener exactamente PARAMS_H)
  const GM_H  = 5;   // escala de meses
  const GL_H  = 5;   // leyenda
  const GN_H  = 4;   // nota
  const GN    = 5;   // filas de etapa
  const GROW_H = (PARAMS_H - P - SEC_H - GM_H - GL_H - GN_H - P) / GN; // 9.1mm

  // Barra gantt: columna de label 24mm + área de barra
  const GLBL_W = 24;
  const GBAR_X = CR_X + P + GLBL_W + 1;
  const GBAR_W = CR_W - P - GLBL_W - 1 - P; // 81mm

  // Fecha
  const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const hoy       = new Date();
  const fechaTxt  = `Generado el ${hoy.getDate()} de ${MESES_ES[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  // Helper: rect de bloque con borde
  const blkRect = (bx, by, bw, bh) => {
    doc.setFillColor(...BLKF);
    doc.setDrawColor(...BRD);
    doc.setLineWidth(0.3);
    doc.rect(bx, by, bw, bh, 'FD');
  };

  // ── 3. Fondo ──────────────────────────────────────────────────────────────
  doc.setFillColor(...BG);
  doc.rect(0, 0, 210, 297, 'F');

  // ── 4. Marca de agua — grilla de cruces ───────────────────────────────────
  doc.setDrawColor(...WM);
  doc.setLineWidth(0.2);
  const WS = 8, WA = 1.5;
  for (let px = 0; px <= 210; px += WS)
    for (let py = 0; py <= 297; py += WS) {
      doc.line(px, py - WA, px, py + WA);
      doc.line(px - WA, py, px + WA, py);
    }

  // ── 5. Header ─────────────────────────────────────────────────────────────
  const HY = M; // y = 18

  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BLK);
  doc.text('PRESUPUESTO\xB7OBRA', M, HY + 5);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...G40);
  doc.text('C\xD3RDOBA \xB7 ARG', M, HY + 9.5);

  doc.setFontSize(6);
  doc.setTextColor(...G38);
  doc.text(fechaTxt, M, HY + 13.5);

  // Logo (derecha del header)
  const LBX = 210 - M - 28; // logo box x
  const LBY = HY;           // logo box y
  if (logoInfo) {
    const lx = 210 - M - logoInfo.w;
    const ly = HY + (14 - logoInfo.h) / 2;
    try { doc.addImage(logoInfo.data, logoInfo.fmt, lx, ly, logoInfo.w, logoInfo.h); } catch { /* skip */ }
  } else {
    doc.setDrawColor(...DIV);
    doc.setLineWidth(0.3);
    doc.rect(LBX, LBY, 28, 14);
    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...G38);
    doc.text('LOGO', LBX + 14, LBY + 8, { align: 'center' });
  }

  // Línea divisoria header
  const DIV1Y = HY + 18;
  doc.setDrawColor(...DIV);
  doc.setLineWidth(0.3);
  doc.line(M, DIV1Y, 210 - M, DIV1Y);

  // ── 6. Nombre del proyecto ────────────────────────────────────────────────
  let y = DIV1Y + 5;

  const nomProyecto = (datosActuales.nombreProyecto?.toUpperCase()) || 'PRESUPUESTO DE OBRA';
  doc.setFont('courier', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BLK);
  doc.text(nomProyecto, M, y + 7);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...G40);
  doc.text('PROYECTO \xB7 C\xD3RDOBA, ARGENTINA', M, y + 13);

  y += 17; // nombre (13mm) + gap 4mm

  // ── 7. Sección central — dos columnas ─────────────────────────────────────
  const d  = datosActuales;
  const r  = resultadoActual;
  const CY = y; // top de la sección central

  // ── Columna izquierda: PARÁMETROS ─────────────────────────────────────────
  blkRect(CL_X, CY, CL_W, PARAMS_H);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...G38);
  doc.text('01 — PAR\xC1METROS', CL_X + P, CY + P + 2.5);

  const params = [
    ['SUPERFICIE',    `${d.metros} m\xB2`],
    ['TIPO DE OBRA',  ETIQUETAS.tipoObra[d.tipoObra]],
    ['PLANTAS',       ETIQUETAS.plantas[d.plantas]],
    ['AMBIENTES',     d.ambientes ? String(d.ambientes) : '—'],
    ['BA\xD1OS',      String(d.banios)],
    ['COCINAS',       String(d.cocinas)],
    ['TERMINACIONES', ETIQUETAS.terminaciones[d.terminaciones]],
  ];

  let pY = CY + P + SEC_H;
  for (const [label, valor] of params) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...G45);
    doc.text(label, CL_X + P, pY + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BLK);
    doc.text(valor, CL_X + P, pY + 6.5);

    doc.setDrawColor(...SEP);
    doc.setLineWidth(0.2);
    doc.line(CL_X + P, pY + PROW_H - 0.5, CL_X + CL_W - P, pY + PROW_H - 0.5);

    pY += PROW_H;
  }

  // ── Columna derecha: GANTT ────────────────────────────────────────────────
  blkRect(CR_X, CY, CR_W, PARAMS_H);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...G38);
  doc.text('PLAN DE OBRA \xB7 10 MESES', CR_X + P, CY + P + 2.5);

  // Escala M1–M10
  const MSY = CY + P + SEC_H + 3.5;
  doc.setFont('courier', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...G28);
  for (let i = 1; i <= 10; i++) {
    const mx = GBAR_X + ((i - 1) / 9) * GBAR_W;
    const align = i === 1 ? 'left' : i === 10 ? 'right' : 'center';
    doc.text(`M${i}`, mx, MSY, { align });
  }

  // Filas de etapa
  const etapas = [
    { label: 'TR\xC1MITES',   pct: '25%', s: 0.00, e: 0.20 },
    { label: 'FUNDACIONES',   pct: '30%', s: 0.10, e: 0.30 },
    { label: 'ESTRUCTURA',    pct: '20%', s: 0.20, e: 0.60 },
    { label: 'INSTALACIONES', pct: '15%', s: 0.40, e: 0.70 },
    { label: 'TERMINACIONES', pct: '10%', s: 0.60, e: 1.00 },
  ];

  let gY = CY + P + SEC_H + GM_H;
  const BAR_H = 2.5;

  for (const et of etapas) {
    const barY  = gY + GROW_H * 0.42;
    const barCY = barY + BAR_H / 2;

    // Fondo barra gris
    doc.setFillColor(...SEP);
    doc.rect(GBAR_X, barY, GBAR_W, BAR_H, 'F');

    // Barra negra (duración de etapa)
    doc.setFillColor(...BLK);
    doc.rect(GBAR_X + et.s * GBAR_W, barY, (et.e - et.s) * GBAR_W, BAR_H, 'F');

    // Marcador de desembolso (centrado en inicio de etapa)
    const mW = 1.8, mH = 4;
    const mX = GBAR_X + et.s * GBAR_W - mW / 2;
    const mY = barCY - mH / 2;
    doc.setFillColor(...RED);
    doc.rect(mX, mY, mW, mH, 'F');

    // Porcentaje en rojo encima del marcador
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...RED);
    doc.text(et.pct, mX + mW / 2, mY - 0.8, { align: 'center' });

    // Label de etapa alineado verticalmente con la barra
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...BLK);
    doc.text(et.label, CR_X + P, barCY + 1.5);

    gY += GROW_H;
  }

  // Leyenda
  const legY = CY + P + SEC_H + GM_H + GN * GROW_H + 1;
  doc.setFillColor(...BLK);
  doc.rect(CR_X + P, legY, 3, 1, 'F');
  doc.setFont('courier', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...BLK);
  doc.text('Etapa', CR_X + P + 4, legY + 1);

  doc.setFillColor(...RED);
  doc.rect(CR_X + P + 17, legY - 0.5, 2, 2, 'F');
  doc.setTextColor(...G40);
  doc.text('Desembolso estimado \xB7 referenciales', CR_X + P + 20.5, legY + 1);

  // Nota italic
  doc.setFont('courier', 'italic');
  doc.setFontSize(5);
  doc.setTextColor(...G30);
  doc.text('Porcentajes referenciales, se acuerdan con el comitente', CR_X + P, legY + GL_H - 0.5);

  y = CY + PARAMS_H;

  // ── 8. Bloque total ───────────────────────────────────────────────────────
  y += GAP;
  const TOT_H = 28;
  blkRect(M, y, W, TOT_H);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...G38);
  doc.text('02 — TOTAL ESTIMADO', M + P, y + P + 2.5);

  // Izquierda: label + monto grande
  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...G45);
  doc.text('TOTAL ESTIMADO', M + P, y + P + 7);

  doc.setFont('courier', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...RED);
  doc.text(formatearPesos(r.total), M + P, y + P + 16);

  if (dolarCache?.blue) {
    const usdBlue = Math.round(r.total / dolarCache.blue);
    let usdTxt = `≈ USD ${usdBlue.toLocaleString('es-AR')} (blue)`;
    if (dolarCache.oficial) {
      usdTxt += ` / USD ${Math.round(r.total / dolarCache.oficial).toLocaleString('es-AR')} (oficial)`;
    }
    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...G45);
    doc.text(usdTxt, M + P, y + P + 21);
  }

  // Derecha: precio m² aplicado
  const mesRef   = preciosActuales?.mesReferencia || '';
  const baseLbl  = mesRef ? `Base ${mesRef} \xB7 actualizado con ICC` : 'Actualizado con ICC';

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...G38);
  doc.text('PRECIO M\xB2 APLICADO', M + W - P, y + P + 7, { align: 'right' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...BLK);
  doc.text(formatearPesos(r.precioM2Aplicado), M + W - P, y + P + 16, { align: 'right' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...G38);
  doc.text(baseLbl, M + W - P, y + P + 21, { align: 'right' });

  y += TOT_H;

  // ── 9. Bloque desglose ────────────────────────────────────────────────────
  y += GAP;
  const CROW_H = 5;
  const DESG_H = P + SEC_H + 7 * CROW_H + 2 + 8 + P;
  blkRect(M, y, W, DESG_H);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...G38);
  doc.text('03 — DESGLOSE POR CATEGOR\xCDA', M + P, y + P + 2.5);

  const categorias = [
    ['Trámites y gestiones previas',              r.desglose.tramites],
    ['Trabajos preliminares',                     r.desglose.preliminares],
    ['Estructura y obra gruesa',                  r.desglose.obraGruesa],
    ['Mano de obra total',                        r.desglose.manoDeObra],
    ['Instalaciones (sanitaria, eléctrica, gas)', r.desglose.instalaciones],
    ['Terminaciones',                             r.desglose.terminaciones],
    ['Honorarios profesionales',                  r.desglose.honorarios],
  ];

  let cY = y + P + SEC_H;
  for (const [label, monto] of categorias) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...G60);
    doc.text(label, M + P, cY + 3.5);

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BLK);
    doc.text(formatearPesos(monto), M + W - P, cY + 3.5, { align: 'right' });

    doc.setDrawColor(...SEP);
    doc.setLineWidth(0.2);
    doc.line(M + P, cY + CROW_H - 0.3, M + W - P, cY + CROW_H - 0.3);

    cY += CROW_H;
  }

  // Fila total
  cY += 2;
  doc.setDrawColor(...BLK);
  doc.setLineWidth(0.5);
  doc.line(M + P, cY, M + W - P, cY);
  cY += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BLK);
  doc.text('TOTAL', M + P, cY);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...RED);
  doc.text(formatearPesos(r.total), M + W - P, cY, { align: 'right' });

  y += DESG_H;

  // ── 10. Bloque observaciones + firma ──────────────────────────────────────
  y += GAP;
  const OBS_H = 35;
  blkRect(M, y, W, OBS_H);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...G38);
  doc.text('04 — OBSERVACIONES', M + P, y + P + 2.5);

  const obsTexto = document.getElementById('observaciones')?.value?.trim() || '';
  if (obsTexto) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...G55);
    const lineas = doc.splitTextToSize(obsTexto, W - P * 2);
    doc.text(lineas, M + P, y + P + SEC_H + 2);
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...G30);
    doc.text('Sin observaciones adicionales.', M + P, y + P + SEC_H + 2);
  }

  // Firma (mitad inferior, alineada a la derecha)
  const sigX = M + W - P - 55;
  const sigY = y + OBS_H - P - 10;
  doc.setDrawColor(...G30);
  doc.setLineWidth(0.3);
  doc.line(sigX, sigY, M + W - P, sigY);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...G40);
  doc.text('FIRMA DEL PROFESIONAL', sigX + 27.5, sigY + 4, { align: 'center' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...G28);
  doc.text('MATR\xCDCULA \xB7 COLEGIO DE ARQUITECTOS CBA', sigX + 27.5, sigY + 7.5, { align: 'center' });

  y += OBS_H;

  // ── 11. Línea divisoria ───────────────────────────────────────────────────
  y += 2;
  doc.setDrawColor(...DIV);
  doc.setLineWidth(0.3);
  doc.line(M, y, 210 - M, y);

  y += 4;

  // ── 12. Footer ────────────────────────────────────────────────────────────
  // Línea vertical roja (0.8pt, 8pt de alto ≈ 2.83mm)
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.8);
  doc.line(M, y, M, y + 2.83);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...G40);
  doc.text(
    'Valores referenciales seg\xFAn IEC / CPI C\xF3rdoba. No constituyen presupuesto definitivo. Honorarios al 5% \xB7 acordados con el comitente.',
    M + 3, y + 2,
  );

  doc.save(`presupuesto-${new Date().toISOString().substring(0, 10)}.pdf`);
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
