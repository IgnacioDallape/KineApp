# 06 — Obras sociales y tarifas (coseguro)

Cómo se calcula cuánto paga el paciente cuando usa obra social.

---

## El modelo (simple, a pedido del usuario)

- **Tarifas**: lo que cobra el centro, por servicio + concepto/pack.
  Tabla `tarifas`: `{ servicio, concepto, monto }`.
- **Obra social**: cuánto **cubre** por sesión y por cada pack.
  Tabla `obras_sociales`, columna **`cubre`** (jsonb):
  `{ "Por sesión": $, "Pack 5 sesiones": $, "Pack 10 sesiones": $, … }`.
- **Coseguro** (lo que paga el paciente de su bolsillo) = **tarifa − cobertura**.

Packs soportados: `PACKS` ([app.js:1097](../assets/js/app.js)) =
`['Por sesión','Pack 5 sesiones','Pack 10 sesiones','Pack 15 sesiones','Pack 20 sesiones']`.
Cantidad de sesiones por pack: `PACK_SESIONES` ([app.js:1109](../assets/js/app.js))
= `{ 'Por sesión':1, 5, 10, 15, 20 }`.

> ⚠️ Si la tabla `obras_sociales` es de una versión vieja, puede faltarle la
> columna `cubre`. Para que el coseguro persista en la nube, correr una vez:
> ```sql
> alter table obras_sociales add column if not exists cubre jsonb;
> ```

---

## Las funciones (todas en app.js, ~1104-1129)

| Función | Qué devuelve | Ref |
|---------|--------------|-----|
| `tarifaDePack(concepto, servicio)` | monto de esa tarifa (prioriza el servicio; si no, la primera con ese concepto) | [app.js:1104](../assets/js/app.js) |
| `precioPack(concepto, servicio)` | precio del pack: tarifa directa, **o** (tarifa "Por sesión" × N) si no cargaron la del pack | [app.js:1111](../assets/js/app.js) |
| `cubrePack(os, concepto)` | lo que cubre la OS: monto directo, **o** (cubre "Por sesión" × N) | [app.js:1117](../assets/js/app.js) |
| `coseguroPack(os, concepto, servicio)` | `max(0, precioPack − cubrePack)` | [app.js:1123](../assets/js/app.js) |
| `packsConPrecio(servicio)` | qué packs tienen precio (directo o derivado) | [app.js:1127](../assets/js/app.js) |
| `packDeSesiones(n)` | mapea 5/10/15/20 → nombre del pack (`null` si no es múltiplo) | [app.js:1135](../assets/js/app.js) |

**Escalado clave**: tanto `precioPack` como `cubrePack` derivan el valor del pack
multiplicando el "Por sesión" × N cuando no hay tarifa/cobertura directa del pack.
Por eso un paciente de 7 sesiones (que no es un pack) igual calcula bien:
`coseguro = (tarifa/sesión − cubre/sesión) × 7`.

---

## Dónde se usa

### Alta/edición del paciente (recuadro de coseguro)

`onObrasSocialChange()` ([app.js:1172](../assets/js/app.js)) — al elegir OS / cambiar
servicio o sesiones, rellena el recuadro `#pac-os-info`:

- Decide `usaPack` = hay pack con precio para esas sesiones.
- Calcula **Cubre** y **Coseguro** **escalados igual** (× N en la ruta por-sesión),
  así **Cubre + Coseguro = precio total** ([app.js:1179-1183](../assets/js/app.js)).
  Ej.: tarifa $1.000/sesión, OS cubre $700/sesión, 7 sesiones →
  Cubre $4.900 + Coseguro $2.100 = $7.000. ✅
- Llama a `sugerirTotalPagar()` ([app.js:1158](../assets/js/app.js)) que precarga
  "Total a pagar" con el coseguro del pack/sesiones.

> **Orden importante** (`fillPacienteForm`, [app.js:1482-1484](../assets/js/app.js)):
> se setea OS y **sesiones ANTES** de llamar a `onObrasSocialChange()`, para que el
> recuadro use las sesiones reales del paciente. (Bug arreglado: antes calculaba con
> las sesiones del paciente anterior.) Después se pisa "Total a pagar" con el valor
> guardado del paciente ([app.js:1485](../assets/js/app.js)).

### Card de la obra social (Servicios)

`renderServicios()` ([app.js:917](../assets/js/app.js), card de OS ~972-974) lista,
por cada pack con tarifa, "cubre $X · coseguro $Y".

> Limitación conocida (riesgo bajo): la card y el preview del modal calculan **sin
> pasar `servicio`** → si cargás **distintos** precios por-sesión del **mismo**
> concepto en servicios diferentes, muestran el de la primera tarifa. Con una tarifa
> por concepto (el caso normal) no hay divergencia. El cálculo real del paciente sí
> usa `p.servicio`.

### Preview en vivo al cargar una OS (modal-obrasocial)

`updateCoseguroPreview()` ([app.js:1140](../assets/js/app.js)) — mientras cargás
cuánto cubre la OS, muestra el coseguro resultante por cada pack con tarifa.

---

## CRUD de tarifas y obras sociales

- Tarifa: `guardarTarifa` ([app.js:981](../assets/js/app.js)) / `eliminarTarifa` ([app.js:992](../assets/js/app.js)).
- OS: `guardarObraSocial` ([app.js:994](../assets/js/app.js)) / `eliminarObraSocial` ([app.js:1008](../assets/js/app.js)).
  El form de OS pide solo **nombre + cuánto cubre** por sesión/5/10/15/20
  (`OS_CUBRE_FIELDS`, [app.js:1098](../assets/js/app.js); `leerCubreOS`, [app.js:1130](../assets/js/app.js)).
  Servicios/contacto quedaron opcionales.
- Servicio: `guardarServicio` ([app.js:1650](../assets/js/app.js)) / `eliminarServicio` ([app.js:1663](../assets/js/app.js)).
