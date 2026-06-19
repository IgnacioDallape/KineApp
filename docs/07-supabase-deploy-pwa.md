# 07 — Supabase, deploy y PWA

Base de datos, cómo se publica y la app instalable.

---

## Supabase

Proyecto: `https://evtycxsvtllsnujuxgjb.supabase.co` (ref `evtycxsvtllsnujuxgjb`).
Credenciales en [`config.js`](../assets/js/config.js). **Modo cloud activo.**

El schema completo está en [`supabase/schema.sql`](../supabase/schema.sql).
Para aplicarlo: SQL Editor → New query → pegar todo → Run.

### Tablas

| Tabla | Campos clave | Notas |
|-------|--------------|-------|
| `obras_sociales` | nombre, servicios, contacto, **`cubre` jsonb** | `cubre` = `{ "Por sesión":$, "Pack 10 sesiones":$, … }`. Columnas `cobertura/valor_sesion/monto_por_sesion/adicional10` son **legacy sin uso** ([schema.sql:24](../supabase/schema.sql)) |
| `servicios` | nombre, descripcion, icono, color | catálogo ([schema.sql:38](../supabase/schema.sql)) |
| `pacientes` | nombre, **dni**, tel, email, …, sesiones, **sesiones_auth**, **eval_clinica jsonb**, **total_pagar**, deuda, estado, tipo_cobertura, **obra_social_id** (FK) | ([schema.sql:48](../supabase/schema.sql)) |
| `turnos` | **paciente_id** (FK, on delete cascade), paciente, fecha, hora, duracion, servicio, serv_class, prof, notas, asistencia | ([schema.sql:80](../supabase/schema.sql)) |
| `pagos` | paciente_id (FK), paciente, fecha, concepto, monto, estado | ([schema.sql:96](../supabase/schema.sql)) |
| `gastos` | concepto, categoria, monto, vencimiento, pagado | ([schema.sql:107](../supabase/schema.sql)) |
| `tarifas` | servicio, concepto, monto | ([schema.sql:118](../supabase/schema.sql)) |

`foto_medico` (jsonb en pacientes) guarda `{ src (dataURL), nombre }`.

### Índices (para escalar)

[schema.sql:129-138](../supabase/schema.sql): índices en FKs y filtros frecuentes
(`turnos.paciente_id`, `turnos.fecha`, `pacientes.dni`, `pacientes.deuda`…) + GIN
trigram (`pg_trgm`) sobre `pacientes.nombre` y `.lesion` para búsqueda `ilike` rápida.

### RLS (seguridad)

[schema.sql:170-181](../supabase/schema.sql): RLS activado, policy `staff_all`
**`for all to anon, authenticated using (true)`**. O sea: quien tenga la anon key
(que es pública) puede leer/escribir vía la API REST.

> ⚠️ Aceptable para una **herramienta interna/MVP**, NO para datos sensibles a gran
> escala. El "login real" lo hace la app (usuario+contraseña con roles), no la base.
> Para seguridad fuerte: migrar a Supabase Auth y cambiar a `to authenticated`. El
> usuario **decidió no migrar** por ahora (ver [02-auth-y-roles.md](02-auth-y-roles.md)).

### Realtime

[schema.sql:186-195](../supabase/schema.sql): agrega las 7 tablas a la publicación
`supabase_realtime`. Así los cambios de un usuario llegan a los demás (el cliente se
suscribe en `store.subscribeRealtime`, ver [01-arquitectura.md](01-arquitectura.md)).

### Seed

[schema.sql:198-243](../supabase/schema.sql): datos de ejemplo (OS, servicios,
pacientes, tarifas, gastos). **Correr una sola vez**; borralos al ir a producción.
La base real arrancó **limpia** (sin seed).

### updated_at automático

Trigger `set_updated_at()` ([schema.sql:143-159](../supabase/schema.sql)) en las
tablas que tienen `updated_at`.

---

## Deploy — GitHub Pages

- Repo: `IgnacioDallape/KineApp`, rama **`main`**.
- **No hay build**: GitHub Pages sirve los archivos tal cual.
- Flujo: commit → `git push origin main` → Pages republica en ~1 min.
- No hay staging ni branches: se trabaja directo en `main`.

---

## PWA (instalable)

- [`manifest.webmanifest`](../manifest.webmanifest) — nombre, íconos, theme, display
  standalone. Ícono en [`assets/icon.svg`](../assets/icon.svg).
- [`sw.js`](../sw.js) — service worker **network-first**: intenta la red y cachea
  solo respuestas `ok` (200, basic). **No cachea las CDNs** (Supabase SDK, jsPDF) para
  no servir versiones viejas. `addAll` tolerante (si un asset falla no rompe el install).
- Registrado desde `index.html`.
- **Viewport** con `user-scalable=no` + `touch-action` + `gesturestart`
  preventDefault → bloquea el zoom en mobile (pedido del usuario).
- Layout usa `100dvh` (no `100vh`) para que el sidebar no quede cortado en iPad
  Safari; breakpoint mobile alineado a `≤900px` (coincide con `isMobile()`,
  [app.js:194](../assets/js/app.js)).

---

## Branding

**kinesico SPORT** — "kinesico" en oscuro + "SPORT" en azul. Aparece en sidebar,
login, PDF e impresión. Title de la página: "Kinesico Sport".
