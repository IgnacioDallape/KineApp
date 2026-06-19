# KineApp — Documentación

Mapa del proyecto para no tener que leer todo el código. Cada archivo apunta a
la función real con refs `archivo:línea` (verificadas el **2026-06-18**).

> Si una línea no coincide exactamente, buscá la función por nombre — el código
> se edita seguido y los números pueden correrse unas líneas.

---

## TL;DR (30 segundos)

Sistema de gestión para un centro de kinesiología/readaptación deportiva
(**kinesico SPORT**, de Marcos Porretta). **HTML/CSS/JS vanilla** (sin build, sin
framework, sin npm), servido por **GitHub Pages**. Backend en **Supabase**
(Postgres + REST + Realtime), con **fallback a localStorage** si la nube no está.

Maneja: pacientes (con ficha clínica), agenda de turnos, asistencia, cobranzas,
gastos, obras sociales y tarifas, recordatorios por WhatsApp, informes en PDF y
ficha imprimible. Login propio por usuario/contraseña con **roles** (admin ve
plata, staff no). Es una **PWA** instalable.

Todo el texto de UI es **español argentino** (vos, "cargá", "querés").

---

## Índice

| Doc | Tema |
|-----|------|
| [01-arquitectura.md](01-arquitectura.md) | Stack, capa de datos (store cloud/local), flujo de render, realtime, config |
| [02-auth-y-roles.md](02-auth-y-roles.md) | Login app-level, usuarios, roles admin/staff, qué bloquea cada rol |
| [03-pacientes-y-ficha.md](03-pacientes-y-ficha.md) | Alta/edición, secciones del form, evaluación clínica, sesiones/deuda, PDF e impresión |
| [04-agenda-y-turnos.md](04-agenda-y-turnos.md) | Agenda semanal, turnos multi-día, asistencia ↔ sesiones, cupos, recordatorios WhatsApp |
| [05-cobranzas-y-gastos.md](05-cobranzas-y-gastos.md) | Cobranzas (deuda real), modal Cobrar, gastos, caja |
| [06-obras-sociales-y-tarifas.md](06-obras-sociales-y-tarifas.md) | Tarifas por pack, cobertura de OS, cálculo del coseguro |
| [07-supabase-deploy-pwa.md](07-supabase-deploy-pwa.md) | Schema SQL, RLS, índices, deploy GitHub Pages, PWA |

---

## Comandos

No hay build. Es estático.

```bash
# Servir local (cualquiera de estos):
npx serve -l 5180          # http://localhost:5180
python -m http.server 5180

# Deploy: push a main -> GitHub Pages publica solo (~1 min)
git push origin main
```

No hay `npm install`, ni tests automatizados, ni bundler. La verificación es
manual en el navegador.

---

## Estructura del repo

```
KineApp/
├── index.html              Único HTML. Toda la UI (páginas + modales) vive acá.
├── assets/
│   ├── css/styles.css       CSS global (vars de tema, layout, print, responsive)
│   ├── js/
│   │   ├── config.js        ⚙️ Credenciales Supabase + usuarios/roles (window.KINE_*)
│   │   ├── store.js         ⭐ Capa de datos: cache + CRUD async + cloud/local + realtime
│   │   ├── app.js           ⭐ Toda la lógica de UI (render + handlers), ~1880 líneas
│   │   └── pdf.js           Generación de PDF del informe (jsPDF por CDN)
│   └── icon.svg             Ícono de la PWA
├── supabase/
│   └── schema.sql           ⭐ Tablas, índices, RLS, realtime, seed de ejemplo
├── manifest.webmanifest     Manifest PWA
├── sw.js                    Service worker (network-first)
├── SETUP.md                 Guía de puesta en marcha (Supabase + usuarios)
└── docs/                    ← estás acá
```

Tamaños aproximados: `app.js` ~1880 LOC · `index.html` ~980 · `styles.css` ~510 ·
`store.js` ~360 · `schema.sql` ~250 · `pdf.js` ~160 · `config.js` ~35.

---

## Páginas (navegación)

`navigate(page)` en [app.js:157](../assets/js/app.js) muestra una página por id.
Cada página es un `<section>` en `index.html`. Las páginas de plata son **solo
admin** (ver [02-auth-y-roles.md](02-auth-y-roles.md)).

| `page` id | Qué es | Función de render | Rol |
|-----------|--------|-------------------|-----|
| `dashboard` | Resumen + agenda del día + deudores | `renderDashboard` ([app.js:222](../assets/js/app.js)) | todos |
| `agenda` | Grilla semanal de turnos | `renderAgenda` ([app.js:323](../assets/js/app.js)) | todos |
| `pacientes` | Tabla/cards de pacientes + búsqueda | `renderPacientes` ([app.js:481](../assets/js/app.js)) | todos |
| `asistencia` | Marcar asistencia del día | `renderAsistencia` ([app.js:615](../assets/js/app.js)) | todos |
| `servicios` | Servicios + tarifas + obras sociales | `renderServicios` ([app.js:917](../assets/js/app.js)) | todos |
| `recordatorios` | Envío de recordatorios WhatsApp | `renderRecordatorios` ([app.js:878](../assets/js/app.js)) | todos |
| `cobranzas` | Cobros, caja, deudores | `renderCobranzas` ([app.js:751](../assets/js/app.js)) | **admin** |
| `pagos` | Gastos del centro | `renderPagos` ([app.js:676](../assets/js/app.js)) | **admin** |

---

## Modelo de datos (resumen)

7 tablas, todas en el cache `store.state.*` con la misma forma. Detalle en
[01-arquitectura.md](01-arquitectura.md) y el SQL en [07-supabase-deploy-pwa.md](07-supabase-deploy-pwa.md).

```
pacientes ──< turnos          (turnos.pacienteId → pacientes.id)
pacientes ──< pagos
obras_sociales ──< pacientes  (pacientes.obraSocialId → obras_sociales.id)
servicios   (catálogo)        gastos   (independiente)    tarifas (por servicio+concepto)
```

---

## Convenciones

- **Sin framework**: el estado vive en `store.state` (ver `store.js`); el render
  son funciones `renderX()` que arman HTML con template strings y lo inyectan con
  `innerHTML`. No hay reactividad automática: después de mutar, se llama al
  `renderX()` correspondiente.
- **Cache camelCase / DB snake_case**: el store traduce solo (ver
  [01-arquitectura.md](01-arquitectura.md)). En JS siempre se usa camelCase
  (`pacienteId`, `sesionesAuth`, `obraSocialId`).
- **Fechas**: usar `ymd(d)` ([app.js:198](../assets/js/app.js)) para fecha local
  `YYYY-MM-DD`. **No usar `toISOString()`** para fechas de turno (corre un día por
  UTC de noche). El seed viejo todavía usa `toISOString` pero es solo demo.
- **Plata**: `ars(n)` ([app.js:195](../assets/js/app.js)) formatea `$1.234` es-AR.
- **WhatsApp**: `telWhatsApp(tel)` ([app.js:202](../assets/js/app.js)) normaliza a
  formato internacional (prefijo `549` para Argentina).
- **Español argentino** en todo el texto visible.
