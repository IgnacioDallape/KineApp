# 01 — Arquitectura

Cómo está armada la app por dentro: stack, capa de datos, flujo de render.

---

## Stack

- **Frontend**: HTML/CSS/JS **vanilla**. Sin React/Vue, sin build, sin bundler,
  sin npm. Se sirve estático.
- **Backend**: **Supabase** (Postgres + API REST autogenerada + Realtime). Se
  carga el SDK por CDN (UMD → `window.supabase`).
- **Persistencia local**: `localStorage` como fallback/demo cuando no hay Supabase.
- **PWA**: `manifest.webmanifest` + `sw.js` (ver [07-supabase-deploy-pwa.md](07-supabase-deploy-pwa.md)).

Orden de carga de scripts en `index.html` (importa): `config.js` → SDK Supabase
(CDN) → `store.js` → `pdf.js` → `app.js`.

---

## Las tres capas

```
┌─────────────────────────────────────────────────────────┐
│  app.js          UI: render (innerHTML) + event handlers │
│                  lee store.state.*  ·  llama store.add…   │
├─────────────────────────────────────────────────────────┤
│  store.js        Cache en memoria (store.state) +        │
│                  CRUD async + cloud/local + realtime      │
├─────────────────────────────────────────────────────────┤
│  Supabase  ──o──  localStorage   (uno u otro, según config)│
└─────────────────────────────────────────────────────────┘
```

---

## `store.js` — capa de datos (⭐ lo más importante)

Patrón **repositorio**: un cache en memoria con la **misma forma** que el viejo
objeto `state`, respaldado por Supabase (modo `cloud`) o localStorage (modo
`local`). Archivo: [`assets/js/store.js`](../assets/js/store.js).

### Estado y modo

```js
store.state = { pacientes:[], turnos:[], pagos:[], gastos:[],
                servicios:[], tarifas:[], obrasSociales:[] }   // store.js:72
store.mode  = 'cloud' | 'local'                                // store.js:73
store.isCloud = true|false
```

- **Lecturas**: el render lee `store.state.*` de forma **síncrona** (rápido).
  En `app.js` hay un alias `const state = store.state`.
- **Escrituras**: `store.add/update/patch/remove` mutan el cache **en el lugar**
  (no reasignan arrays) y persisten async.

### Tablas: cache (camel) ↔ DB (snake)

[store.js:24](../assets/js/store.js) mapea la clave del cache a la tabla real:

```js
obrasSociales → obras_sociales   servicios → servicios   pacientes → pacientes
turnos → turnos   pagos → pagos   gastos → gastos   tarifas → tarifas
```

### Traducción de campos camelCase ↔ snake_case

Automática por regex ([store.js:40-60](../assets/js/store.js)):

- al **escribir** (`toRow`): `pacienteId` → `paciente_id`, `sesionesAuth` → `sesiones_auth`.
- al **leer** (`fromRow`): `obra_social_id` → `obraSocialId`. Ignora `created_at`/`updated_at`.
- **Único alias manual**: `servicios.desc` ↔ `descripcion` ([store.js:37](../assets/js/store.js)).

> Por eso en JS **siempre** se usa camelCase. Si agregás una columna nueva en
> snake_case, el store la mapea sola (salvo que necesite alias).

### CRUD (async, mutación en el lugar)

| Método | Qué hace | Ref |
|--------|----------|-----|
| `add(key, obj)` | asigna UUID si falta, upsert en cache, insert en DB | [store.js:201](../assets/js/store.js) |
| `update(key, id, fields)` | `Object.assign` sobre el objeto del cache + update en DB | [store.js:211](../assets/js/store.js) |
| `patch(key, id, fields)` | alias de `update` | [store.js:222](../assets/js/store.js) |
| `remove(key, id)` | splice del cache + delete en DB | [store.js:224](../assets/js/store.js) |

En modo local, cada mutación persiste todo el cache a `localStorage['kineapp:db']`
(`_persistLocal`, [store.js:191](../assets/js/store.js)). Si falla la nube, los
`console.error('[KineApp] insert/update/delete …')` salen de acá.

### Índices (para escalar)

`reindex()` ([store.js:83](../assets/js/store.js)) reconstruye dos `Map`:

- `pacientesById` → lookup O(1): `store.pacienteById(id)`.
- `turnosByPaciente` → turnos de un paciente sin escanear todo: `store.turnosDePaciente(id)`.

Se llama después de cada mutación. Mata el O(n²) de filtrar turnos por paciente
en cada render.

### Carga inicial (resiliente)

`store.load()` ([store.js:133](../assets/js/store.js)):

1. Si `isCloud` → `_loadCloud()` trae las 7 tablas paginadas de a 1000 filas
   (`_fetchAll`, [store.js:159](../assets/js/store.js) — Supabase corta en 1000/consulta).
2. **Si la nube falla** (sin schema, RLS, sin red) → **no rompe**: cae a modo
   local con `_loadLocal(true)`. El flag `true` significa "vino de fallo cloud" →
   **arranca vacío, NO siembra los pacientes demo** encima de lo que el usuario
   espera de la nube ([store.js:182-187](../assets/js/store.js)).
3. Sin Supabase configurado → `_loadLocal()` lee localStorage o siembra el demo
   (`_seedLocal`, [store.js:279](../assets/js/store.js)).

### Realtime

`subscribeRealtime()` ([store.js:244](../assets/js/store.js)) abre un canal
`postgres_changes` por las 7 tablas. Cada cambio de **otro** usuario llama a
`_applyRemote` ([store.js:261](../assets/js/store.js)) que parchea el cache y
dispara `store.onChange(tabla)` → `app.js` re-renderiza la página activa.
Si Realtime no está disponible, avisa por consola y sigue (los cambios se ven al
recargar). Evita canales duplicados removiendo el anterior.

---

## `config.js` — qué prende cloud vs local

[`assets/js/config.js`](../assets/js/config.js):

```js
window.KINE_CONFIG = { supabaseUrl: '…', supabaseAnonKey: '…' };  // vacío = modo local
window.KINE_USERS  = [ {username, password, role, nombre}, … ];   // login app-level
```

`store.init()` ([store.js:98](../assets/js/store.js)) decide el modo: si hay URL +
anon key + SDK cargado → `cloud`; si no → `local` (demo). La anon key es **pública
por diseño** (segura para el frontend). Proyecto actual:
`evtycxsvtllsnujuxgjb.supabase.co`, **modo cloud activo**.

---

## Arranque de la app (`app.js`)

`boot()` ([app.js:66](../assets/js/app.js)) → `store.init()` → restaura sesión de
usuario → si hay login válido `startApp()` ([app.js:73](../assets/js/app.js)):
`store.load()` + `subscribeRealtime()` + `renderConnStatus()` + primer render.

`renderConnStatus()` ([app.js:98](../assets/js/app.js)) pinta el indicador
🟢 Conectado / 🟡 Local y rellena `#mas-user` (quién está logeado, para mobile).

---

## Flujo de render (sin framework)

No hay reactividad. El patrón es:

```
handler (ej. guardarPaciente)
   └─ await store.add/update(...)      // muta cache + persiste
   └─ renderX()                         // re-arma el HTML de esa página
   └─ (a veces) renderOtra() si afecta otra vista
```

Ej.: marcar asistencia ([app.js:449](../assets/js/app.js)) re-renderiza el detalle
del turno **y** la agenda **y** el dashboard, porque suma una sesión al paciente.

> Regla práctica: si tu cambio toca datos que se ven en varias páginas, llamá a
> todos los `renderX()` afectados (mirá cómo lo hacen `marcarTurnoAsist`,
> `confirmarCobro`, `guardarTurno`).
