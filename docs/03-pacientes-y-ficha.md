# 03 — Pacientes y ficha clínica

Alta/edición de pacientes, evaluación clínica, sesiones/deuda, PDF e impresión.

---

## El formulario de alta (modal-paciente)

Reorganizado en **4 secciones** (pedido del usuario: lo llena la secretaría primero):

1. **Datos del paciente** — nombre, **DNI**, tel, email, edad, deporte.
2. **Cobertura y pago** — tipo de cobertura (particular / obra social), OS,
   **Sesiones** y **Total a pagar** (ver más abajo).
3. **Ficha clínica** — servicio, profesional, motivo, lesión, antecedentes,
   evaluación, objetivo, etapa, plan, progresión, observaciones, foto del pedido médico.
4. **Evaluación física/kinesiológica** — dolor 0-10, flags sí/no, observación
   kinesiológica, etc. (ver sección dedicada).

Handler de guardado: `guardarPaciente()` ([app.js:1516](../assets/js/app.js)).
Llenado al editar: `fillPacienteForm(p)` ([app.js:1473](../assets/js/app.js)).

### Campos renombrados (importante)

- **"Sesiones"** en la UI = campo `sesionesAuth` (sesiones autorizadas). `null` =
  sin tope. La etiqueta cambió pero el campo sigue siendo `sesionesAuth`.
- **"Total a pagar"** = campo `totalPagar`. Reemplazó al viejo "Sesiones realizadas".

---

## Alta vs edición: sesiones y deuda

Lógica en `guardarPaciente()` ([app.js:1552-1563](../assets/js/app.js)):

- **Alta** (`editingPacienteId == null`): arranca con `sesiones: 0` y
  **`deuda = totalPagar`**; `estado = 'pendiente'` si `totalPagar > 0`, si no `'pagado'`.
  O sea: el "Total a pagar" del alta **se convierte en la deuda inicial**.
- **Edición**: hace `store.update` con merge de los campos del form, pero **NO toca
  `sesiones` ni `deuda`** — esos los manejan Asistencia y Cobranzas aparte
  ([app.js:1554](../assets/js/app.js)).

> Por eso al editar un paciente no se pierde su deuda ni su conteo de sesiones.

### "+Paciente" desde Nuevo turno

Si el alta se abrió desde el modal de turno (`nuevoPacienteDesdeTurno`,
[app.js:1336](../assets/js/app.js)), al guardar vuelve al turno con el paciente
nuevo ya seleccionado (`pacienteReturnToTurno`, [app.js:1570](../assets/js/app.js)).

---

## Evaluación clínica (sección 4)

- Constantes de checkboxes de observación: `EVAL_OBS` ([app.js:1355](../assets/js/app.js)).
- Leer del form → objeto: `leerEvalClinica()` ([app.js:1361](../assets/js/app.js)).
- Cargar objeto → form: `fillEvalClinica(e)` ([app.js:1373](../assets/js/app.js)).
- ¿Tiene datos?: `evalTieneDatos(e)` ([app.js:1384](../assets/js/app.js)).
- HTML para mostrarla (ficha/print/PDF): `fichaEvalHtml(e)` ([app.js:1391](../assets/js/app.js)).

Se guarda en `paciente.evalClinica` → columna `eval_clinica` (**jsonb**) en
Supabase. Incluye intensidad de dolor (0-10), flags sí/no, observación
kinesiológica (checkboxes), mecanismo, antecedentes deportivos y firmas.

---

## Tabla / cards de pacientes

`renderPacientes()` ([app.js:481](../assets/js/app.js)). Tiene:

- **Búsqueda** (barra que dice solo "Buscar"), debounced (`filtrarPacientes`,
  [app.js:587](../assets/js/app.js)). Busca por nombre y **por DNI**.
- **Filtros**: por servicio (`filtrarPorServicio`, [app.js:591](../assets/js/app.js))
  y por profesional (`filtrarPorProf`, [app.js:592](../assets/js/app.js)).
- **Paginación** de 50 (`PAC_PAGE_SIZE`, [app.js:13](../assets/js/app.js)) — `pacGoPage`.
- Lógica de filtrado: `pacientesFiltrados()` ([app.js:469](../assets/js/app.js)).
- Badge de deuda: "Debe $X" (rojo) / "Al día" (verde) según `p.deuda > 0`.

Borrar: `confirmarBorrarPaciente` / `borrarPaciente` ([app.js:594-603](../assets/js/app.js)).

---

## Informe del paciente

- Vista detalle: `verPaciente(id)` ([app.js:1782](../assets/js/app.js)).
- Texto del informe: `generarInformePacienteTexto(p)` ([app.js:1682](../assets/js/app.js)).
- Modal de informe: `abrirInformePaciente` ([app.js:1717](../assets/js/app.js)).
- Compartir: WhatsApp (`compartirInformeWhatsApp`, [app.js:1747](../assets/js/app.js)),
  mail (`compartirInformeMail`, [app.js:1755](../assets/js/app.js)), copiar (`copiarInformePaciente`).

### PDF del informe

`descargarInformePDF()` ([app.js:1764](../assets/js/app.js)) usa
[`assets/js/pdf.js`](../assets/js/pdf.js) (jsPDF por CDN) — genera el informe
lindo con logo y datos del paciente.

---

## Ficha imprimible (firmas paciente + profesional)

`imprimirFicha(id)` ([app.js:1416](../assets/js/app.js)) /
`imprimirFichaActual()` ([app.js:1413](../assets/js/app.js)).

- Arma el bloque `#ficha-print` y llama a `window.print()`.
- **Truco de impresión**: en `@media print`, todo `body > *` se oculta con
  `display:none` salvo `#ficha-print` (clases `.fp-*` en `styles.css`). Se usó
  `display:none` (no `visibility:hidden`) para que **no queden páginas en blanco**.
- Incluye líneas de firma para paciente y profesional + fecha.

---

## Foto del pedido médico

- Cargar: `previewFotoMedico(input)` ([app.js:1301](../assets/js/app.js)) — acepta
  imagen o PDF, los guarda como dataURL en `paciente.fotoMedico` (`{ src, nombre }`)
  → columna `foto_medico` (jsonb).
- Limpiar: `limpiarFotoMedico()` ([app.js:1316](../assets/js/app.js)).
- Si es PDF se muestra con ícono 📄 y se puede abrir desde la ficha.

> Nota de escala: hoy las fotos van como base64 en la fila. A mucho volumen
> conviene Supabase Storage (bucket privado) y guardar solo la ruta — ver `SETUP.md`.
