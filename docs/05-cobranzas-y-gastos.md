# 05 — Cobranzas y gastos

Páginas de plata. **Solo admin** (ver [02-auth-y-roles.md](02-auth-y-roles.md)).

---

## Modelo de deuda

La **deuda vive en el paciente** (`paciente.deuda`), no en la suma de pagos
pendientes. Esto es deliberado: al dar de alta, el "Total a pagar" se vuelve la
deuda inicial (ver [03-pacientes-y-ficha.md](03-pacientes-y-ficha.md)).

- **"Total pendiente"** (caja) = **Σ `paciente.deuda`** de todos los pacientes
  ([app.js:756-760](../assets/js/app.js)). Coincide con la columna Deuda de la tabla
  de pacientes. (Antes sumaba pagos pendientes y no cuadraba.)

---

## Cobranzas

`renderCobranzas()` ([app.js:751](../assets/js/app.js)). Muestra:

- **Cobrado hoy** = pagos `Pagado` con `fecha == hoy` ([app.js:754](../assets/js/app.js)).
- **Cobrado mes** = pagos `Pagado` del mes actual ([app.js:755](../assets/js/app.js)).
- **Total pendiente** = Σ deuda de pacientes (arriba).
- **Deudores** = pacientes con `deuda > 0`, con alertas ([app.js:771](../assets/js/app.js)).

### Modal Cobrar (el botón dentro de cada deudor)

`abrirCobro(pacId)` ([app.js:1590](../assets/js/app.js)):

- Muestra la deuda actual (rojo) o "✓ Sin deuda pendiente" (verde).
- Si **debe**, abre directo en modo **"Saldar deuda"** con el monto **precargado**
  con la deuda total ([app.js:1601-1603](../assets/js/app.js)).
- `onCobroTipoChange()` ([app.js:1580](../assets/js/app.js)) re-precarga el monto al
  cambiar a "Saldar deuda".

`confirmarCobro()` ([app.js:1607](../assets/js/app.js)) — aplica el cobro:

- Pago **Pagado** sobre un paciente con deuda → baja la deuda:
  `deuda = max(0, deuda − monto)`; si llega a 0, `estado = 'pagado'`
  ([app.js:1615-1616](../assets/js/app.js)).
- Pago **Pendiente** → **suma** a la deuda y marca `pendiente`
  ([app.js:1617-1618](../assets/js/app.js)).
- Siempre registra una fila en `pagos` ([app.js:1620](../assets/js/app.js)) con
  `fecha: ymd(new Date())`.
- Re-renderiza Gastos y Cobranzas.

`guardarPago()` ([app.js:1629](../assets/js/app.js)) es la variante desde el modal
de pago genérico (misma lógica de deuda).

---

## Gastos (página `pagos`)

`renderPagos()` ([app.js:676](../assets/js/app.js)). Gastos del centro (alquiler,
sueldos, servicios, insumos…), **independientes** de los pacientes.

- **Total pendiente de gastos** = Σ monto de gastos `!pagado` ([app.js:678](../assets/js/app.js)).
- **Total pagado** = Σ monto de gastos `pagado` ([app.js:679](../assets/js/app.js)).
- Filtro pendiente/pagado: `setFiltroGastos` ([app.js:669](../assets/js/app.js)).
- Toggle pagado/no: `toggleGasto(id)` ([app.js:728](../assets/js/app.js)).
- Alta: `guardarGasto()` ([app.js:733](../assets/js/app.js)).
- Baja: `eliminarGasto(id)` ([app.js:748](../assets/js/app.js)).
- Iconos por categoría: `categoriaIcono` ([app.js:667](../assets/js/app.js)) —
  Sueldos 💼, Infraestructura 🏢, Servicios 💡, Insumos 📦, Impuestos 🧾, Otros 📌.

Tabla `gastos`: `{ concepto, categoria, monto, vencimiento (date), pagado (bool) }`.

---

## Dónde están en el menú

Cobranzas y Gastos se agrupan en el sidebar bajo un encabezado **"Administración"**
(`nav-admin-section`), visible solo para admin. Las cards de plata del dashboard
(`card-pend` pagos pendientes, `card-caja` movimientos) también son admin-only.
