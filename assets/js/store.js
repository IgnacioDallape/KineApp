// =====================================================================
// KineApp — Store / capa de datos (multi-usuario, escalable)
// =====================================================================
// Patrón repositorio: un cache en memoria con la MISMA forma que el viejo
// `state`, respaldado por Supabase (modo cloud) o localStorage (modo local).
//
//  • Lecturas: el render lee `store.state.*` de forma síncrona (rápido).
//  • Escrituras: store.add/update/patch/remove -> persisten async + mutan
//    el cache EN EL LUGAR (no reasignan arrays) y mantienen los índices.
//  • Realtime: en modo cloud, los cambios de otros usuarios parchean el
//    cache y disparan store.onChange(tabla) -> el app re-renderiza.
//  • Sin backend configurado -> modo local (demo) sobre localStorage.
//
// Escala: índices Map por id (lookups O(1)), turnos indexados por paciente
// (mata el O(n²) de filtrar por nombre en cada render), fetch paginado
// (Supabase corta en 1000 filas por query) e ids UUID (sin colisiones entre
// dispositivos).
// =====================================================================

(function () {
  'use strict';

  // ---- tablas: clave en el cache (camel) <-> tabla en la DB (snake) ----
  const TABLES = {
    obrasSociales: 'obras_sociales',
    servicios:     'servicios',
    pacientes:     'pacientes',
    turnos:        'turnos',
    pagos:         'pagos',
    gastos:        'gastos',
    tarifas:       'tarifas',
    profesionales: 'profesionales',
  };
  const DB_TO_KEY = Object.fromEntries(Object.entries(TABLES).map(([k, v]) => [v, k]));

  // Alias de campos que NO siguen la regla camel<->snake automática.
  // (sólo servicios.desc <-> descripcion)
  const ALIASES = { servicios: { desc: 'descripcion' } };
  const IGNORE_ON_READ = new Set(['created_at', 'updated_at']);

  const camelToSnake = s => s.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
  const snakeToCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

  function toRow(key, obj) {
    const alias = ALIASES[key] || {};
    const row = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      row[alias[k] || camelToSnake(k)] = v;
    }
    return row;
  }
  function fromRow(key, row) {
    const ralias = Object.fromEntries(Object.entries(ALIASES[key] || {}).map(([a, b]) => [b, a]));
    const obj = {};
    for (const [k, v] of Object.entries(row)) {
      if (IGNORE_ON_READ.has(k)) continue;
      obj[ralias[k] || snakeToCamel(k)] = v;
    }
    return obj;
  }

  const uuid = () =>
    (crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });

  // ---- carga resiliente del SDK de Supabase ----
  // El SDK viene de un CDN. Si la primera carga (el <script> de index.html) falla
  // por red floja, NO queremos caer a modo local en silencio (los datos quedarían
  // atrapados en el dispositivo). Reintentamos con CDNs alternativos antes de rendirnos.
  function _loadScriptOnce(src, timeoutMs) {
    return new Promise(resolve => {
      const sc = document.createElement('script');
      let settled = false;
      const done = ok => { if (!settled) { settled = true; resolve(ok); } };
      sc.src = src;
      sc.onload = () => done(true);
      sc.onerror = () => done(false);
      document.head.appendChild(sc);
      setTimeout(() => done(false), timeoutMs || 5000);
    });
  }
  async function ensureSupabaseSdk() {
    if (window.supabase && window.supabase.createClient) return true;
    // El <script> sincrónico de index.html ya intentó jsDelivr; probamos respaldos.
    const cdns = [
      'https://unpkg.com/@supabase/supabase-js@2',
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    ];
    for (const url of cdns) {
      await _loadScriptOnce(url, 5000);
      if (window.supabase && window.supabase.createClient) return true;
    }
    return false;
  }
  // ¿El error es estrictamente "la tabla no existe" (schema viejo)? -> se ignora esa tabla.
  // Sólo códigos inequívocos: 42P01 (Postgres "relation does not exist") y PGRST205
  // (PostgREST "Could not find the table"). NO matcheamos PGRST204 (es error de COLUMNA),
  // ni 'schema cache' ni 'does not exist' a secas: aparecen en errores de columna (42703)
  // o transitorios de PostgREST sobre tablas que SÍ existen, y tragarlos mostraría una
  // tabla con datos como vacía. Cualquier otro error (red/RLS) debe propagarse.
  function _isMissingTableError(e) {
    const code = (e && e.code) || '';
    if (code === '42P01' || code === 'PGRST205') return true;
    // Backstop por mensaje SOLO para el patrón exacto de tabla faltante (42P01 sin code).
    const msg = ((e && e.message) || '').toLowerCase();
    return msg.includes('relation') && msg.includes('does not exist');
  }

  // =====================================================================
  const store = {
    state: { pacientes: [], turnos: [], pagos: [], gastos: [], servicios: [], tarifas: [], obrasSociales: [], profesionales: [] },
    mode: 'local',          // 'cloud' | 'local'
    isCloud: false,
    sdkFailed: false,       // hay credenciales pero el SDK no cargó (sin nube = datos solo locales)
    localBackup: null,      // datos que quedaron solo en este dispositivo (para subir a la nube)
    user: null,
    onChange: null,         // (tableKey) => void   (lo setea app.js)
    onAuthChange: null,     // (user) => void

    _sb: null,
    _idx: { pacientesById: new Map(), turnosByPaciente: new Map() },

    // ---------- índices ----------
    reindex() {
      const byId = new Map();
      for (const p of this.state.pacientes) byId.set(p.id, p);
      const byPac = new Map();
      for (const t of this.state.turnos) {
        if (!byPac.has(t.pacienteId)) byPac.set(t.pacienteId, []);
        byPac.get(t.pacienteId).push(t);
      }
      this._idx.pacientesById = byId;
      this._idx.turnosByPaciente = byPac;
    },
    pacienteById(id) { return this._idx.pacientesById.get(id) || null; },
    turnosDePaciente(id) { return this._idx.turnosByPaciente.get(id) || []; },

    // ---------- init / auth ----------
    async init() {
      const cfg = window.KINE_CONFIG || {};
      const haveCreds = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
      // Si hay credenciales, esperamos/reintentamos el SDK antes de decidir el modo.
      const haveSdk = haveCreds
        ? await ensureSupabaseSdk()
        : (typeof window.supabase !== 'undefined' && window.supabase.createClient);
      if (haveCreds && haveSdk) {
        this._sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        this.mode = 'cloud';
        this.isCloud = true;
        const { data } = await this._sb.auth.getSession();
        this.user = data?.session?.user || null;
        this._sb.auth.onAuthStateChange((_e, session) => {
          this.user = session?.user || null;
          if (this.onAuthChange) this.onAuthChange(this.user);
        });
      } else {
        this.mode = 'local';
        this.isCloud = false;
        if (haveCreds && !haveSdk) {
          // Credenciales OK pero el SDK no cargó (CDN inalcanzable). NO es modo local
          // "normal": los datos se guardan solo acá y no se sincronizan. Avisamos fuerte.
          this.sdkFailed = true;
          console.error('[KineApp] No se pudo cargar el SDK de Supabase. Modo local SIN sincronización — revisá la conexión y recargá.');
        }
      }
      return { mode: this.mode, user: this.user };
    },

    async signIn(email, password) {
      if (!this.isCloud) return { error: null };
      const { data, error } = await this._sb.auth.signInWithPassword({ email, password });
      if (!error) this.user = data.user;
      return { data, error };
    },
    async signOut() {
      if (this.isCloud) await this._sb.auth.signOut();
      this.user = null;
    },

    // ---------- carga inicial ----------
    async load() {
      if (this.isCloud) {
        try {
          await this._loadCloud();
          this._detectLocalBackup();   // ¿quedaron datos atrapados en este dispositivo?
          this._saveCloudSnapshot();   // copia local de la nube (red de seguridad)
        } catch (e) {
          // Si la nube falla (sin schema, RLS, red), no rompemos: caemos a local.
          console.error('[KineApp] No se pudo cargar desde Supabase, usando modo local:', e);
          this.isCloud = false;
          this.mode = 'local';
          this.cloudError = (e && e.message) || 'Error de conexión';
          this._loadLocal(true);   // true = vino de fallo cloud -> no sembrar demo
        }
      } else {
        this._loadLocal();
      }
      this.reindex();
    },

    async _loadCloud() {
      this.missingTables = new Set();
      for (const [key, table] of Object.entries(TABLES)) {
        try {
          const rows = await this._fetchAll(table);
          this.state[key] = rows.map(r => fromRow(key, r));
        } catch (e) {
          // Tabla que todavía no existe (ej. 'profesionales' si no corrieron el schema
          // nuevo): se ignora esa tabla, NO se cae todo el modo cloud. Errores reales
          // (red/RLS) sí se propagan para que load() caiga a local.
          if (_isMissingTableError(e)) {
            console.warn('[KineApp] Tabla "' + table + '" no existe todavía (corré el schema actualizado). Se ignora por ahora.');
            this.missingTables.add(table);
            this.state[key] = [];
          } else {
            throw e;
          }
        }
      }
    },

    // ---------- migración: datos atrapados en este dispositivo ----------
    // Si el dispositivo estuvo en modo local (sin nube) y guardó datos, quedan en
    // localStorage sin sincronizar. Los detectamos para ofrecer subirlos.
    _detectLocalBackup() {
      this.localBackup = null;
      this.localBackupCounts = null;
      this.localBackupTotal = 0;
      try {
        const raw = localStorage.getItem('kineapp:db');
        if (!raw) return;
        const db = JSON.parse(raw);
        const counts = {};
        let total = 0;
        for (const key of Object.keys(TABLES)) {
          const n = (db[key] || []).length;
          if (n) { counts[key] = n; total += n; }
        }
        if (total > 0) { this.localBackup = db; this.localBackupCounts = counts; this.localBackupTotal = total; }
      } catch (_) { /* ignorar backup corrupto */ }
    },

    // Sube a la nube los datos locales (upsert por id, idempotente). Respeta el orden
    // de dependencias (FK): primero catálogos y pacientes, después turnos/pagos.
    async pushLocalToCloud() {
      if (!this.isCloud || !this._sb) return { ok: false, subidos: 0, errores: ['No hay conexión a la nube'] };
      if (!this.localBackup) return { ok: true, subidos: 0, errores: [] };
      const db = this.localBackup;
      const order = ['obrasSociales', 'servicios', 'tarifas', 'profesionales', 'gastos', 'pacientes', 'turnos', 'pagos'];
      let subidos = 0; const errores = [];
      for (const key of order) {
        if (!TABLES[key]) continue;
        // Si la tabla no existe en la nube (migración pendiente), no intentamos subir:
        // erroraría y abortaría toda la migración.
        if (this.missingTables && this.missingTables.has(TABLES[key])) continue;
        const rows = (db[key] || []).filter(r => r && r.id);
        if (!rows.length) continue;
        const payload = rows.map(r => toRow(key, r));
        // ignoreDuplicates: si un id ya existe en la nube, NO se pisa (cumple "no se borra
        // ni se pisa lo existente"). Sólo agrega lo que falta.
        const { error } = await this._sb.from(TABLES[key]).upsert(payload, { onConflict: 'id', ignoreDuplicates: true });
        if (error) errores.push(TABLES[key] + ': ' + error.message);
        else subidos += rows.length;
      }
      if (!errores.length) {
        // Ya subió todo: limpiamos el backup local para no re-ofrecer. El recargado desde
        // la nube es best-effort: si la red falla acá, los datos YA quedaron arriba igual.
        localStorage.removeItem('kineapp:db');
        this.localBackup = null; this.localBackupTotal = 0;
        try { await this._loadCloud(); this.reindex(); } catch (_) { /* recarga best-effort */ }
      }
      return { ok: errores.length === 0, subidos, errores };
    },

    // ---------- copia de seguridad (red contra borrados accidentales) ----------
    // Snapshot local automático de los datos de la nube en cada carga.
    _saveCloudSnapshot() {
      try {
        const tables = {};
        for (const key of Object.keys(TABLES)) tables[key] = this.state[key];
        let total = 0; for (const key of Object.keys(TABLES)) total += (tables[key] || []).length;
        if (total === 0) return; // no pisar una copia buena con una vacía
        localStorage.setItem('kineapp:cloud-backup', JSON.stringify({ savedAt: new Date().toISOString(), tables }));
      } catch (_) { /* localStorage lleno: no es crítico */ }
    },
    getCloudSnapshotInfo() {
      try {
        const snap = JSON.parse(localStorage.getItem('kineapp:cloud-backup') || 'null');
        if (!snap) return null;
        let total = 0; for (const key of Object.keys(TABLES)) total += ((snap.tables || {})[key] || []).length;
        return { savedAt: snap.savedAt, total };
      } catch (_) { return null; }
    },

    // Devuelve TODOS los datos para descargar como archivo de respaldo.
    exportBackup() {
      const tables = {};
      for (const key of Object.keys(TABLES)) tables[key] = this.state[key];
      return { app: 'kineapp', version: 1, exportedAt: new Date().toISOString(), tables };
    },

    // Restaura un backup. upsert ignoreDuplicates: AGREGA lo que falte, nunca pisa ni borra.
    async importBackup(data) {
      const tables = (data && data.tables) || {};
      const order = ['obrasSociales', 'servicios', 'tarifas', 'profesionales', 'gastos', 'pacientes', 'turnos', 'pagos'];
      let agregados = 0; const errores = [];
      for (const key of order) {
        if (!TABLES[key]) continue;
        const rows = (tables[key] || []).filter(r => r && r.id);
        if (!rows.length) continue;
        if (this.isCloud) {
          if (this.missingTables && this.missingTables.has(TABLES[key])) continue;
          const payload = rows.map(r => toRow(key, r));
          const { error } = await this._sb.from(TABLES[key]).upsert(payload, { onConflict: 'id', ignoreDuplicates: true });
          if (error) errores.push(TABLES[key] + ': ' + error.message);
          else agregados += rows.length;
        } else {
          // Local: AGREGAR sólo lo que falta (mismo contrato que ignoreDuplicates en la
          // nube). NO pisar filas existentes con la versión del backup (podría ser vieja).
          const existentes = new Set(this.state[key].map(x => x.id));
          rows.forEach(r => { if (!existentes.has(r.id)) { this._upsertCache(key, r); agregados++; } });
        }
      }
      if (!errores.length) {
        if (this.isCloud) { try { await this._loadCloud(); } catch (_) {} } else this._persistLocal();
        this.reindex();
      }
      return { ok: errores.length === 0, agregados, errores };
    },

    // Supabase corta en 1000 filas/consulta -> traemos por páginas.
    async _fetchAll(table) {
      const PAGE = 1000;
      let from = 0, all = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await this._sb.from(table).select('*').range(from, from + PAGE - 1);
        if (error) throw error;
        all = all.concat(data);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },

    _loadLocal(fromCloudFail) {
      const raw = localStorage.getItem('kineapp:db');
      if (raw) {
        try {
          const db = JSON.parse(raw);
          for (const key of Object.keys(TABLES)) this.state[key] = db[key] || [];
          return;
        } catch (_) { /* corrupto -> reseed */ }
      }
      const cfg = window.KINE_CONFIG || {};
      const haveCreds = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
      if (fromCloudFail || haveCreds) {
        // Instalación REAL (hay credenciales) o caída desde cloud: NUNCA sembrar los
        // pacientes/turnos demo. Si no, después se ofrecerían para "subir a la nube" como
        // datos basura. Arrancamos vacíos.
        for (const key of Object.keys(TABLES)) this.state[key] = [];
        return;
      }
      this._seedLocal();   // sólo demo puro: sin backend configurado en config.js
    },

    _persistLocal() {
      if (this.isCloud) return;
      const db = {};
      for (const key of Object.keys(TABLES)) db[key] = this.state[key];
      try { localStorage.setItem('kineapp:db', JSON.stringify(db)); }
      catch (e) { console.warn('[KineApp] localStorage lleno:', e); }
    },

    // ---------- mutaciones ----------
    // Insertan/actualizan EN EL LUGAR (sin reasignar arrays) y persisten.
    async add(key, obj) {
      if (!obj.id) obj.id = uuid();
      this._upsertCache(key, obj);
      this.lastWriteError = null;
      if (this.isCloud) {
        const { error } = await this._sb.from(TABLES[key]).insert(toRow(key, obj));
        if (error) { console.error('[KineApp] insert', key, error); this.lastWriteError = error; }
      } else this._persistLocal();
      return obj;
    },

    async update(key, id, fields) {
      const cur = this.state[key].find(x => x.id === id);
      if (cur) Object.assign(cur, fields);
      this.reindex();
      if (this.isCloud) {
        const { error } = await this._sb.from(TABLES[key]).update(toRow(key, fields)).eq('id', id);
        if (error) console.error('[KineApp] update', key, error);
      } else this._persistLocal();
      return cur;
    },
    // alias semántico
    patch(key, id, fields) { return this.update(key, id, fields); },

    // Borrado RECUPERABLE: la fila va a la papelera y se la saca de su tabla. Se puede
    // restaurar o eliminar definitivamente desde la papelera. Si la papelera todavía no
    // está migrada, cae a borrado normal (para no romper el borrado).
    async remove(key, id) {
      const arr = this.state[key];
      const i = arr.findIndex(x => x.id === id);
      const removed = i >= 0 ? arr[i] : null;
      if (i >= 0) arr.splice(i, 1);
      this.reindex();
      this.lastWriteError = null;

      if (!this.isCloud) {
        if (removed) this._localTrashAdd(key, removed);   // papelera local
        this._persistLocal();
        return { error: null };
      }

      // 1) Guardar copia en la papelera (si está disponible).
      if (removed && this.papeleraReady !== false) {
        const entry = {
          id: uuid(), tabla: TABLES[key], registro_id: id,
          datos: toRow(key, removed), nombre: this._labelPapelera(key, removed),
          deleted_at: new Date().toISOString(),
        };
        const ins = await this._sb.from('papelera').insert(entry);
        if (ins.error) {
          if (_isMissingTableError(ins.error)) {
            this.papeleraReady = false;   // papelera no migrada -> borrado normal
          } else {
            // No se pudo respaldar: NO borramos (rollback) para no perder el dato.
            console.error('[KineApp] papelera insert', ins.error);
            this.lastWriteError = ins.error;
            if (removed) { arr.push(removed); this.reindex(); }
            return { error: this.lastWriteError };
          }
        } else {
          this.papeleraReady = true;
        }
      }
      // 2) Borrar la fila de su tabla.
      const { error } = await this._sb.from(TABLES[key]).delete().eq('id', id);
      if (error) {
        console.error('[KineApp] delete', key, error);
        this.lastWriteError = error;
        if (removed) { arr.push(removed); this.reindex(); }
      }
      return { error: this.lastWriteError };
    },

    // ---------- papelera ----------
    _tiposPapelera: { pacientes: 'Paciente', turnos: 'Turno', pagos: 'Pago', gastos: 'Gasto', servicios: 'Servicio', tarifas: 'Tarifa', obrasSociales: 'Obra social', profesionales: 'Profesional' },
    _labelPapelera(key, r) {
      if (!r) return '';
      switch (key) {
        case 'pacientes': return r.nombre || 'Paciente';
        case 'turnos': return `${r.paciente || ''} ${r.fecha || ''} ${r.hora || ''}`.trim() || 'Turno';
        case 'pagos': return `${r.paciente || ''} ${r.concepto || ''}`.trim() || 'Pago';
        case 'gastos': return r.concepto || 'Gasto';
        case 'servicios': return r.nombre || 'Servicio';
        case 'tarifas': return `${r.servicio || ''} / ${r.concepto || ''}`.trim() || 'Tarifa';
        case 'obrasSociales': return r.nombre || 'Obra social';
        case 'profesionales': return r.nombre || 'Profesional';
        default: return r.nombre || '';
      }
    },
    async fetchTrash() {
      if (!this.isCloud) return { ready: true, items: this._localTrashLoad().map(e => ({ id: e.id, tabla: e.tabla, key: e.key, nombre: e.nombre, deleted_at: e.deleted_at })) };
      const { data, error } = await this._sb.from('papelera').select('*').order('deleted_at', { ascending: false }).limit(500);
      if (error) {
        if (_isMissingTableError(error)) { this.papeleraReady = false; return { ready: false, items: [] }; }
        return { ready: true, items: [], error: error.message };
      }
      this.papeleraReady = true;
      return { ready: true, items: (data || []).map(d => ({ id: d.id, tabla: d.tabla, key: DB_TO_KEY[d.tabla], nombre: d.nombre, deleted_at: d.deleted_at })) };
    },
    async restoreItem(papeleraId) {
      if (!this.isCloud) return this._localTrashRestore(papeleraId);
      const { data, error } = await this._sb.from('papelera').select('*').eq('id', papeleraId).single();
      if (error || !data) return { ok: false, error: (error && error.message) || 'No encontrado' };
      const key = DB_TO_KEY[data.tabla];
      if (!key) return { ok: false, error: 'Tabla desconocida' };
      const up = await this._sb.from(data.tabla).upsert(data.datos, { onConflict: 'id' });
      if (up.error) return { ok: false, error: up.error.message };
      await this._sb.from('papelera').delete().eq('id', papeleraId);
      this._upsertCache(key, fromRow(key, data.datos));
      return { ok: true, key, nombre: data.nombre };
    },
    async purgeItem(papeleraId) {
      if (!this.isCloud) return this._localTrashPurge(papeleraId);
      const { error } = await this._sb.from('papelera').delete().eq('id', papeleraId);
      return { ok: !error, error: error && error.message };
    },
    // papelera local (modo sin nube)
    _localTrashLoad() { try { return JSON.parse(localStorage.getItem('kineapp:papelera') || '[]'); } catch (_) { return []; } },
    _localTrashSave(a) { try { localStorage.setItem('kineapp:papelera', JSON.stringify(a)); } catch (_) {} },
    _localTrashAdd(key, row) {
      const a = this._localTrashLoad();
      a.unshift({ id: uuid(), tabla: TABLES[key], key, registro_id: row.id, datos: row, nombre: this._labelPapelera(key, row), deleted_at: new Date().toISOString() });
      this._localTrashSave(a);
    },
    _localTrashRestore(pid) {
      const a = this._localTrashLoad(); const e = a.find(x => x.id === pid);
      if (!e) return { ok: false, error: 'No encontrado' };
      this._upsertCache(e.key, e.datos);
      this._localTrashSave(a.filter(x => x.id !== pid));
      this._persistLocal();
      return { ok: true, key: e.key, nombre: e.nombre };
    },
    _localTrashPurge(pid) {
      this._localTrashSave(this._localTrashLoad().filter(x => x.id !== pid));
      return { ok: true };
    },

    // Inserta o reemplaza por id dentro del array del cache (idempotente).
    _upsertCache(key, obj) {
      const arr = this.state[key];
      const i = arr.findIndex(x => x.id === obj.id);
      if (i >= 0) arr[i] = obj; else arr.push(obj);
      this.reindex();
    },

    // ---------- realtime ----------
    subscribeRealtime() {
      if (!this.isCloud) return;
      if (this._chan) { try { this._sb.removeChannel(this._chan); } catch (_) {} }  // evita canales duplicados
      const chan = this._sb.channel('kineapp-db');
      for (const table of Object.values(TABLES)) {
        chan.on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
          this._applyRemote(table, payload);
        });
      }
      chan.subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[KineApp] Realtime no disponible (' + status + '): los cambios de otros usuarios no se reflejarán en vivo hasta recargar.');
        }
      });
      this._chan = chan;
    },

    _applyRemote(table, payload) {
      const key = DB_TO_KEY[table];
      if (!key) return;
      const arr = this.state[key];
      if (payload.eventType === 'DELETE') {
        const id = payload.old?.id;
        const i = arr.findIndex(x => x.id === id);
        if (i >= 0) arr.splice(i, 1);
      } else {
        const obj = fromRow(key, payload.new);
        const i = arr.findIndex(x => x.id === obj.id);
        if (i >= 0) arr[i] = obj; else arr.push(obj);
      }
      this.reindex();
      if (this.onChange) this.onChange(key);
    },

    // ---------- modo local SIN datos de ejemplo ----------
    // (Antes había pacientes/obras sociales/turnos/gastos de muestra. Se quitaron: la app
    //  arranca vacía y sólo muestra datos reales cargados por el centro.)
    _seedLocal() {
      for (const key of Object.keys(TABLES)) this.state[key] = [];
      this._persistLocal();
    },
  };

  window.store = store;
})();
