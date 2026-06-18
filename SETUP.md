# KineApp — Puesta en marcha (multi-usuario)

KineApp ahora tiene **dos modos**, definidos por `assets/js/config.js`:

| Modo | Cuándo | Datos | Concurrencia |
|------|--------|-------|--------------|
| **Local** (demo) | `config.js` vacío | localStorage de este navegador | ❌ un solo dispositivo |
| **Cloud** | `config.js` con credenciales | Supabase (Postgres) | ✅ varios usuarios/dispositivos en vivo |

Recién clonado arranca en **modo local**, así podés probarlo sin nada. Para el
uso real multi-usuario (1000+ pacientes, varias personas a la vez), seguí esto:

---

## 1. Crear el proyecto Supabase

1. Entrá a https://supabase.com → **New project**.
2. Elegí región (ej: South America - São Paulo) y poné una contraseña de DB.
3. Esperá ~2 min a que termine de aprovisionar.

## 2. Crear las tablas

1. En el dashboard: **SQL Editor → New query**.
2. Abrí [`supabase/schema.sql`](supabase/schema.sql), copiá **todo** y pegalo.
3. **Run**. Crea tablas, índices, RLS, Realtime y datos de ejemplo.

## 3. (Opcional) Auth de Supabase para la capa de datos

El **login de la app** (quién entra + roles) es por **usuario + contraseña** y
se define en `assets/js/config.js` (`window.KINE_USERS`) — ver
[Usuarios y roles](#usuarios-y-roles). Eso funciona en los dos modos.

Aparte, las policies RLS de `schema.sql` exigen sesión **autenticada** de
Supabase para leer/escribir. Para el modo cloud tenés dos opciones:

- **A (recomendada para empezar):** creá usuarios en
  **Authentication → Users** y hacé que la app inicie sesión en Supabase
  además del login de roles (pequeño ajuste en `store.signIn`).
- **B (atajo, herramienta interna):** relajá las policies para permitir el rol
  `anon` (cambiá `to authenticated` por `to anon, authenticated` en
  `schema.sql`). Menos seguro: cualquiera con la anon key accede.

## 4. Conectar la app

1. En Supabase: **Settings → API**. Copiá:
   - **Project URL** (ej: `https://xxxx.supabase.co`)
   - **anon / publishable key** (`eyJhbGci...`)
2. Pegalas en [`assets/js/config.js`](assets/js/config.js):
   ```js
   window.KINE_CONFIG = {
     supabaseUrl:     'https://xxxx.supabase.co',
     supabaseAnonKey: 'eyJhbGci...',
   };
   ```
3. Listo. El footer del sidebar muestra 🟢 **Conectado** (en vez de
   🟡 **Modo local**).

## Usuarios y roles

El login es por **usuario + contraseña**, definido en
[`assets/js/config.js`](assets/js/config.js):

```js
window.KINE_USERS = [
  { username: 'Marcos',   password: '2026',         role: 'admin', nombre: 'Marcos' },
  { username: 'kinesico', password: 'kinesico1234', role: 'staff', nombre: 'Kinesiólogo' },
];
```

| Rol     | Acceso                                            |
|---------|---------------------------------------------------|
| `admin` | **Todo**, incluidas **Cobranzas** y **Gastos**    |
| `staff` | Todo **menos Cobranzas y Gastos** (las secciones de plata: ocultas + bloqueadas) |

- El footer del sidebar muestra **quién está logeado** y su rol, con botón **Salir**.
- La sesión queda recordada en el dispositivo hasta que toques **Salir**.
- Para agregar/quitar gente o cambiar contraseñas, editá `KINE_USERS`.

> ⚠️ Estas contraseñas viajan en el frontend (se ven en el código fuente).
> Alcanza para separar roles en una herramienta interna de confianza. Para
> seguridad fuerte, movelo a Supabase Auth (opción A de arriba).

## 5. Publicar

`git push` a `main` → GitHub Pages sirve el frontend. Supabase es el backend.
El hosting no cambia.

> ⚠️ **No** subas credenciales privadas: la *anon key* es pública por diseño
> (la protección real es RLS + Auth). La contraseña de la DB y la *service_role
> key* NO van en el frontend nunca.

---

## Cómo escala

- **Lookups O(1)**: índices `Map` por id (`store.pacienteById`,
  `store.turnosDePaciente`) en vez de buscar por nombre en cada render.
- **Paginación**: la tabla de pacientes renderiza de a 50 filas (no las 1000),
  con búsqueda por nombre/lesión *debounced*.
- **Índices SQL**: `gin_trgm` para búsqueda por texto, índices por
  `paciente_id`, `fecha`, etc. (ver `schema.sql`).
- **Realtime**: los cambios de un usuario llegan a los demás automáticamente
  (`store.subscribeRealtime`).
- **IDs UUID**: `crypto.randomUUID()` evita colisiones entre dispositivos.
- **Fetch paginado**: Supabase corta en 1000 filas/consulta; `store._fetchAll`
  trae por páginas.

Test de carga (en navegador): 1000 pacientes + 3000 turnos →
render de tabla ~13 ms, búsqueda ~15 ms, 10.000 lookups ~1,4 ms.

---

## Próximos pasos sugeridos (no incluidos)

1. **Fotos del pedido médico a Supabase Storage** (bucket privado) en lugar de
   base64 en la fila — hoy `pacientes.foto_medico` es jsonb; a escala conviene
   guardar sólo la ruta.
2. **Multi-clínica**: agregar `clinic_id` a las tablas y ajustar las policies
   (ver nota al pie de `schema.sql`).
3. **Recordatorios reales** (WhatsApp/SMS): hoy son simulados; requieren un
   proveedor (Twilio / WhatsApp Cloud API) vía una Edge Function.
4. **Búsqueda server-side**: para >10.000 pacientes, filtrar con `.ilike()` +
   `.range()` en Supabase en vez de cachear todo en el cliente.
