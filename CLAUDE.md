# PresupuestoObra — Calculadora de Costos de Construcción

## Descripción del proyecto

App web que calcula presupuestos referenciales de construcción y refacción para Córdoba, Argentina.
Toma como base el precio por m2 publicado mensualmente por el IEC (Colegio de Arquitectos de Córdoba),
lo actualiza automáticamente con el ICC (Índice del Costo de la Construcción) del INDEC, y calcula
el presupuesto total según los parámetros ingresados por el usuario.

Será usada por un equipo de profesionales de la construcción desde PC y celular.

---

## Stack tecnológico

- **Frontend:** HTML + CSS + JavaScript vanilla (sin frameworks, máxima compatibilidad)
- **Backend:** Node.js con Express (servidor simple para llamadas a APIs externas)
- **Despliegue:** Local por ahora (localhost). Pensar en que sea fácil de subir a Vercel o Railway después.
- **PDF parsing:** pdf-parse (para extraer texto del PDF del IEC)
- **HTTP requests:** axios o node-fetch

---

## Lógica de actualización de precios

### Fuente principal: PDF del IEC via CPI Córdoba

El CPI publica mensualmente los PDFs del IEC en:
`https://cpicordoba.org.ar`

Las URLs siguen el patrón:
`https://cpicordoba.org.ar/wp-content/uploads/YYYY/MM/YYYY.MM-NOMBREMES-COSTO-POR-M2-REFERENCIAL-VIVIENDA-130M2-TRADICIONAL.pdf`

Ejemplo febrero 2026:
`https://cpicordoba.org.ar/wp-content/uploads/2026/03/2026.02-FEBRERO-COSTO-POR-M2-REFERENCIAL-VIVIENDA-130M2-TRADICIONAL.pdf`

**Lógica de descarga:**
1. El día 12 de cada mes, intentar descargar el PDF del mes actual
2. Si no existe, usar el del mes anterior
3. Del PDF extraer dos valores clave:
   - `precioM2Basico` → "PRECIO POR M2 BÁSICO (INCLUYE MONTO DE OBRA + HONORARIOS)"
   - `precioM2Total` → "PRECIO POR M2 (INCLUYE MONTO DE OBRA + HONORARIOS + CARGAS SOCIALES E IMPUESTOS)"
4. Guardar localmente estos valores junto con el mes/año de referencia

### Fuente secundaria: ICC del INDEC

Cuando el PDF tiene más de un mes de antigüedad, actualizar el precio usando el ICC:
- URL pública del INDEC: `https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31`
- O bien su API de series: `https://apis.indec.gob.ar/series/api/series/?ids=11.3_ICC_0_0_26&start_date=2024-01`
- Usar la variación % mensual para proyectar el precio al mes actual

**Fórmula:**
```
precioActualizado = precioUltimoPDF * (1 + variacionICC/100)^mesesTranscurridos
```

---

## Parámetros de la calculadora

### Inputs del usuario

| Parámetro | Tipo | Opciones |
|---|---|---|
| Metros cuadrados totales | Número | Libre |
| Tipo de obra | Selector | Construcción nueva / Refacción parcial / Refacción total |
| Cantidad de plantas | Selector | 1 / 2 / 3 o más |
| Cantidad de ambientes | Número | 1 a 10+ |
| Cantidad de baños | Número | 1 a 5+ |
| Cantidad de cocinas | Número | 1 a 3 |
| Calidad de terminaciones | Selector | Económica / Estándar / Premium / Lujo |

### Multiplicadores

**Terminaciones:**
- Económica: 0.80x
- Estándar: 1.00x (base)
- Premium: 1.35x
- Lujo: 1.70x

**Tipo de obra:**
- Construcción nueva: 1.00x
- Refacción parcial: 0.45x
- Refacción total: 0.80x

**Plantas adicionales** (sobre precio base):
- 1 planta: 1.00x
- 2 plantas: 1.05x (escaleras, estructura adicional)
- 3+ plantas: 1.10x

**Instalaciones** (se suma al total base):
- Por cada baño adicional al primero: +2.5% del total
- Por cada cocina: +1.5% del total

### Fórmula de cálculo

```
precioBase = m2 * precioM2Actualizado
ajustePlantas = precioBase * multiplicadorPlantas
ajusteTerminaciones = ajustePlantas * multiplicadorTerminaciones
ajusteTipoObra = ajusteTerminaciones * multiplicadorTipoObra
ajusteInstalaciones = precioBase * (baños * 0.025 + cocinas * 0.015)
TOTAL = ajusteTipoObra + ajusteInstalaciones
```

---

## Pantallas / Vistas

### 1. Pantalla principal — Calculadora
- Formulario con todos los parámetros
- Botón "Calcular presupuesto"
- Resultado visible en la misma pantalla (scroll down)

### 2. Resultado del cálculo
- Presupuesto total estimado (en $ ARS)
- Precio por m2 aplicado
- Fuente y fecha del dato base ("Basado en datos IEC - Marzo 2026, actualizado con ICC INDEC")
- Desglose por categorías:
  - Estructura y obra gruesa
  - Instalaciones (sanitaria, eléctrica, gas)
  - Terminaciones
  - Honorarios profesionales
- Aclaración legal: "Los valores son referenciales según datos del IEC/CAPC Córdoba"
- Botón "Nueva consulta"
- Botón "Exportar a PDF" (genera un PDF con el resumen)

### 3. Panel de estado (accesible desde ícono de info)
- Último PDF descargado: mes/año
- Precio m2 básico actual
- Precio m2 total actual
- Última actualización con ICC
- Botón "Forzar actualización"

---

## Estructura de archivos

```
presupuesto-obra/
├── server.js              # Servidor Express
├── package.json
├── public/
│   ├── index.html         # App principal
│   ├── style.css
│   └── app.js             # Lógica frontend
├── src/
│   ├── pdfFetcher.js      # Descarga y parsea PDF del IEC
│   ├── indecFetcher.js    # Obtiene ICC del INDEC
│   ├── calculator.js      # Lógica de cálculo
│   └── dataStore.js       # Guarda/lee datos locales (JSON)
└── data/
    └── precios.json       # Caché local de precios
```

---

## Convenciones

- Todo el texto de la UI en español argentino
- Números con formato argentino: puntos para miles, coma para decimales (ej: $1.395.573,89)
- Comentarios en el código en español
- Manejo de errores en todas las llamadas externas con mensajes claros al usuario
- Si falla la actualización automática, usar los últimos datos guardados y avisar al usuario

---

## Fases de desarrollo

### Fase 1 — MVP funcional
- [ ] Setup del proyecto (Express + HTML/CSS/JS)
- [ ] Formulario de calculadora con todos los parámetros
- [ ] Lógica de cálculo con precios hardcodeados (Marzo 2026: básico $1.395.573,89 / total $1.744.394,49)
- [ ] Vista de resultado con desglose
- [ ] Diseño responsive (funciona en celular y PC)

### Fase 2 — Datos reales
- [ ] Descarga automática del PDF del IEC desde CPI Córdoba
- [ ] Parsing del PDF para extraer precios
- [ ] Integración con ICC del INDEC para actualización mensual
- [ ] Panel de estado con info de última actualización

### Fase 3 — Extras
- [ ] Exportar resultado a PDF
- [ ] Historial de consultas guardado localmente
- [ ] Comparar construcción tradicional vs steel frame

---

## Notas importantes para Claude Code

- El desarrollador NO tiene experiencia en programación.
- Priorizar que funcione sobre que sea perfecto.
- El servidor Express es solo para llamadas a APIs externas (CORS issues). Todo lo posible hacerlo en el frontend.
- Los precios del PDF pueden tener formato con puntos y comas argentinos — normalizar antes de parsear.
- La API del INDEC puede estar caída o cambiar — siempre tener fallback con los datos del caché local.
- Arrancar siempre con la Fase 1 primero y que funcione bien antes de pasar a Fase 2.
