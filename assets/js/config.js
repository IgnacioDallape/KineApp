// =====================================================================
// KineApp — Configuración del backend
// =====================================================================
// Pegá acá la URL y la anon key de tu proyecto Supabase.
// (Settings -> API en el dashboard de Supabase)
//
// La "anon key" es pública por diseño (segura para exponer en el frontend);
// quien protege los datos es RLS + Auth, no esconder esta clave.
//
// Si dejás estos valores vacíos, KineApp arranca en MODO LOCAL (demo):
// los datos se guardan en este navegador (localStorage), sin sincronización
// entre dispositivos. Útil para probar sin backend.
// =====================================================================

window.KINE_CONFIG = {
  supabaseUrl:     '',   // ej: 'https://xxxxxxxxxxxx.supabase.co'
  supabaseAnonKey: '',   // ej: 'eyJhbGciOi...'  (anon / publishable)
};

// =====================================================================
// Usuarios y roles (login de la app)
// =====================================================================
//  role: 'admin'  -> ve TODO, incluida la sección Cobranzas.
//  role: 'staff'  -> ve todo MENOS Cobranzas.
//  'nombre' es lo que se muestra como "quién está logeado".
//
// ⚠️ Estas contraseñas viven en el frontend (cualquiera que mire el código
//    fuente las puede ver). Sirve para separar roles en una herramienta
//    interna de confianza. Para seguridad real usá Supabase Auth (ver SETUP.md).
// =====================================================================
window.KINE_USERS = [
  { username: 'Marcos',   password: '2026',         role: 'admin', nombre: 'Marcos' },
  { username: 'kinesico', password: 'kinesico1234', role: 'staff', nombre: 'Kinesiólogo' },
];
