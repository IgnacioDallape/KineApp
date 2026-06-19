# 02 — Auth y roles

Login propio de la app (NO Supabase Auth) con dos roles.

---

## Cómo funciona

El login es **a nivel app**: usuario + contraseña definidos en `config.js`, no en
Supabase Auth. La sesión se guarda en `localStorage`.

> ⚠️ Las contraseñas viven en el frontend (cualquiera que mire el código fuente
> las ve). Sirve para **separar roles en una herramienta interna de confianza**,
> no para seguridad fuerte. Para eso habría que migrar a Supabase Auth (un usuario
> por kinesiólogo) — ver `SETUP.md`. El usuario decidió **no migrar** por ahora.

---

## Usuarios

Definidos en [`config.js`](../assets/js/config.js) (`window.KINE_USERS`, línea 31):

| Usuario | Contraseña | Rol | Nombre mostrado |
|---------|------------|-----|-----------------|
| `Marcos` | `2026` | `admin` | Marcos |
| `kinesico` | `kinesico1234` | `staff` | Kinesiólogo |

`USERS_DEFAULT` ([app.js:42](../assets/js/app.js)) es un fallback por si
`KINE_USERS` no está. `getUsers()` ([app.js:46](../assets/js/app.js)) devuelve la
lista efectiva.

---

## Roles: qué ve cada uno

- **`admin`** → ve **todo**, incluidas las páginas de plata (Cobranzas y Gastos) y
  las cards financieras del dashboard.
- **`staff`** → ve todo **menos** Cobranzas, Gastos, y las dos cards de plata del
  dashboard (pagos pendientes / movimientos de caja).

### Qué se bloquea exactamente

Dos constantes en [app.js:84-87](../assets/js/app.js):

```js
ADMIN_ONLY_PAGES = ['cobranzas', 'pagos'];   // navigate() las niega a staff
ADMIN_ONLY_NAV   = ['nav-admin-section', 'nav-cobranzas', 'mas-cobranzas',
                    'nav-pagos', 'bnav-pagos', 'card-pend', 'card-caja'];
```

- `applyRolePermissions()` ([app.js:90](../assets/js/app.js)) oculta los elementos
  de `ADMIN_ONLY_NAV` (links del sidebar, del menú "Más" móvil, de la bottom-nav, y
  las cards `card-pend` / `card-caja` del dashboard) cuando el usuario no es admin.
- `navigate(page)` ([app.js:157](../assets/js/app.js)) además **bloquea la
  navegación directa**: si un staff intenta ir a `cobranzas`/`pagos`, lo manda al
  dashboard. (No alcanza con ocultar el link: hay que negar la ruta.)

`isAdmin()` ([app.js:50](../assets/js/app.js)) = `currentUser.role === 'admin'`.

---

## Sesión

- Clave: `localStorage['kineapp:session']` (`SESSION_KEY`, [app.js:41](../assets/js/app.js)).
- `restoreSession()` ([app.js:55](../assets/js/app.js)) la lee al arrancar.
- `doLogin()` ([app.js:136](../assets/js/app.js)) valida con `findUser()`
  ([app.js:51](../assets/js/app.js)) y guarda `publicUser(u)` (sin la contraseña).
- `doLogout()` ([app.js:149](../assets/js/app.js)) limpia la sesión y vuelve al login.
- El footer del sidebar y el `#mas-user` móvil muestran **quién está logeado** +
  rol + botón Salir (`renderConnStatus`, [app.js:98](../assets/js/app.js)).

---

## Importante al tocar permisos

- Si agregás una página de plata nueva, sumala a **ambas** listas
  (`ADMIN_ONLY_PAGES` para la ruta, `ADMIN_ONLY_NAV` para el link) y dale el id
  correspondiente en el HTML.
- Ocultar el link **no** es suficiente — `navigate()` debe negar la ruta, porque
  el staff podría llamarla desde la consola o un deep-link.
