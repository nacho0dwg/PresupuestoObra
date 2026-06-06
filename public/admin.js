const NOMBRES_MES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatearMes(mesStr) {
  const [anio, mes] = mesStr.split('-');
  return `${NOMBRES_MES[parseInt(mes)]} ${anio}`;
}

function formatearPesos(valor) {
  return '$ ' + valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mostrarMensaje(elId, texto, esError) {
  const el = document.getElementById(elId);
  el.textContent = texto;
  el.className = 'mensaje-accion ' + (esError ? 'mensaje-error' : 'mensaje-ok');
  el.hidden = false;
}

// ===== Tabla ICC =====

function renderTabla(historico) {
  const tbody = document.getElementById('cuerpoTabla');
  if (!historico || historico.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="tabla-vacia">Sin datos cargados</td></tr>';
    return;
  }
  // Más reciente primero
  const ordenado = [...historico].sort((a, b) => b.mes.localeCompare(a.mes));
  tbody.innerHTML = ordenado.map(({ mes, variacion }) => {
    const clase = variacion >= 0 ? 'variacion-pos' : 'variacion-neg';
    const signo = variacion >= 0 ? '+' : '';
    return `<tr>
      <td>${formatearMes(mes)}</td>
      <td class="${clase}">${signo}${variacion.toFixed(2).replace('.', ',')}%</td>
    </tr>`;
  }).join('');
}

async function cargarTabla() {
  try {
    const resp = await fetch('/api/icc');
    const historico = await resp.json();
    renderTabla(historico);
  } catch {
    document.getElementById('cuerpoTabla').innerHTML =
      '<tr><td colspan="2" class="tabla-vacia">Error al cargar datos</td></tr>';
  }
}

// ===== Precio actual =====

function renderPrecioActual(precios) {
  const el = document.getElementById('precioActual');
  if (!precios) { el.innerHTML = '<div class="tabla-vacia">Error al cargar</div>'; return; }

  const badge = precios.actualizadoConICC
    ? `<span class="badge badge-icc">ICC aplicado</span>`
    : `<span class="badge badge-sin-icc">Sin actualización ICC</span>`;

  const filaICC = precios.actualizadoConICC
    ? `<div class="precio-actual-fila">
         <span>ICC aplicado (${precios.iccFuente || ''})</span>
         <span>+${precios.variacionICC.toFixed(2).replace('.', ',')}% hasta ${precios.iccHastaElMes}</span>
       </div>`
    : '';

  el.innerHTML = `
    <div class="precio-actual-fila">
      <span>Mes de referencia (PDF)</span>
      <span>${precios.mesReferencia} ${badge}</span>
    </div>
    <div class="precio-actual-fila">
      <span>Precio m² base (PDF)</span>
      <span>${formatearPesos(precios.precioM2TotalOriginal || precios.precioM2Total)}</span>
    </div>
    ${filaICC}
    <div class="precio-actual-fila">
      <span>Precio m² vigente</span>
      <span>${formatearPesos(precios.precioM2Total)}</span>
    </div>
  `;
}

async function cargarPrecioActual() {
  try {
    const resp = await fetch('/api/precios');
    const precios = await resp.json();
    renderPrecioActual(precios);
  } catch {
    renderPrecioActual(null);
  }
}

// ===== Formulario: agregar ICC =====

document.getElementById('formICC').addEventListener('submit', async function (e) {
  e.preventDefault();
  const errorEl = document.getElementById('errorForm');
  const mensajeEl = 'mensajeForm';
  errorEl.hidden = true;
  document.getElementById(mensajeEl).hidden = true;

  const mm   = document.getElementById('selMes').value;
  const anio = document.getElementById('selAnio').value;
  const varVal = document.getElementById('inputVariacion').value.trim();

  if (!varVal) {
    errorEl.textContent = 'Ingresá la variación porcentual.';
    errorEl.hidden = false;
    return;
  }

  const mes = `${anio}-${mm}`;
  const variacion = parseFloat(varVal);

  const btn = this.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    const resp = await fetch('/api/icc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, variacion }),
    });
    const resultado = await resp.json();

    if (!resp.ok) throw new Error(resultado.error || 'Error desconocido');

    renderTabla(resultado.historico);
    document.getElementById('inputVariacion').value = '';
    mostrarMensaje(mensajeEl, `${formatearMes(mes)}: ${variacion >= 0 ? '+' : ''}${variacion}% guardado correctamente.`, false);
  } catch (err) {
    mostrarMensaje(mensajeEl, `Error: ${err.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Agregar';
  }
});

// ===== Botón recalcular =====

document.getElementById('btnRecalcular').addEventListener('click', async function () {
  this.disabled = true;
  this.textContent = 'Recalculando…';
  document.getElementById('mensajeRecalcular').hidden = true;

  try {
    const resp = await fetch('/api/actualizar', { method: 'POST' });
    const resultado = await resp.json();

    if (resultado.datos) renderPrecioActual(resultado.datos);
    mostrarMensaje('mensajeRecalcular', resultado.mensaje || 'Recálculo completado.', !resultado.exito);
  } catch (err) {
    mostrarMensaje('mensajeRecalcular', `Error: ${err.message}`, true);
  } finally {
    this.disabled = false;
    this.textContent = 'Recalcular precio';
  }
});

// ===== Selector de años =====

function poblarSelectorAnios() {
  const sel = document.getElementById('selAnio');
  const anioActual = new Date().getFullYear();
  for (let a = anioActual - 1; a <= anioActual + 1; a++) {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    if (a === anioActual) opt.selected = true;
    sel.appendChild(opt);
  }
}

// ===== Inicialización =====
poblarSelectorAnios();
cargarTabla();
cargarPrecioActual();
