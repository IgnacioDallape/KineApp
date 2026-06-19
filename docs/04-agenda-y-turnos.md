# 04 — Agenda y turnos

Grilla semanal, turnos multi-día, asistencia ↔ sesiones, cupos, recordatorios.

---

## Agenda semanal

`renderAgenda()` ([app.js:323](../assets/js/app.js)). Grilla de la semana con
horarios de **08:00 a 22:00** (el rango de horas se genera en `openModal` para el
select, [app.js:1196](../assets/js/app.js)).

- Cambiar de semana: `changeWeek(dir)` ([app.js:290](../assets/js/app.js)).
- **Chip del turno**: muestra **apellido y nombre** completos + la hora más grande
  y centrada.
- **Filtros**:
  - por **profesional**: `setFiltroProf` ([app.js:300](../assets/js/app.js)),
    opciones desde `populateAgendaProf` ([app.js:315](../assets/js/app.js)).
  - por **servicio/actividad**: `setFiltroActividad` ([app.js:299](../assets/js/app.js)),
    opciones desde los **servicios registrados** (`renderAgendaFiltros`,
    [app.js:303](../assets/js/app.js)) — solo aparecen los que existen en Servicios.
- Click en una celda vacía: `abrirNuevoTurno(fecha, hora)` ([app.js:385](../assets/js/app.js)).
- Click en un turno: `mostrarTurno(id)` ([app.js:391](../assets/js/app.js)) → detalle
  con notas/observación, botones de asistencia, eliminar.

---

## Nuevo turno (modal-turno)

`guardarTurno()` ([app.js:1227](../assets/js/app.js)). Campos: paciente, fecha,
hora, servicio, profesional, duración, notas. Botón **"+Paciente"** dentro del
modal para dar de alta sin salir (`nuevoPacienteDesdeTurno`).

### Turnos multi-día (selección de varios días)

Para no cargar un turno por vez, el modal tiene botones de día **Lun-Sáb**
(`#turno-dias`, `data-dia` = `getDay()`: Lun=1…Sáb=6) + un campo "Durante (N
semanas)" que aparece al marcar al menos un día.

- Toggle de día: `toggleDia(btn)` ([app.js:1215](../assets/js/app.js)).
- Reset del form: `resetTurnoForm()` ([app.js:1220](../assets/js/app.js)).

**Lógica de generación de fechas** ([app.js:1240-1254](../assets/js/app.js)):

- La **fecha de arriba es el INICIO** del período. Desde ahí, durante `N×7` días,
  se crea un turno a la misma hora en **cada día marcado**.
- Si no marcás ningún día → un solo turno en la fecha elegida.
- La fecha base **no** se agenda por sí sola: solo cae turno en los días marcados
  (el texto de ayuda lo aclara). Esto evita la sorpresa de crear un día que no
  marcaste.

**Avisos al crear** ([app.js:1264-1290](../assets/js/app.js)): recorre las fechas y
acumula dos listas:

- `ocupados` — el **mismo profesional** ya tiene turno a esa fecha+hora → se saltea
  y avisa "ya tenía turno (horario ocupado) en: …".
- `sinCupo` — se acabaron las **sesiones autorizadas** disponibles → se saltea y
  avisa "Sin sesiones autorizadas disponibles para: …".

Al final muestra un resumen: "Se agendaron N turnos" + los avisos. Si el cupo ya
estaba en 0 de entrada, corta con `mostrarBloqueado` ([app.js:1293](../assets/js/app.js)).

> Cupo de sesiones: `cupo = sesionesAuth − turnos ya existentes del paciente`
> ([app.js:1256-1262](../assets/js/app.js)). `sesionesAuth == null` ⇒ sin tope.

---

## Asistencia ↔ sesiones (clave)

`setAsistenciaTurno(turnoId, estado)` ([app.js:430](../assets/js/app.js)):

- Estados: `'asistio'` | `'ausente'` | `'reprog'` | `null` (toggle: re-clic al
  mismo estado lo limpia).
- **Al marcar "asistió"** (y no estaba ya en asistió) → **suma 1 a `paciente.sesiones`**.
  Si con eso llega al tope (`sesionesAuth - sesiones === 0`) muestra
  `mostrarCompletado(pac)` ([app.js:659](../assets/js/app.js)).
- **Al desmarcar "asistió"** → **resta 1** (sin bajar de 0).

O sea: **cuando el paciente asiste, se le descuenta del cupo** (sube `sesiones`
realizadas hacia `sesionesAuth`). Esto se ve en la barra de progreso de sesiones.

`marcarTurnoAsist(id, estado)` ([app.js:449](../assets/js/app.js)) lo envuelve y
re-renderiza detalle + agenda + dashboard.

Página Asistencia dedicada: `renderAsistencia()` ([app.js:615](../assets/js/app.js)),
con `marcarAsist` ([app.js:653](../assets/js/app.js)).

Badge de estado: `asistBadge(a)` ([app.js:1061](../assets/js/app.js)).

---

## Recordatorios por WhatsApp

Página: `renderRecordatorios()` ([app.js:878](../assets/js/app.js)).

- `enviarRecordatorioWpp(turnoId)` ([app.js:862](../assets/js/app.js)) abre
  `wa.me/<tel>` con una plantilla `{nombre}/{fecha}/{hora}/{profesional}`.
- El teléfono se normaliza con `telWhatsApp(tel)` ([app.js:202](../assets/js/app.js))
  → formato internacional (prefijo **549** para Argentina). **Sin esto el link de
  WhatsApp no funciona** (le falta el código de país).
- Config de la plantilla persistida en localStorage: `cargarRecConfig`
  ([app.js:854](../assets/js/app.js)) / `guardarRecConfig` ([app.js:905](../assets/js/app.js)).

---

## Datos de un turno

```
{ id, pacienteId, paciente (nombre denormalizado), fecha (YYYY-MM-DD),
  hora ('HH:MM'), duracion (min), servicio, servClass, prof, notas,
  asistencia: null|'asistio'|'ausente'|'reprog' }
```

`servClass` mapea el servicio a una clase de color (`servClassMap` en
`guardarTurno`, [app.js:1235](../assets/js/app.js)): rehab/gym/pilates/recovery.

> Fechas: siempre con `ymd(d)`, nunca `toISOString()` (corre un día por UTC).
