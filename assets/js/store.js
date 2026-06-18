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

  // =====================================================================
  const store = {
    state: { pacientes: [], turnos: [], pagos: [], gastos: [], servicios: [], tarifas: [], obrasSociales: [] },
    mode: 'local',          // 'cloud' | 'local'
    isCloud: false,
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
      const haveSdk = typeof window.supabase !== 'undefined' && window.supabase.createClient;
      if (cfg.supabaseUrl && cfg.supabaseAnonKey && haveSdk) {
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
        if (cfg.supabaseUrl && !haveSdk) {
          console.warn('[KineApp] SDK de Supabase no cargó; usando modo local.');
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
      if (this.isCloud) await this._loadCloud();
      else this._loadLocal();
      this.reindex();
    },

    async _loadCloud() {
      for (const [key, table] of Object.entries(TABLES)) {
        const rows = await this._fetchAll(table);
        this.state[key] = rows.map(r => fromRow(key, r));
      }
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

    _loadLocal() {
      const raw = localStorage.getItem('kineapp:db');
      if (raw) {
        try {
          const db = JSON.parse(raw);
          for (const key of Object.keys(TABLES)) this.state[key] = db[key] || [];
          return;
        } catch (_) { /* corrupto -> reseed */ }
      }
      this._seedLocal();
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
      if (this.isCloud) {
        const { error } = await this._sb.from(TABLES[key]).insert(toRow(key, obj));
        if (error) console.error('[KineApp] insert', key, error);
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

    async remove(key, id) {
      const arr = this.state[key];
      const i = arr.findIndex(x => x.id === id);
      if (i >= 0) arr.splice(i, 1);
      this.reindex();
      if (this.isCloud) {
        const { error } = await this._sb.from(TABLES[key]).delete().eq('id', id);
        if (error) console.error('[KineApp] delete', key, error);
      } else this._persistLocal();
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
      const chan = this._sb.channel('kineapp-db');
      for (const table of Object.values(TABLES)) {
        chan.on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
          this._applyRemote(table, payload);
        });
      }
      chan.subscribe();
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

    // ---------- seed modo local ----------
    _seedLocal() {
      const OS = [
        ['OSDE', '80%', 'Rehabilitación, Pilates', '0800-555-6733', 4000, 8000],
        ['Swiss Medical', '70%', 'Rehabilitación', '0810-888-7946', 3500, 6000],
        ['Medifé', '75%', 'Rehabilitación, Readaptación', '0810-555-6334', 3800, 7000],
        ['Galeno', '65%', 'Rehabilitación', '0800-222-6200', 3200, 5000],
      ].map(([nombre, cobertura, servicios, contacto, montoPorSesion, adicional10]) =>
        ({ id: uuid(), nombre, cobertura, servicios, contacto, montoPorSesion, adicional10 }));

      this.state.obrasSociales = OS;
      this.state.servicios = [
        ['Rehabilitación', 'Tratamiento kinesiológico de lesiones', '🦴', 'blue'],
        ['Readaptación', 'Vuelta al deporte post-lesión', '🏃', 'teal'],
        ['Entrenamiento funcional', 'Acondicionamiento físico especializado', '💪', 'green'],
        ['Pilates', 'Pilates clínico y terapéutico', '🧘', 'purple'],
        ['Recovery', 'Presoterapia, crioterapia y más', '❄️', 'orange'],
      ].map(([nombre, desc, icono, color]) => ({ id: uuid(), nombre, desc, icono, color }));

      this.state.pacientes = [
        { nombre: 'Martina López', tel: '261-555-1234', deporte: 'Running', servicio: 'Rehabilitación', motivo: 'Dolor rodilla', lesion: 'Condromalacia rotuliana', prof: 'Lic. García', sesiones: 12, sesionesAuth: 15, deuda: 0, estado: 'pagado', tipoCobertura: 'obra_social', obraSocialId: OS[0].id },
        { nombre: 'Carlos Herrera', tel: '261-555-5678', deporte: 'Fútbol', servicio: 'Readaptación', motivo: 'Post-cirugía', lesion: 'Rotura LCA', prof: 'Lic. Romero', sesiones: 8, sesionesAuth: 20, deuda: 15000, estado: 'pendiente', tipoCobertura: 'particular', obraSocialId: null },
        { nombre: 'Sofía Mendez', tel: '261-555-9012', deporte: 'Pilates', servicio: 'Pilates', motivo: 'Fortalecimiento', lesion: 'Lumbalgia crónica', prof: 'Lic. Paz', sesiones: 20, sesionesAuth: null, deuda: 0, estado: 'pagado', tipoCobertura: 'obra_social', obraSocialId: OS[1].id },
        { nombre: 'Diego Ramos', tel: '261-555-3456', deporte: 'Natación', servicio: 'Recovery', motivo: 'Recuperación', lesion: 'Tendinitis hombro', prof: 'Lic. García', sesiones: 5, sesionesAuth: 10, deuda: 8000, estado: 'pendiente', tipoCobertura: 'particular', obraSocialId: null },
        { nombre: 'Ana Torres', tel: '261-555-7890', deporte: 'Vóley', servicio: 'Rehabilitación', motivo: 'Dolor tobillo', lesion: 'Esguince grado II', prof: 'Lic. Romero', sesiones: 3, sesionesAuth: 10, deuda: 0, estado: 'pagado', tipoCobertura: 'obra_social', obraSocialId: OS[2].id },
        { nombre: 'Lucas Gómez', tel: '261-555-2345', deporte: 'Ciclismo', servicio: 'Entrenamiento funcional', motivo: 'Rendimiento', lesion: '—', prof: 'Lic. Paz', sesiones: 15, sesionesAuth: null, deuda: 0, estado: 'pagado', tipoCobertura: 'particular', obraSocialId: null },
      ].map((p, i) => ({ id: uuid(), dni: String(30100000 + i * 234567), email: '', edad: '', antecedentes: '', evaluacion: '', objetivo: '', etapaActual: '', planRehab: '', progresion: '', observaciones: '', totalPagar: 0, fotoMedico: null, ...p }));

      this.state.tarifas = [
        ['Rehabilitación', 'Sesión individual', 5000],
        ['Rehabilitación', 'Pack 10 sesiones', 45000],
        ['Pilates', 'Sesión individual', 4000],
        ['Pilates', 'Pack mensual (8 sesiones)', 28000],
        ['Recovery', 'Presoterapia (30 min)', 6000],
        ['Readaptación', 'Sesión individual', 5500],
        ['Entrenamiento funcional', 'Sesión individual', 4500],
      ].map(([servicio, concepto, monto]) => ({ id: uuid(), servicio, concepto, monto }));

      const fechaRel = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().split('T')[0]; };
      this.state.gastos = [
        ['Alquiler local', 'Infraestructura', 180000, 5, true],
        ['Luz', 'Servicios', 28000, 10, true],
        ['Internet', 'Servicios', 12000, 15, false],
        ['Sueldo Lic. García', 'Sueldos', 250000, 12, false],
        ['Sueldo Lic. Romero', 'Sueldos', 230000, 12, false],
        ['Sueldo Lic. Paz', 'Sueldos', 220000, 12, false],
        ['Insumos y materiales', 'Insumos', 35000, 8, true],
        ['Seguro del local', 'Infraestructura', 18000, 3, true],
      ].map(([concepto, categoria, monto, dv, pagado]) => ({ id: uuid(), concepto, categoria, monto, vencimiento: fechaRel(dv), pagado }));

      this.state.turnos = this._seedTurnos();
      this._persistLocal();
    },

    _seedTurnos() {
      const pacs = this.state.pacientes;
      const servs = ['rehab', 'gym', 'pilates', 'recovery', 'rehab', 'gym'];
      const servName = ['Rehabilitación', 'Readaptación', 'Pilates', 'Recovery'];
      const horas = ['09:00', '09:45', '10:30', '11:15', '14:00', '15:00', '16:00', '17:00'];
      const hoy = new Date();
      const turnos = [];
      for (let d = -1; d <= 5; d++) {
        const fecha = new Date(hoy); fecha.setDate(hoy.getDate() + d);
        if (fecha.getDay() === 0) continue;
        const fechaStr = fecha.toISOString().split('T')[0];
        const qty = Math.floor(Math.random() * 4) + 3;
        for (let i = 0; i < qty; i++) {
          const p = pacs[i % pacs.length];
          turnos.push({
            id: uuid(), pacienteId: p.id, paciente: p.nombre, fecha: fechaStr,
            hora: horas[i % horas.length], duracion: [30, 45, 60][i % 3],
            servicio: servName[i % servName.length], servClass: servs[i % servs.length],
            prof: p.prof, asistencia: null,
          });
        }
      }
      return turnos;
    },
  };

  window.store = store;
})();
