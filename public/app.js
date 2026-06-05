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
    const etiquetaFuente = p.iccFuente === 'PDF' ? ' (estimado desde PDF)' : '';
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
    banios:        parseInt(document.getElementById('banios').value) || 1,
    cocinas:       parseInt(document.getElementById('cocinas').value) || 1,
    terminaciones: document.getElementById('terminaciones').value,
  };

  const resultado = calcularPresupuesto(datos);
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

// ===== Inicialización =====
cargarPrecios();
