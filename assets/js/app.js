// =====================================================================
// KineApp — UI / render layer
// =====================================================================
// Los datos viven en `store` (assets/js/store.js): Supabase en modo cloud
// (multi-usuario + realtime) o localStorage en modo local (demo).
// El render lee `state` (= store.state) de forma síncrona; las mutaciones
// pasan por store.add/update/patch/remove (async + persistencia + sync).
// =====================================================================

let state = store.state;            // alias al cache del store
state.currentPage = 'dashboard';

const PAC_PAGE_SIZE = 50;           // paginación de la tabla de pacientes

// ---- defaults / normalización de ficha clínica ----
const pacienteDefaults = {
  email: '', edad: '', antecedentes: '', evaluacion: '', objetivo: '',
  etapaActual: '', planRehab: '', progresion: '', observaciones: ''
};

function deducirEtapaPaciente(paciente) {
  if (paciente.etapaActual) return paciente.etapaActual;
  const sesiones = paciente.sesiones || 0;
  if (sesiones === 0) return 'Evaluación inicial';
  if (sesiones <= 2) return 'Control del dolor';
  if (sesiones <= 5) return 'Movilidad y activación';
  if (sesiones <= 10) return 'Fortalecimiento';
  if (sesiones <= 15) return 'Readaptación funcional';
  return 'Retorno al deporte';
}
function normalizarPaciente(paciente) {
  const n = { ...pacienteDefaults, ...paciente };
  if (!n.etapaActual) n.etapaActual = deducirEtapaPaciente(n);
  return n;
}

let currentInformePacienteId = null;

// ===== AUTH (usuario + contraseña + roles) =====
let currentUser = null;                    // { username, nombre, role }
const SESSION_KEY = 'kineapp:session';
const USERS_DEFAULT = [
  { username: 'Marcos',   password: '2026',         role: 'admin', nombre: 'Marcos' },
  { username: 'kinesico', password: 'kinesico1234', role: 'staff', nombre: 'Kinesiólogo' },
];
function getUsers() {
  return (window.KINE_USERS && window.KINE_USERS.length) ? window.KINE_USERS : USERS_DEFAULT;
}
function publicUser(u) { return { username: u.username, nombre: u.nombre || u.username, role: u.role || 'staff' }; }
function isAdmin() { return !!currentUser && currentUser.role === 'admin'; }
function findUser(username, password) {
  const u = (username || '').trim().toLowerCase();
  return getUsers().find(x => x.username.toLowerCase() === u && x.password === password) || null;
}
function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    const u = getUsers().find(x => x.username.toLowerCase() === (s.username || '').toLowerCase());
    if (u) currentUser = publicUser(u);
  } catch (_) { /* sesión corrupta -> pide login */ }
}

// ===== BOOT =====
async function boot() {
  await store.init();
  restoreSession();
  if (!currentUser) { showLogin(); return; }
  await startApp();
}

async function startApp() {
  document.getElementById('login-overlay')?.classList.remove('open');
  await store.load();
  store.onChange = handleStoreChange;
  store.subscribeRealtime();
  applyRolePermissions();
  renderConnStatus();
  renderSyncBanner();
  navigate('dashboard');
}

// Banner de sincronización: aviso fuerte cuando (a) no hay nube y los datos quedan
// solo en este equipo, o (b) hay datos locales que se pueden subir a la nube.
function renderSyncBanner() {
  const b = document.getElementById('sync-banner');
  if (!b) return;
  if (store.sdkFailed) {
    b.style.display = 'block';
    b.style.background = '#fdecea'; b.style.color = '#a32219';
    b.innerHTML = '⚠️ <strong>Sin conexión con la nube.</strong> Lo que cargues se guarda solo en este equipo y NO se sincroniza con los demás. Revisá tu conexión a internet y volvé a abrir la app. <button class="btn btn-sm" style="margin-left:8px" onclick="location.reload()">Reintentar</button>';
  } else if (store.isCloud && store.localBackup && store.localBackupTotal > 0) {
    const n = store.localBackupTotal;
    b.style.display = 'block';
    b.style.background = '#fff4e0'; b.style.color = '#8a5300';
    b.innerHTML = `📤 Hay <strong>${n}</strong> registro${n !== 1 ? 's' : ''} guardado${n !== 1 ? 's' : ''} solo en este dispositivo (no están en la nube). <button class="btn btn-sm btn-primary" style="margin-left:8px" onclick="subirDatosLocales()">Subir a la nube ahora</button>`;
  } else {
    b.style.display = 'none';
  }
}

async function subirDatosLocales() {
  if (!store.localBackup) { renderSyncBanner(); return; }
  const c = store.localBackupCounts || {};
  const detalle = Object.entries(c).map(([k, v]) => `${v} ${k}`).join(', ');
  if (!confirm(`¿Subir los datos de este dispositivo a la nube?\n\n(${detalle})\n\nSe agregan a lo que ya esté online. No se pisa ni se borra lo existente.`)) return;
  const btn = document.querySelector('#sync-banner button'); if (btn) { btn.disabled = true; btn.textContent = 'Subiendo…'; }
  let r;
  try {
    r = await store.pushLocalToCloud();
  } catch (e) {
    alert('Hubo un error al subir. Revisá la conexión y reintentá.\n' + ((e && e.message) || e));
    renderSyncBanner();
    return;
  }
  if (r.ok) {
    alert(`Listo: se subieron ${r.subidos} registros a la nube. Ya los ven todos los dispositivos.`);
    renderSyncBanner();
    renderPage(state.currentPage);
  } else {
    alert('Algunos datos no se pudieron subir:\n' + (r.errores || []).join('\n') + '\n\nVolvé a intentar.');
    renderSyncBanner();
  }
}

// Páginas que sólo ve el admin (las dos secciones de plata).
const ADMIN_ONLY_PAGES = ['cobranzas', 'pagos'];
// Accesos de navegación (sidebar / "Más" / bottom-nav) a ocultar para staff.
// nav + cards financieras (pagos pendientes / movimientos de caja del dashboard)
const ADMIN_ONLY_NAV = ['nav-admin-section', 'nav-cobranzas', 'mas-cobranzas', 'nav-pagos', 'bnav-pagos', 'card-pend', 'card-caja'];

// Mostrar/ocultar lo que depende del rol (Cobranzas y Gastos: solo admin).
function applyRolePermissions() {
  const admin = isAdmin();
  ADMIN_ONLY_NAV.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = admin ? '' : 'none';
  });
}

// Fuerza a bajar la ÚLTIMA versión: desregistra el service worker, limpia la caché del
// PWA y recarga desde la red. Útil cuando una actualización tarda en impactar en el equipo.
async function actualizarApp() {
  document.querySelectorAll('.btn-actualizar').forEach(b => { b.textContent = 'Actualizando…'; b.style.pointerEvents = 'none'; });
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    if (window.caches) {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    }
  } catch (_) { /* seguimos igual */ }
  setTimeout(() => location.reload(), 150);
}

function renderConnStatus() {
  const el = document.getElementById('conn-status');
  if (!el) return;
  const modo = store.isCloud
    ? '<span class="conn-dot online"></span> Conectado'
    : (store.sdkFailed
        ? '<span class="conn-dot local"></span> ⚠️ Sin nube (datos solo en este equipo)'
        : (store.cloudError
            ? '<span class="conn-dot local"></span> Modo local · falta correr el schema'
            : '<span class="conn-dot local"></span> Modo local'));
  const user = currentUser
    ? `<div class="conn-user">
         <span class="conn-user-name">👤 ${escapeHtml(currentUser.nombre)}</span>
         <span class="role-badge ${currentUser.role}">${currentUser.role === 'admin' ? 'Admin' : 'Staff'}</span>
         <button class="btn-logout" onclick="doLogout()">Salir</button>
       </div>` : '';
  el.innerHTML = `${user}<div class="conn-mode">${modo}</div>`;

  // Versión mobile: quién está logueado, dentro del menú "Más".
  const masUser = document.getElementById('mas-user');
  if (masUser) {
    masUser.innerHTML = currentUser
      ? `<div style="font-weight:600;font-size:14px">👤 ${escapeHtml(currentUser.nombre)} <span class="role-badge ${currentUser.role}">${currentUser.role === 'admin' ? 'Admin' : 'Staff'}</span></div>
         <div style="font-size:12px;color:var(--text-muted);margin-top:3px">${store.isCloud ? '🟢 Conectado' : '🟡 Modo local'}</div>`
      : '';
  }
}

// Cambio remoto (realtime) -> re-render de la vista actual.
function handleStoreChange(_tableKey) {
  if (document.querySelector('.modal-overlay.open')) return; // no romper edición
  renderPage(state.currentPage);
}

// ===== AUTH UI =====
function showLogin() {
  renderConnStatus();
  document.getElementById('login-overlay')?.classList.add('open');
  setTimeout(() => document.getElementById('login-user')?.focus(), 50);
}
async function doLogin() {
  const username = document.getElementById('login-user').value;
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if (!username || !pass) { errEl.textContent = 'Completá usuario y contraseña.'; return; }
  const u = findUser(username, pass);
  if (!u) { errEl.textContent = 'Usuario o contraseña incorrectos.'; return; }
  currentUser = publicUser(u);
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ username: u.username })); } catch (_) {}
  document.getElementById('login-pass').value = '';
  await startApp();
}
async function doLogout() {
  currentUser = null;
  try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
  if (store.isCloud) await store.signOut();
  location.reload();
}

// ===== NAV =====
function navigate(page) {
  // Cobranzas y Gastos son solo para admin (defensa extra; los ítems van ocultos).
  if (ADMIN_ONLY_PAGES.includes(page) && !isAdmin()) page = 'dashboard';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    const oc = n.getAttribute('onclick');
    if (oc && oc.includes("'" + page + "'")) n.classList.add('active');
  });
  document.getElementById('bnav-' + page)?.classList.add('active');
  state.currentPage = page;
  renderPage(page);
}

function toggleMasMenu() {
  const m = document.getElementById('mas-menu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', e => {
  const m = document.getElementById('mas-menu');
  if (m && !m.contains(e.target) && !e.target.closest('#bnav-mas')) m.style.display = 'none';
});

function renderPage(page) {
  if (page === 'dashboard') renderDashboard();
  if (page === 'agenda') renderAgenda();
  if (page === 'pacientes') renderPacientes();
  if (page === 'asistencia') renderAsistencia();
  if (page === 'pagos') renderPagos();
  if (page === 'cobranzas') renderCobranzas();
  if (page === 'recordatorios') renderRecordatorios();
  if (page === 'servicios') renderServicios();
}

// ===== UTILS =====
function isMobile() { return window.innerWidth <= 900; }
function ars(n) { return '$' + (n || 0).toLocaleString('es-AR'); }
// Fecha LOCAL en YYYY-MM-DD (NO usar toISOString: convierte a UTC y de noche
// salta un día respecto de t.fecha, que se guarda en fecha local).
function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
// Normaliza un teléfono argentino a formato internacional para wa.me (prefijo 549).
function telWhatsApp(tel) {
  let n = (tel || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.startsWith('54')) return n;        // ya tiene código de país
  n = n.replace(/^0/, '').replace(/^15/, ''); // saca 0 de larga distancia y 15 de celular local
  return '549' + n;                         // 54 (Arg) + 9 (celular)
}
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function servicioColor(serv) {
  return ({ 'Rehabilitación': 'blue', 'Readaptación': 'teal', 'Pilates': 'purple', 'Recovery': 'orange', 'Entrenamiento funcional': 'green' })[serv] || 'gray';
}
function servicioEmoji(serv) {
  return ({ 'Rehabilitación': '🦴', 'Readaptación': '🏃', 'Pilates': '🧘', 'Recovery': '❄️', 'Entrenamiento funcional': '💪' })[serv] || '📋';
}

// ===== DASHBOARD =====
function renderDashboard() {
  const hoy = new Date();
  document.getElementById('hoy-fecha').textContent =
    hoy.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const fechaHoy = ymd(hoy);
  const turnosHoy = state.turnos.filter(t => t.fecha === fechaHoy);
  document.getElementById('stat-hoy').textContent = turnosHoy.length;
  document.getElementById('stat-pac').textContent = state.pacientes.length;
  const deudores = state.pacientes.filter(p => p.deuda > 0);
  document.getElementById('stat-pend').textContent = deudores.length;

  const list = document.getElementById('turnos-hoy-list');
  list.innerHTML = turnosHoy.length === 0
    ? '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">No hay turnos para hoy</p>'
    : turnosHoy.slice(0, 5).map(t => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:20px;width:28px;text-align:center">${servicioEmoji(t.servicio)}</span>
        <div style="flex:1">
          <div style="font-weight:500;font-size:14px">${escapeHtml(t.paciente)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${t.hora} · ${escapeHtml(t.prof)}</div>
        </div>
        <span class="badge badge-${servicioColor(t.servicio)}">${escapeHtml(t.servicio)}</span>
      </div>`).join('');

  const caja = document.getElementById('caja-list');
  caja.innerHTML = state.pagos.slice(-4).reverse().map(p => `
    <div class="caja-row">
      <div>
        <div style="font-size:14px;font-weight:500">${escapeHtml(p.paciente)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${escapeHtml(p.concepto)} · ${p.fecha}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:600;${p.estado === 'Pagado' ? 'color:var(--green)' : 'color:var(--red)'}">${ars(p.monto)}</div>
        <span class="badge ${p.estado === 'Pagado' ? 'badge-green' : 'badge-red'}">${p.estado}</span>
      </div>
    </div>`).join('');

  const alertasSesiones = state.pacientes.filter(p => {
    if (p.sesionesAuth == null) return false;
    const r = p.sesionesAuth - p.sesiones;
    return r <= 1 && r >= 0;
  });
  const alertasEl = document.getElementById('alertas-sesiones-dash');
  if (alertasSesiones.length > 0) {
    alertasEl.innerHTML = alertasSesiones.map(p => {
      const r = p.sesionesAuth - p.sesiones;
      return `
        <div style="background:${r === 0 ? 'var(--red-light)' : 'var(--orange-light)'};border:1px solid ${r === 0 ? '#fecaca' : '#fed7aa'};border-radius:var(--radius-sm);padding:12px 16px;display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:20px">${r === 0 ? '⛔' : '⚠️'}</span>
          <div style="flex:1"><strong>${escapeHtml(p.nombre)}</strong> —
            ${r === 0 ? '<span style="color:var(--red)">Agotó todas sus sesiones autorizadas</span>'
                      : '<span style="color:var(--orange)">Le queda <strong>1 sesión</strong> autorizada</span>'}</div>
          <button class="btn btn-sm btn-secondary" onclick="navigate('pacientes')">Ver</button>
        </div>`;
    }).join('');
    alertasEl.style.display = 'block';
  } else {
    alertasEl.innerHTML = ''; alertasEl.style.display = 'none';
  }
}

// ===== AGENDA =====
let weekOffset = 0;
let dayOffset = 0;
let filtroActividad = '';   // nombre del servicio filtrado ('' = todos)
let filtroProf = '';        // profesional filtrado ('' = todos)

function changeWeek(dir) {
  if (isMobile()) {
    dayOffset += dir;
    const hoy = new Date();
    const dia = new Date(hoy); dia.setDate(hoy.getDate() + dayOffset);
    if (dia.getDay() === 0) dayOffset += dir;
  } else { weekOffset += dir; }
  renderAgenda();
}
function setFiltroActividad(v) {
  const s = state.servicios.find(x => x.id === v);   // recibe id (o '' para "Todos")
  filtroActividad = s ? s.nombre : v;
  renderAgenda();
}
function setFiltroProf(prof) { filtroProf = prof || ''; renderAgenda(); }

// Chips de filtro por servicio: dinámicos según los servicios registrados.
function renderAgendaFiltros() {
  const cont = document.getElementById('agenda-filtros-serv');
  if (!cont) return;
  let html = `<button class="filtro-act ${filtroActividad === '' ? 'active' : ''}" onclick="setFiltroActividad('')">Todos</button>`;
  html += state.servicios.map(s =>
    `<button class="filtro-act ${filtroActividad === s.nombre ? 'active' : ''}" style="--fc:var(--${s.color || 'primary'})" onclick="setFiltroActividad('${s.id}')">${escapeHtml(s.icono || '')} ${escapeHtml(s.nombre)}</button>`
  ).join('');
  cont.innerHTML = html;
}

// Combo de profesionales: dinámico según turnos y pacientes.
function populateAgendaProf() {
  const sel = document.getElementById('agenda-prof');
  if (!sel) return;
  // Sólo los profesionales registrados en Supabase (no los nombres viejos de turnos).
  const profs = [...new Set(profesionalesEfectivos())].sort();
  sel.innerHTML = '<option value="">Todos los profesionales</option>' + profs.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
  sel.value = filtroProf;
}

function renderAgenda() {
  const hoy = new Date();
  const horas = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
  renderAgendaFiltros();
  populateAgendaProf();

  const slotHtmlFor = (fechaStr) => (hora) => {
    const horaH = parseInt(hora.split(':')[0]);
    const slotTurnos = state.turnos.filter(t =>
      t.fecha === fechaStr &&
      parseInt(t.hora.split(':')[0]) === horaH &&
      (!filtroActividad || t.servicio === filtroActividad) &&
      (!filtroProf || t.prof === filtroProf))
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));   // ordenados por hora
    return slotTurnos.map(t => `
      <div class="turno ${t.servClass}" onclick="event.stopPropagation();mostrarTurno('${t.id}')" title="${escapeHtml(t.paciente)} · ${t.hora}">
        <span class="turno-hora">${t.hora}</span>
        <span class="turno-nombre">${escapeHtml(t.paciente)}</span>
      </div>`).join('');
  };

  if (isMobile()) {
    const dia = new Date(hoy); dia.setDate(hoy.getDate() + dayOffset);
    const diaNom = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    document.getElementById('week-label').textContent =
      `${diaNom[dia.getDay()]} ${dia.getDate()}/${dia.getMonth() + 1}/${dia.getFullYear()}`;
    const fechaStr = ymd(dia);
    const esHoy = dia.toDateString() === hoy.toDateString();
    const slot = slotHtmlFor(fechaStr);
    let html = '<div class="cell agenda-header"></div>';
    html += `<div class="cell agenda-header" style="${esHoy ? 'background:var(--primary-light);color:var(--primary);font-weight:700' : ''}">${diaNom[dia.getDay()]} ${dia.getDate()}</div>`;
    horas.forEach(hora => {
      html += `<div class="cell agenda-time">${hora}</div>`;
      html += `<div class="cell agenda-slot" onclick="abrirNuevoTurno('${fechaStr}','${hora}')">${slot(hora)}
        <div class="slot-add-btn" onclick="event.stopPropagation();abrirNuevoTurno('${fechaStr}','${hora}')">+</div></div>`;
    });
    document.getElementById('agenda-grid').innerHTML = html;
    return;
  }

  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() || 7) - 1) + weekOffset * 7);
  const dias = [];
  for (let i = 0; i < 6; i++) { const d = new Date(lunes); d.setDate(lunes.getDate() + i); dias.push(d); }
  document.getElementById('week-label').textContent =
    `${lunes.getDate()}/${lunes.getMonth() + 1} — ${dias[5].getDate()}/${dias[5].getMonth() + 1}/${dias[5].getFullYear()}`;

  const diaNom = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  let html = '<div class="cell agenda-header"></div>';
  dias.forEach((d, i) => {
    const esHoy = d.toDateString() === hoy.toDateString();
    html += `<div class="cell agenda-header" style="${esHoy ? 'background:var(--primary-light);color:var(--primary);font-weight:700' : ''}">${diaNom[i]} ${d.getDate()}</div>`;
  });
  horas.forEach(hora => {
    html += `<div class="cell agenda-time">${hora}</div>`;
    dias.forEach(d => {
      const fechaStr = ymd(d);
      html += `<div class="cell agenda-slot" onclick="abrirNuevoTurno('${fechaStr}','${hora}')">${slotHtmlFor(fechaStr)(hora)}
        <div class="slot-add-btn" onclick="event.stopPropagation();abrirNuevoTurno('${fechaStr}','${hora}')">+</div></div>`;
    });
  });
  document.getElementById('agenda-grid').innerHTML = html;
}

function abrirNuevoTurno(fecha, hora) {
  document.getElementById('turno-fecha').value = fecha;
  openModal('modal-turno');
  document.getElementById('turno-hora').value = hora;
}

function mostrarTurno(id) {
  const t = state.turnos.find(x => x.id === id);
  if (!t) return;
  const asistLabel = t.asistencia === 'asistio' ? '✅ Asistió'
    : t.asistencia === 'ausente' ? '❌ Ausente'
    : t.asistencia === 'reprog' ? '🔄 Reprogramado' : '— Pendiente';
  document.getElementById('turno-detalle-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div style="font-size:32px">${servicioEmoji(t.servicio)}</div>
      <div>
        <div style="font-size:17px;font-weight:600">${escapeHtml(t.paciente)}</div>
        <div style="font-size:13px;color:var(--text-muted)">${escapeHtml(t.prof)}</div>
      </div>
    </div>
    <div class="grid-2" style="gap:10px;margin-bottom:16px">
      ${cardKV('Fecha y hora', `${t.fecha} · ${t.hora}`)}
      ${cardKV('Duración', `${t.duracion} min`)}
      ${cardKV('Servicio', t.servicio)}
      ${cardKV('Asistencia', asistLabel)}
    </div>
    <div style="background:var(--bg);border-radius:8px;padding:10px;margin-bottom:4px">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);margin-bottom:3px">📝 Observaciones / detalle</div>
      <div style="font-size:14px;${t.notas ? '' : 'color:var(--text-muted)'}">${t.notas ? escapeHtml(t.notas) : 'Sin observaciones cargadas'}</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-sm btn-success" onclick="marcarTurnoAsist('${t.id}','asistio')">✅ Asistió</button>
      <button class="btn btn-sm btn-danger" onclick="marcarTurnoAsist('${t.id}','ausente')">❌ Ausente</button>
      <button class="btn btn-sm btn-secondary" onclick="marcarTurnoAsist('${t.id}','reprog')">🔄 Reprogramar</button>
      <button class="btn btn-sm btn-secondary" onclick="eliminarTurno('${t.id}')" style="margin-left:auto;color:var(--red)">Eliminar</button>
    </div>`;
  openModal('modal-turno-detalle');
}
function cardKV(label, value) {
  return `<div style="background:var(--bg);border-radius:8px;padding:10px">
    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);margin-bottom:3px">${label}</div>
    <div style="font-size:14px;font-weight:500">${escapeHtml(value)}</div></div>`;
}

// Resuelve el paciente de un turno: por id (seguro) o, si falta, por nombre SÓLO si es
// inequívoco (evita ajustar las sesiones del paciente equivocado con nombres repetidos).
function pacienteDeTurno(t) {
  if (t && t.pacienteId) return store.pacienteById(t.pacienteId);
  const m = state.pacientes.filter(p => p.nombre === (t && t.paciente));
  return m.length === 1 ? m[0] : null;
}

// Aplica asistencia a un turno y ajusta las sesiones del paciente (1 sola fuente).
async function setAsistenciaTurno(turnoId, estado) {
  const t = state.turnos.find(x => x.id === turnoId);
  if (!t) return null;
  const eraAsistio = t.asistencia === 'asistio';
  const next = t.asistencia === estado ? null : estado;
  await store.update('turnos', turnoId, { asistencia: next });
  const pac = pacienteDeTurno(t);
  if (pac) {
    if (next === 'asistio' && !eraAsistio) {
      const nuevas = (pac.sesiones || 0) + 1;
      await store.update('pacientes', pac.id, { sesiones: nuevas });
      if (pac.sesionesAuth != null && pac.sesionesAuth - nuevas === 0) setTimeout(() => mostrarCompletado(pac), 300);
    } else if (eraAsistio && next !== 'asistio') {
      await store.update('pacientes', pac.id, { sesiones: Math.max(0, (pac.sesiones || 0) - 1) });
    }
  }
  return next;
}

async function marcarTurnoAsist(id, estado) {
  await setAsistenciaTurno(id, estado);
  mostrarTurno(id);   // refresca el detalle -> feedback inmediato del cambio
  if (state.currentPage === 'agenda') renderAgenda();
  if (state.currentPage === 'dashboard') renderDashboard();
}
async function eliminarTurno(id) {
  if (!confirm('¿Eliminar este turno?')) return;
  const t = state.turnos.find(x => x.id === id);
  // Borrar PRIMERO el turno; si la nube falla, no tocamos las sesiones (evita dejar el
  // contador desincronizado por una escritura que sí entró y otra que no).
  const r = await store.remove('turnos', id);
  if (r && r.error) { alert('No se pudo eliminar el turno (revisá la conexión). Reintentá.'); return; }
  // Turno borrado OK: recién ahora revertimos la sesión que había sumado la asistencia.
  if (t && t.asistencia === 'asistio') {
    const pac = pacienteDeTurno(t);
    if (pac) await store.update('pacientes', pac.id, { sesiones: Math.max(0, (pac.sesiones || 0) - 1) });
  }
  closeModal('modal-turno-detalle');
  renderAgenda();
}

// ===== PACIENTES =====
let pacFiltro = '', pacServFiltro = '', pacPage = 0, pacSearchTimer = null;
let editingPacienteId = null;       // null = alta; id = edición de ese paciente
let pacienteReturnToTurno = false;  // true = el alta vino desde "Nuevo turno"

let pacProfFiltro = '';

function pacientesFiltrados() {
  const f = pacFiltro.toLowerCase();
  return state.pacientes.filter(p => {
    const matchTexto = (p.nombre || '').toLowerCase().includes(f)
      || (p.lesion || '').toLowerCase().includes(f)
      || (p.dni || '').toLowerCase().includes(f);
    const matchServ = !pacServFiltro || p.servicio === pacServFiltro;
    const matchProf = !pacProfFiltro || p.prof === pacProfFiltro;
    return matchTexto && matchServ && matchProf;
  });
}

function renderPacientes() {
  populateServicioSelects();   // filtro de servicios con datos reales
  // Combo "filtrar por profesional": sólo los registrados en Supabase.
  const profSel = document.getElementById('pac-filtro-prof');
  if (profSel) {
    const profs = [...new Set(profesionalesEfectivos())].sort();
    profSel.innerHTML = '<option value="">Todos los profesionales</option>' + profs.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    profSel.value = pacProfFiltro;
  }

  const all = pacientesFiltrados();
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / PAC_PAGE_SIZE));
  if (pacPage >= pages) pacPage = pages - 1;
  const start = pacPage * PAC_PAGE_SIZE;
  const pageItems = all.slice(start, start + PAC_PAGE_SIZE);

  const desktopEl = document.getElementById('pacientes-tabla-desktop');
  const mobileEl = document.getElementById('pacientes-cards-mobile');
  if (desktopEl) desktopEl.style.display = isMobile() ? 'none' : 'block';
  if (mobileEl) mobileEl.style.display = isMobile() ? 'block' : 'none';

  const sesCell = (p) => {
    const r = p.sesionesAuth != null ? p.sesionesAuth - p.sesiones : null;
    const cls = r === 0 ? 'badge-red' : r === 1 ? 'badge-orange' : 'badge-gray';
    const label = p.sesionesAuth != null ? `${p.sesiones}/${p.sesionesAuth} ${r === 0 ? '⛔' : r === 1 ? '⚠️' : ''}` : `${p.sesiones}`;
    return { cls, label, r };
  };

  document.getElementById('tbody-pacientes').innerHTML = pageItems.map(p => {
    const s = sesCell(p);
    return `
    <tr>
      <td><strong>${escapeHtml(p.nombre)}</strong></td>
      <td>${escapeHtml(p.tel)}</td>
      <td><span class="badge badge-${servicioColor(p.servicio)}">${escapeHtml(p.servicio)}</span></td>
      <td>${escapeHtml(p.lesion)}</td>
      <td>${escapeHtml(p.prof)}</td>
      <td style="text-align:center">${p.sesionesAuth != null
        ? `<span class="badge ${s.cls}" style="font-size:12px">${s.label}</span>`
        : `<span style="font-weight:600">${p.sesiones}</span>`}</td>
      <td><span class="badge ${p.deuda > 0 ? 'badge-red' : 'badge-green'}">${p.deuda > 0 ? 'Debe ' + ars(p.deuda) : 'Al día'}</span></td>
      <td style="display:flex;gap:6px">
        <button class="btn btn-sm" style="background:var(--green);color:#fff" onclick="enviarTurnosWpp('${p.id}')" title="Enviar turnos agendados por WhatsApp">📲</button>
        <button class="btn btn-sm btn-secondary" onclick="verPaciente('${p.id}')">Ver ficha</button>
        <button class="btn btn-sm" style="background:var(--red-light);color:var(--red)" onclick="confirmarBorrarPaciente('${p.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');

  if (mobileEl) {
    mobileEl.innerHTML = pageItems.length === 0
      ? '<p style="padding:20px;color:var(--text-muted);text-align:center;font-size:13px">Sin pacientes</p>'
      : pageItems.map(p => {
        const s = sesCell(p);
        const sesColor = s.r === 0 ? 'var(--red)' : s.r === 1 ? 'var(--orange)' : 'var(--primary)';
        const os = p.tipoCobertura === 'obra_social' && p.obraSocialId
          ? (store.state.obrasSociales.find(x => x.id === p.obraSocialId)?.nombre || '') : '';
        return `
        <div class="pac-card">
          <div class="pac-card-top">
            <div>
              <div class="pac-card-nombre">${escapeHtml(p.nombre)}</div>
              <div style="margin-top:3px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <span class="badge badge-${servicioColor(p.servicio)}">${escapeHtml(p.servicio)}</span>
                ${os ? `<span class="badge badge-blue">${escapeHtml(os)}</span>` : '<span class="badge badge-gray">Particular</span>'}
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:18px;font-weight:700;color:${sesColor}">${s.label}</div>
              <div style="font-size:10px;color:var(--text-muted)">sesiones</div>
            </div>
          </div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:6px">🩺 ${escapeHtml(p.lesion || '—')} &nbsp;·&nbsp; 👨 ${escapeHtml(p.prof)}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">☎️ ${escapeHtml(p.tel || '—')}</div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="badge ${p.deuda > 0 ? 'badge-red' : 'badge-green'}">${p.deuda > 0 ? 'Debe ' + ars(p.deuda) : 'Al día'}</span>
            <div class="pac-card-actions">
              <button class="btn btn-sm" style="background:var(--green);color:#fff" onclick="enviarTurnosWpp('${p.id}')">📲 Turnos</button>
              <button class="btn btn-sm btn-secondary" onclick="verPaciente('${p.id}')">Ver ficha</button>
              <button class="btn btn-sm" style="background:var(--red-light);color:var(--red)" onclick="confirmarBorrarPaciente('${p.id}')">✕ Borrar</button>
            </div>
          </div>
        </div>`;
      }).join('');
  }

  // Paginación
  const pagEl = document.getElementById('pac-pagination');
  if (pagEl) {
    if (total <= PAC_PAGE_SIZE) {
      pagEl.innerHTML = `<span style="color:var(--text-muted);font-size:13px">${total} paciente${total !== 1 ? 's' : ''}</span>`;
    } else {
      const desde = start + 1, hasta = Math.min(start + PAC_PAGE_SIZE, total);
      pagEl.innerHTML = `
        <span style="color:var(--text-muted);font-size:13px">${desde}–${hasta} de ${total}</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-secondary" ${pacPage === 0 ? 'disabled' : ''} onclick="pacGoPage(-1)">‹ Anterior</button>
          <span style="font-size:13px;align-self:center">Pág. ${pacPage + 1}/${pages}</span>
          <button class="btn btn-sm btn-secondary" ${pacPage >= pages - 1 ? 'disabled' : ''} onclick="pacGoPage(1)">Siguiente ›</button>
        </div>`;
    }
  }

  // selects de modales (sólo si están vacíos o hay pocos pacientes)
  populatePacienteSelects();
}
function pacGoPage(dir) { pacPage += dir; renderPacientes(); }

function filtrarPacientes(v) {
  clearTimeout(pacSearchTimer);
  pacSearchTimer = setTimeout(() => { pacFiltro = v; pacPage = 0; renderPacientes(); }, 180);
}
function filtrarPorServicio(v) { pacServFiltro = v; pacPage = 0; renderPacientes(); }
function filtrarPorProf(v) { pacProfFiltro = v; pacPage = 0; renderPacientes(); }

function confirmarBorrarPaciente(id) {
  const p = state.pacientes.find(x => x.id === id);
  if (!p) return;
  document.getElementById('borrar-pac-nombre').textContent = p.nombre;
  document.getElementById('borrar-pac-detalle').textContent =
    `${p.sesiones} sesiones · ${store.turnosDePaciente(p.id).length} turnos en agenda`;
  document.getElementById('btn-confirmar-borrar').onclick = () => borrarPaciente(id);
  document.getElementById('modal-borrar-pac').classList.add('open');
}
async function borrarPaciente(id) {
  const p = state.pacientes.find(x => x.id === id);
  if (!p) return;
  // Borrar turnos del paciente y luego el paciente (en cloud el FK cascadea,
  // pero limpiamos el cache localmente para feedback inmediato).
  for (const t of store.turnosDePaciente(id).slice()) await store.remove('turnos', t.id);
  await store.remove('pacientes', id);
  document.getElementById('modal-borrar-pac').classList.remove('open');
  renderPacientes();
}

// ===== ASISTENCIA =====
function renderAsistencia() {
  const fechaInput = document.getElementById('fecha-asist');
  if (!fechaInput.value) fechaInput.value = ymd(new Date());
  const fecha = fechaInput.value;
  const turnosDia = state.turnos.filter(t => t.fecha === fecha);

  let asistio = 0, ausente = 0, reprog = 0;
  turnosDia.forEach(t => {
    if (t.asistencia === 'asistio') asistio++;
    else if (t.asistencia === 'ausente') ausente++;
    else if (t.asistencia === 'reprog') reprog++;
  });
  document.getElementById('asist-count').textContent = asistio;
  document.getElementById('aus-count').textContent = ausente;
  document.getElementById('rep-count').textContent = reprog;

  const list = document.getElementById('asist-list');
  if (turnosDia.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:16px 0;text-align:center">No hay turnos para esta fecha</p>';
    return;
  }
  list.innerHTML = turnosDia.map(t => `
    <div class="asist-row">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:22px">${servicioEmoji(t.servicio)}</span>
        <div>
          <div style="font-weight:500">${escapeHtml(t.paciente)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${t.hora} · ${t.duracion}min · ${escapeHtml(t.prof)}</div>
        </div>
      </div>
      <div class="asist-actions">
        <button class="asist-btn asistio ${t.asistencia === 'asistio' ? 'active-asistio' : ''}" onclick="marcarAsist('${t.id}','asistio')" title="Asistió">✅</button>
        <button class="asist-btn ausente ${t.asistencia === 'ausente' ? 'active-ausente' : ''}" onclick="marcarAsist('${t.id}','ausente')" title="Ausente">❌</button>
        <button class="asist-btn reprog ${t.asistencia === 'reprog' ? 'active-reprog' : ''}" onclick="marcarAsist('${t.id}','reprog')" title="Reprogramar">🔄</button>
      </div>
    </div>`).join('');
}

async function marcarAsist(turnoId, estado) {
  await setAsistenciaTurno(turnoId, estado);
  renderAsistencia();
  if (state.currentPage === 'dashboard') renderDashboard();
}

function mostrarCompletado(pac) {
  document.getElementById('completado-nombre').textContent = pac.nombre;
  document.getElementById('completado-sesiones').textContent = pac.sesionesAuth;
  document.getElementById('modal-completado').classList.add('open');
}

// ===== GASTOS =====
let filtroGastos = 'todos';
const categoriaIcono = { Sueldos: '💼', Infraestructura: '🏢', Servicios: '💡', Insumos: '📦', Impuestos: '🧾', Otros: '📌' };

function setFiltroGastos(btn, filtro) {
  filtroGastos = filtro;
  document.querySelectorAll('#page-pagos .filtro-act').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPagos();
}

function renderPagos() {
  const hoy = new Date();
  const totalPend = state.gastos.filter(g => !g.pagado).reduce((s, g) => s + g.monto, 0);
  const totalPag = state.gastos.filter(g => g.pagado).reduce((s, g) => s + g.monto, 0);
  document.getElementById('gasto-total-pendiente').textContent = ars(totalPend);
  document.getElementById('gasto-total-pagado').textContent = ars(totalPag);
  document.getElementById('gasto-total-mes').textContent = ars(totalPend + totalPag);

  let lista = [...state.gastos];
  if (filtroGastos === 'pendiente') lista = lista.filter(g => !g.pagado);
  if (filtroGastos === 'pagado') lista = lista.filter(g => g.pagado);
  lista.sort((a, b) => {
    if (!a.pagado && b.pagado) return -1;
    if (a.pagado && !b.pagado) return 1;
    return (a.vencimiento || '').localeCompare(b.vencimiento || '');
  });

  const checklist = document.getElementById('gastos-checklist');
  if (lista.length === 0) {
    checklist.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center">No hay gastos para mostrar</p>';
    return;
  }
  const grupos = {};
  lista.forEach(g => { (grupos[g.categoria] = grupos[g.categoria] || []).push(g); });

  checklist.innerHTML = Object.entries(grupos).map(([cat, items]) => `
    <div style="margin-bottom:4px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);padding:8px 4px 4px;display:flex;align-items:center;gap:6px">
        <span>${categoriaIcono[cat] || '📌'}</span> ${escapeHtml(cat)}
      </div>
      ${items.map(g => {
        const venc = g.vencimiento ? new Date(g.vencimiento) : null;
        const vencido = venc && !g.pagado && venc < hoy;
        const vencHoy = venc && !g.pagado && venc.toDateString() === hoy.toDateString();
        return `
          <div class="pago-checklist-item ${g.pagado ? 'cobrado' : ''}" onclick="toggleGasto('${g.id}')">
            <div class="pago-check ${g.pagado ? 'checked' : ''}">${g.pagado ? '✓' : ''}</div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:14px;${g.pagado ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${escapeHtml(g.concepto)}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Vence: ${g.vencimiento || '—'}
                ${vencido ? '<span style="color:var(--red);font-weight:600;margin-left:6px">⚠️ Vencido</span>' : ''}
                ${vencHoy ? '<span style="color:var(--orange);font-weight:600;margin-left:6px">⏳ Hoy</span>' : ''}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700;font-size:15px;${g.pagado ? 'color:var(--text-muted)' : vencido ? 'color:var(--red)' : 'color:var(--text)'}">${g.pagado ? '' : '-'}${ars(g.monto)}</div>
              <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:2px">
                <button onclick="event.stopPropagation();editarGasto('${g.id}')" style="background:none;border:none;cursor:pointer;color:var(--primary);font-size:11px">Editar</button>
                <button onclick="event.stopPropagation();eliminarGasto('${g.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:11px">Eliminar</button>
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`).join('');
}

async function toggleGasto(id) {
  const g = state.gastos.find(x => x.id === id);
  if (g) await store.update('gastos', id, { pagado: !g.pagado });
  renderPagos();
}
let editingGastoId = null;   // null = alta; id = edición de ese gasto

// Abrir el modal para un gasto NUEVO (limpio).
function nuevoGasto() {
  editingGastoId = null;
  document.getElementById('gasto-concepto').value = '';
  document.getElementById('gasto-categoria').value = 'Sueldos';
  document.getElementById('gasto-monto').value = '';
  document.getElementById('gasto-vencimiento').value = '';
  document.getElementById('gasto-estado').value = 'false';
  const t = document.getElementById('gasto-modal-title'); if (t) t.textContent = 'Nuevo gasto';
  document.getElementById('modal-gasto').classList.add('open');
}

// Abrir el modal precargado para EDITAR un gasto (cambiar monto, concepto, etc.).
function editarGasto(id) {
  const g = state.gastos.find(x => x.id === id);
  if (!g) return;
  editingGastoId = id;
  document.getElementById('gasto-concepto').value = g.concepto || '';
  document.getElementById('gasto-categoria').value = g.categoria || 'Otros';
  document.getElementById('gasto-monto').value = g.monto ?? '';
  document.getElementById('gasto-vencimiento').value = g.vencimiento || '';
  document.getElementById('gasto-estado').value = g.pagado ? 'true' : 'false';
  const t = document.getElementById('gasto-modal-title'); if (t) t.textContent = 'Editar gasto';
  document.getElementById('modal-gasto').classList.add('open');
}

async function guardarGasto() {
  const concepto = document.getElementById('gasto-concepto').value.trim();
  if (!concepto) { alert('Ingresá el concepto'); return; }
  const campos = {
    concepto,
    categoria: document.getElementById('gasto-categoria').value,
    monto: parseInt(document.getElementById('gasto-monto').value) || 0,
    vencimiento: document.getElementById('gasto-vencimiento').value || null,
    pagado: document.getElementById('gasto-estado').value === 'true'
  };
  if (editingGastoId) { await store.update('gastos', editingGastoId, campos); editingGastoId = null; }
  else { await store.add('gastos', campos); }
  document.getElementById('gasto-concepto').value = '';
  document.getElementById('gasto-monto').value = '';
  closeModal('modal-gasto');
  renderPagos();
}
async function eliminarGasto(id) {
  const g = state.gastos.find(x => x.id === id);
  if (g && !confirm(`¿Eliminar el gasto "${g.concepto}" de ${ars(g.monto)}?`)) return;
  await store.remove('gastos', id);
  renderPagos();
}

// ===== COBRANZAS =====
function renderCobranzas() {
  const hoyStr = ymd(new Date());
  const mesStr = hoyStr.slice(0, 7);
  const cobradoHoy = state.pagos.filter(p => p.estado === 'Pagado' && p.fecha === hoyStr).reduce((s, p) => s + p.monto, 0);
  const cobradoMes = state.pagos.filter(p => p.estado === 'Pagado' && (p.fecha || '').slice(0, 7) === mesStr).reduce((s, p) => s + p.monto, 0);
  // Total pendiente = suma de la deuda real de cada paciente (coincide con la columna Deuda).
  const totalPendiente = state.pacientes.reduce((s, p) => s + (p.deuda || 0), 0);
  document.getElementById('caja-hoy').textContent = ars(cobradoHoy);
  document.getElementById('caja-mes').textContent = ars(cobradoMes);
  document.getElementById('caja-deuda').textContent = ars(totalPendiente);

  const tablaD = document.getElementById('cobranzas-tabla-desktop');
  const cardsM = document.getElementById('cobranzas-cards-mobile');
  const histD = document.getElementById('cobranzas-hist-desktop');
  const histM = document.getElementById('cobranzas-hist-mobile');
  if (tablaD) tablaD.style.display = isMobile() ? 'none' : 'block';
  if (cardsM) cardsM.style.display = isMobile() ? 'block' : 'none';
  if (histD) histD.style.display = isMobile() ? 'none' : 'block';
  if (histM) histM.style.display = isMobile() ? 'block' : 'none';

  const deudores = state.pacientes.filter(p => p.deuda > 0);
  document.getElementById('alertas-deuda').innerHTML = deudores.map(p => `
    <div class="deuda-alert">
      <span style="font-size:22px">📱</span>
      <div style="flex:1"><strong>${escapeHtml(p.nombre)}</strong> — deuda de <strong>${ars(p.deuda)}</strong>
        <span style="font-size:12px;color:var(--text-muted);margin-left:8px">${escapeHtml(p.servicio)}</span></div>
      <button class="btn btn-sm btn-primary" onclick="abrirCobro('${p.id}')">Cobrar</button>
    </div>`).join('');

  const osBadge = (p) => {
    if (p.tipoCobertura === 'obra_social' && p.obraSocialId) {
      const o = store.state.obrasSociales.find(x => x.id === p.obraSocialId);
      return o ? `<span class="badge badge-blue">${escapeHtml(o.nombre)}</span>` : '—';
    }
    return '<span class="badge badge-gray">Particular</span>';
  };

  document.getElementById('tbody-cobranzas-pacientes').innerHTML = state.pacientes.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.nombre)}</strong></td>
      <td>${escapeHtml(p.servicio)}</td>
      <td>${osBadge(p)}</td>
      <td style="text-align:center">${p.sesiones}</td>
      <td style="${p.deuda > 0 ? 'color:var(--red);font-weight:600' : ''}">${ars(p.deuda)}</td>
      <td><span class="badge ${p.deuda > 0 ? 'badge-red' : 'badge-green'}">${p.deuda > 0 ? 'Pendiente' : 'Al día'}</span></td>
      <td><button class="btn btn-sm btn-primary" onclick="abrirCobro('${p.id}')">Cobrar</button></td>
    </tr>`).join('');

  document.getElementById('tbody-cobranzas-hist').innerHTML = [...state.pagos].reverse().map(p => `
    <tr>
      <td>${p.fecha}</td><td>${escapeHtml(p.paciente)}</td><td>${escapeHtml(p.concepto)}</td>
      <td style="font-weight:600">${ars(p.monto)}</td>
      <td><span class="badge ${p.estado === 'Pagado' ? 'badge-green' : 'badge-red'}">${p.estado}</span></td>
    </tr>`).join('');

  const mobileEl = document.getElementById('cobranzas-cards-mobile');
  if (mobileEl) {
    mobileEl.innerHTML = state.pacientes.map(p => `
      <div class="pac-card">
        <div class="pac-card-top">
          <div>
            <div class="pac-card-nombre">${escapeHtml(p.nombre)}</div>
            <div style="margin-top:3px;display:flex;gap:6px;flex-wrap:wrap">
              <span class="badge badge-${servicioColor(p.servicio)}">${escapeHtml(p.servicio)}</span>${osBadge(p)}
            </div>
          </div>
          <span class="badge ${p.deuda > 0 ? 'badge-red' : 'badge-green'}" style="font-size:13px">${p.deuda > 0 ? ars(p.deuda) : 'Al día'}</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:10px">${p.sesiones} sesiones realizadas</div>
        <button class="btn btn-sm btn-primary" style="width:100%" onclick="abrirCobro('${p.id}')">💸 Cobrar</button>
      </div>`).join('');
  }

  const histMobile = document.getElementById('cobranzas-hist-mobile');
  if (histMobile) {
    histMobile.innerHTML = [...state.pagos].reverse().map(p => `
      <div class="pac-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-weight:600;font-size:14px">${escapeHtml(p.paciente)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${escapeHtml(p.concepto)} · ${p.fecha}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;font-size:15px;${p.estado === 'Pagado' ? 'color:var(--green)' : 'color:var(--red)'}">${ars(p.monto)}</div>
            <span class="badge ${p.estado === 'Pagado' ? 'badge-green' : 'badge-red'}" style="margin-top:4px">${p.estado}</span>
          </div>
        </div>
      </div>`).join('');
  }
}

function switchTab(section, tab) {
  document.querySelectorAll(`#tabs-${section} .tab`).forEach(t => t.classList.remove('active'));
  document.querySelectorAll(`[id^="tab-${section}-"]`).forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(`tab-${section}-${tab}`).classList.add('active');
}

// ===== RECORDATORIOS =====
function formatFechaLarga(fechaStr) {
  try { return new Date(fechaStr + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }); }
  catch (_) { return fechaStr; }
}
function cargarRecConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('kineapp:rec-config') || '{}');
    if (cfg.tiempo1) document.getElementById('rec-tiempo1').value = cfg.tiempo1;
    if (cfg.tiempo2) document.getElementById('rec-tiempo2').value = cfg.tiempo2;
    if (cfg.mensaje) document.getElementById('rec-mensaje').value = cfg.mensaje;
  } catch (_) {}
}
function enviarRecordatorioWpp(turnoId) {
  const t = state.turnos.find(x => x.id === turnoId);
  if (!t) return;
  const pac = t.pacienteId ? store.pacienteById(t.pacienteId) : state.pacientes.find(p => p.nombre === t.paciente);
  const tel = telWhatsApp(pac?.tel);
  if (!tel) { alert('Este paciente no tiene teléfono cargado.\nAgregalo en la ficha para poder enviarle el recordatorio.'); return; }
  const plantilla = document.getElementById('rec-mensaje')?.value
    || 'Hola {nombre}. Te recordamos tu turno para el {fecha} a las {hora} con {profesional}. ¡Nos vemos!';
  const msg = plantilla
    .replace(/{nombre}/g, (pac?.nombre || t.paciente || '').split(' ')[0])
    .replace(/{fecha}/g, formatFechaLarga(t.fecha))
    .replace(/{hora}/g, t.hora)
    .replace(/{profesional}/g, t.prof || '');
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}

// Manda al paciente, por WhatsApp, TODOS sus turnos agendados a futuro (fecha + hora).
function enviarTurnosWpp(pacId) {
  const p = store.pacienteById(pacId);
  if (!p) return;
  const tel = telWhatsApp(p.tel);
  if (!tel) { alert('Este paciente no tiene teléfono cargado.\nAgregalo en la ficha para poder enviarle los turnos.'); return; }
  const hoy = ymd(new Date());
  const turnos = store.turnosDePaciente(pacId)
    .filter(t => t.fecha >= hoy)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  if (!turnos.length) { alert(`${p.nombre} no tiene turnos agendados a futuro.`); return; }
  const lista = turnos.map(t => `• ${formatFechaLarga(t.fecha)} a las ${t.hora} hs`).join('\n');
  const nombre = (p.nombre || '').split(' ')[0];
  const msg = `Hola ${nombre}, te paso tus turnos agendados:\n\n${lista}\n\n¡Te esperamos!`;
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}

function renderRecordatorios() {
  cargarRecConfig();
  const manana = new Date(); manana.setDate(manana.getDate() + 1);
  const manStr = ymd(manana);
  const turnosManana = state.turnos.filter(t => t.fecha === manStr);
  document.getElementById('rec-enviados').textContent = turnosManana.length;

  const prox = document.getElementById('proximos-rec');
  prox.innerHTML = turnosManana.length === 0
    ? '<p style="color:var(--text-muted);font-size:13px">No hay turnos para mañana</p>'
    : turnosManana.map(t => {
        const pac = t.pacienteId ? store.pacienteById(t.pacienteId) : null;
        const tel = (pac?.tel || '').replace(/\D/g, '');
        return `
      <div class="reminder-item">
        <div class="reminder-status pending"></div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${escapeHtml(t.paciente)}</div>
          <div style="font-size:11px;color:var(--text-muted)">Mañana ${t.hora}${tel ? '' : ' · ⚠️ sin teléfono'}</div>
        </div>
        <button class="btn btn-sm btn-success" ${tel ? '' : 'disabled'} onclick="enviarRecordatorioWpp('${t.id}')">📱 Enviar</button>
      </div>`;
      }).join('');

  document.getElementById('hist-rec').innerHTML =
    '<p style="color:var(--text-muted);font-size:13px">Los recordatorios que envíes por WhatsApp van a quedar registrados acá. (El envío hoy es manual desde el botón “Enviar”.)</p>';
}
function guardarRecConfig() {
  const cfg = {
    tiempo1: document.getElementById('rec-tiempo1').value,
    tiempo2: document.getElementById('rec-tiempo2').value,
    mensaje: document.getElementById('rec-mensaje').value,
  };
  try { localStorage.setItem('kineapp:rec-config', JSON.stringify(cfg)); } catch (_) {}
  const sel = document.getElementById('rec-tiempo1');
  alert('✅ Configuración guardada.\n\nEl mensaje y los tiempos quedaron guardados.\nRecordatorio principal: ' + sel.options[sel.selectedIndex].text);
}

// ===== SERVICIOS =====
function renderServicios() {
  document.getElementById('servicios-grid').innerHTML = state.servicios.map(s => {
    const pacs = state.pacientes.filter(p => p.servicio === s.nombre).length;
    const turnos = state.turnos.filter(t => t.servicio === s.nombre).length;
    return `
      <div class="servicio-card" onclick="verServicio('${s.id}')">
        <button class="servicio-del" onclick="event.stopPropagation();eliminarServicio('${s.id}')" title="Eliminar servicio">✕</button>
        <div class="servicio-icon">${escapeHtml(s.icono || '')}</div>
        <h4>${escapeHtml(s.nombre)}</h4>
        <p>${escapeHtml(s.desc)}</p>
        <div style="display:flex;gap:12px;margin-top:12px;align-items:flex-end;justify-content:space-between">
          <div style="display:flex;gap:12px">
            <div><div class="servicio-count" style="color:var(--${s.color || 'primary'})">${pacs}</div><div style="font-size:12px;color:var(--text-muted)">pacientes</div></div>
            <div><div class="servicio-count" style="color:var(--${s.color || 'primary'})">${turnos}</div><div style="font-size:12px;color:var(--text-muted)">turnos totales</div></div>
          </div>
          <span style="font-size:12px;color:var(--primary);font-weight:600">Ver detalle →</span>
        </div>
      </div>`;
  }).join('');

  renderProfesionales();
  renderBackupInfo();

  const tarifasList = document.getElementById('tarifas-list');
  if (state.tarifas.length === 0) {
    tarifasList.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Sin tarifas cargadas.</p>';
  } else {
    const byServicio = {};
    state.tarifas.forEach(t => { (byServicio[t.servicio] = byServicio[t.servicio] || []).push(t); });
    tarifasList.innerHTML = Object.entries(byServicio).map(([serv, items]) => `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">${escapeHtml(serv)}</div>
        ${items.map(t => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg);border-radius:6px;margin-bottom:4px">
            <span style="font-size:13px">${escapeHtml(t.concepto)}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:700;font-size:14px;color:var(--green)">${ars(t.monto)}</span>
              <button onclick="eliminarTarifa('${t.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;padding:2px">✕</button>
            </div>
          </div>`).join('')}
      </div>`).join('');
  }

  const osList = document.getElementById('obras-sociales-list');
  if (state.obrasSociales.length === 0) {
    osList.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Sin obras sociales cargadas.</p>';
  } else {
    osList.innerHTML = state.obrasSociales.map(os => `
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:10px;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--white)">
          <div>
            <div style="font-weight:700;font-size:14px">${escapeHtml(os.nombre)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:1px">${escapeHtml(os.servicios)} · ${escapeHtml(os.contacto)}</div>
          </div>
          <button onclick="eliminarObraSocial('${os.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;padding:2px">✕</button>
        </div>
        <div style="border-top:1px solid var(--border);padding:8px 14px;font-size:13px">
          ${(() => {
            const packs = packsConTarifaDirecta();
            if (!packs.length) return '<span style="color:var(--text-muted)">Cargá las tarifas (arriba) para ver el coseguro.</span>';
            return packs.map(p => `<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text-muted)">${p}</span><span>cubre ${ars(cubrePack(os, p))} · <strong style="color:var(--primary)">coseguro ${ars(coseguroPack(os, p))}</strong></span></div>`).join('');
          })()}
        </div>
      </div>`).join('');
  }
}

async function guardarTarifa() {
  const concepto = document.getElementById('tarifa-concepto').value.trim();
  if (!concepto) { alert('Ingresá el concepto'); return; }
  await store.add('tarifas', {
    servicio: document.getElementById('tarifa-serv').value, concepto,
    monto: parseInt(document.getElementById('tarifa-monto').value) || 0
  });
  document.getElementById('tarifa-concepto').value = '';
  document.getElementById('tarifa-monto').value = '';
  closeModal('modal-tarifa'); renderServicios();
}
async function eliminarTarifa(id) {
  const t = state.tarifas.find(x => x.id === id);
  if (t && !confirm(`¿Eliminar la tarifa "${t.concepto}" de ${t.servicio || ''} (${ars(t.monto)})?`)) return;
  await store.remove('tarifas', id);
  renderServicios();
}

async function guardarObraSocial() {
  const nombre = document.getElementById('os-nombre').value.trim();
  if (!nombre) { alert('Ingresá el nombre'); return; }
  await store.add('obrasSociales', {
    nombre,
    cubre: leerCubreOS(),
    servicios: document.getElementById('os-servicios').value,
    contacto: document.getElementById('os-contacto').value
  });
  ['os-nombre', 'os-servicios', 'os-contacto', 'os-cubre-sesion', 'os-cubre-5', 'os-cubre-10', 'os-cubre-15', 'os-cubre-20']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('os-coseguro-preview').style.display = 'none';
  closeModal('modal-obrasocial'); renderServicios();
}
async function eliminarObraSocial(id) {
  const os = state.obrasSociales.find(x => x.id === id);
  const n = state.pacientes.filter(p => p.obraSocialId === id).length;
  const aviso = n > 0 ? `\n\n⚠️ ${n} paciente${n !== 1 ? 's' : ''} la tiene${n !== 1 ? 'n' : ''} asignada y quedará${n !== 1 ? 'n' : ''} sin cobertura.` : '';
  if (os && !confirm(`¿Eliminar la obra social "${os.nombre}"?${aviso}`)) return;
  await store.remove('obrasSociales', id);
  renderServicios();
}

// ===== COPIA DE SEGURIDAD =====
// Descarga TODOS los datos como archivo JSON (respaldo manual del dueño).
function descargarBackup() {
  const data = store.exportBackup();
  const total = Object.values(data.tables).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kineapp-backup-${ymd(new Date())}.json`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  alert(`Backup descargado: ${total} registros. Guardalo en un lugar seguro.`);
}
// Restaura desde un archivo de backup. Sólo AGREGA lo que falte (no pisa ni borra).
async function restaurarBackup(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); }
  catch (_) { alert('El archivo no es un backup válido.'); input.value = ''; return; }
  if (!data || data.app !== 'kineapp' || !data.tables) { alert('El archivo no parece un backup de KineApp.'); input.value = ''; return; }
  const total = Object.values(data.tables).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
  if (!confirm(`¿Restaurar este backup? Tiene ${total} registros.\n\nSe AGREGA lo que falte. No se pisa ni se borra nada de lo que ya tengas.`)) { input.value = ''; return; }
  const r = await store.importBackup(data);
  input.value = '';
  if (r.ok) { alert(`Restauración lista: ${r.agregados} registros procesados.`); renderPage(state.currentPage); renderBackupInfo(); }
  else alert('Algunos datos no se pudieron restaurar:\n' + (r.errores || []).join('\n'));
}
function renderBackupInfo() {
  const el = document.getElementById('backup-info');
  if (!el) return;
  const snap = store.getCloudSnapshotInfo();
  el.textContent = snap
    ? `Copia automática en este equipo: ${new Date(snap.savedAt).toLocaleString('es-AR')} · ${snap.total} registros.`
    : 'Todavía no hay copia automática en este equipo.';
}

// ===== PAPELERA (borrado recuperable) =====
const TIPOS_PAPELERA = { pacientes: 'Paciente', turnos: 'Turno', pagos: 'Pago', gastos: 'Gasto', servicios: 'Servicio', tarifas: 'Tarifa', obrasSociales: 'Obra social', profesionales: 'Profesional' };
async function abrirPapelera() {
  document.getElementById('modal-papelera').classList.add('open');
  await renderPapelera();
}
async function renderPapelera() {
  const cont = document.getElementById('papelera-list');
  if (!cont) return;
  cont.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Cargando…</p>';
  const res = await store.fetchTrash();
  if (!res.ready) {
    cont.innerHTML = '<p style="color:var(--text-muted);font-size:13px">La papelera todavía no está activada. Para usarla, corré en Supabase la migración <strong>supabase/migracion-papelera.sql</strong>. Hasta entonces, borrar elimina de forma definitiva.</p>';
    return;
  }
  if (!res.items.length) { cont.innerHTML = '<p style="color:var(--text-muted);font-size:13px">La papelera está vacía.</p>'; return; }
  cont.innerHTML = res.items.map(it => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;background:var(--bg);border-radius:6px;margin-bottom:6px">
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(it.nombre || '(sin nombre)')}</div>
        <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(TIPOS_PAPELERA[it.key] || it.tabla || '')} · ${it.deleted_at ? new Date(it.deleted_at).toLocaleDateString('es-AR') : ''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-sm btn-secondary" onclick="restaurarItem('${it.id}')">Restaurar</button>
        <button class="btn btn-sm" style="color:var(--red);border:1px solid var(--border)" onclick="eliminarDefinitivo('${it.id}')">Eliminar</button>
      </div>
    </div>`).join('');
}
async function restaurarItem(pid) {
  const r = await store.restoreItem(pid);
  if (r.ok) { await renderPapelera(); renderPage(state.currentPage); }
  else alert('No se pudo restaurar: ' + (r.error || 'error'));
}
async function eliminarDefinitivo(pid) {
  if (!confirm('¿Eliminar este registro DEFINITIVAMENTE?\n\nEsto NO se puede deshacer.')) return;
  const r = await store.purgeItem(pid);
  if (r.ok) await renderPapelera();
  else alert('No se pudo eliminar: ' + (r.error || 'error'));
}

function verServicio(servId) {
  const s = state.servicios.find(x => x.id === servId) || state.servicios.find(x => x.nombre === servId);
  if (!s) return;
  const nombreServicio = s.nombre;
  const pacientes = state.pacientes.filter(p => p.servicio === nombreServicio);
  const turnosSrv = state.turnos.filter(t => t.servicio === nombreServicio);
  document.getElementById('servicio-modal-title').textContent = (s?.icono || '') + ' ' + nombreServicio;

  if (pacientes.length === 0) {
    document.getElementById('servicio-detail-content').innerHTML =
      '<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:24px 0">No hay pacientes en este servicio aún.</p>';
  } else {
    const hoyStr = ymd(new Date());
    document.getElementById('servicio-detail-content').innerHTML = pacientes.map(p => {
      const turnsPac = turnosSrv.filter(t => t.pacienteId === p.id);
      const proximoTurno = turnsPac.filter(t => t.fecha >= hoyStr).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      return `
        <div class="servicio-pac-item" id="spac-${p.id}">
          <div class="servicio-pac-header" onclick="toggleServicioPac('${p.id}')">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:38px;height:38px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${servicioEmoji(p.servicio)}</div>
              <div>
                <div style="font-weight:600;font-size:14px">${escapeHtml(p.nombre)}</div>
                <div style="font-size:12px;color:var(--text-muted)">${escapeHtml(p.lesion || 'Sin lesión registrada')} · ${escapeHtml(p.prof)}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              ${proximoTurno ? `<span class="badge badge-blue">Próx: ${proximoTurno.fecha} ${proximoTurno.hora}</span>` : '<span class="badge badge-gray">Sin turnos</span>'}
              <span style="color:var(--text-muted);font-size:16px;transition:transform .2s" id="spac-arrow-${p.id}">▾</span>
            </div>
          </div>
          <div class="servicio-pac-turnos" id="spac-turnos-${p.id}" style="display:none">
            ${turnsPac.length === 0
              ? '<p style="color:var(--text-muted);font-size:13px;padding:8px 0 4px">Sin turnos registrados en este servicio.</p>'
              : turnsPac.sort((a, b) => b.fecha.localeCompare(a.fecha)).map(t => `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                  <div style="text-align:center;background:var(--bg);border-radius:6px;padding:4px 8px;min-width:60px">
                    <div style="font-size:11px;font-weight:700;color:var(--primary)">${t.hora}</div>
                    <div style="font-size:10px;color:var(--text-muted)">${t.fecha.slice(5)}</div>
                  </div>
                  <div style="flex:1"><div style="font-size:13px;font-weight:500">${escapeHtml(t.prof)} · ${t.duracion}min</div>
                    ${t.notas ? `<div style="font-size:11px;color:var(--text-muted)">${escapeHtml(t.notas)}</div>` : ''}</div>
                  ${asistBadge(t.asistencia)}
                </div>`).join('')}
            <div style="margin-top:10px;display:flex;gap:8px">
              <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();verPaciente('${p.id}');closeModal('modal-servicio-detail')">Ver ficha completa</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }
  document.getElementById('modal-servicio-detail').classList.add('open');
}
function asistBadge(a) {
  return a === 'asistio' ? '<span class="badge badge-green">✅ Asistió</span>'
    : a === 'ausente' ? '<span class="badge badge-red">❌ Ausente</span>'
    : a === 'reprog' ? '<span class="badge badge-orange">🔄 Reprog.</span>'
    : '<span class="badge badge-gray">Pendiente</span>';
}
function toggleServicioPac(id) {
  const el = document.getElementById(`spac-turnos-${id}`);
  const arrow = document.getElementById(`spac-arrow-${id}`);
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? '' : 'rotate(-180deg)';
}

// ===== SELECTS / MODALES =====
// Llena los <select> de "elegir servicio" (turno, paciente, tarifa) y el filtro de
// pacientes con los servicios REALES cargados por el centro (no una lista fija).
function populateServicioSelects() {
  const nombres = state.servicios.map(s => s.nombre).filter(Boolean);
  const opts = nombres.map(n => `<option>${escapeHtml(n)}</option>`).join('');
  const ph = '<option value="">— Cargá servicios en la sección Servicios —</option>';
  ['turno-servicio', 'pac-servicio', 'tarifa-serv'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = opts || ph;
    if (prev && nombres.includes(prev)) sel.value = prev;
  });
  const filtro = document.getElementById('pac-filtro-serv');
  if (filtro) {
    const prev = filtro.value;
    filtro.innerHTML = '<option value="">Todos los servicios</option>' + opts;
    filtro.value = prev;
  }
}

function populatePacienteSelects() {
  const turnoSel = document.getElementById('turno-paciente');
  if (turnoSel) {
    turnoSel.innerHTML = '<option value="">— Seleccionar —</option>' + state.pacientes.map(p => {
      const agotado = p.sesionesAuth != null && store.turnosDePaciente(p.id).length >= p.sesionesAuth;
      return `<option value="${p.id}">${escapeHtml(p.nombre)}${agotado ? ' 🚫 sin sesiones' : ''}</option>`;
    }).join('');
  }
  const pagoSel = document.getElementById('pago-paciente');
  if (pagoSel) pagoSel.innerHTML = state.pacientes.map(p => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');
  const osSelect = document.getElementById('pac-os-select');
  if (osSelect) osSelect.innerHTML = '<option value="">— Seleccionar —</option>' + state.obrasSociales.map(os => `<option value="${os.id}">${escapeHtml(os.nombre)}</option>`).join('');
  populateProfSelects();
  populateServicioSelects();
}

// ===== PROFESIONALES =====
// SÓLO los profesionales cargados por el centro (en Supabase). Sin nombres de ejemplo.
function profesionalesEfectivos() {
  return state.profesionales.map(p => p.nombre).filter(Boolean);
}
// Rellena un <select> de profesional con los registrados. 'extra' suma (y selecciona) un
// nombre puntual aunque no esté en la lista (ej. el profesional de un turno/paciente viejo).
function fillProfSelect(sel, extra) {
  if (!sel) return;
  const set = new Set(profesionalesEfectivos());
  if (extra) set.add(extra);
  const opts = [...set];
  if (!opts.length) {
    sel.innerHTML = '<option value="">— Agregá profesionales en Servicios —</option>';
    return;
  }
  sel.innerHTML = opts.map(n => `<option>${escapeHtml(n)}</option>`).join('');
  if (extra) sel.value = extra;
}
function populateProfSelects() {
  fillProfSelect(document.getElementById('turno-prof'));
  fillProfSelect(document.getElementById('pac-prof'));
}
function renderProfesionales() {
  const cont = document.getElementById('profesionales-list');
  if (!cont) return;
  const items = state.profesionales;
  if (!items.length) {
    cont.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Todavía no cargaste profesionales. Agregá los del centro abajo para poder asignarlos a turnos y pacientes.</p>';
  } else {
    cont.innerHTML = items.map(p => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg);border-radius:6px;margin-bottom:4px">
        <span style="font-size:13px">${escapeHtml(p.nombre)}</span>
        <button onclick="eliminarProfesional('${p.id}')" title="Eliminar" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;padding:2px">✕</button>
      </div>`).join('');
  }
}
async function guardarProfesional() {
  const inp = document.getElementById('prof-nuevo');
  const nombre = (inp.value || '').trim();
  if (!nombre) { alert('Escribí el nombre del profesional'); return; }
  // La tabla 'profesionales' es nueva: si no se corrió la migración, avisamos en vez de
  // "guardar" algo que se perdería en silencio al recargar.
  if (store.isCloud && store.missingTables && store.missingTables.has('profesionales')) {
    alert('Para gestionar profesionales falta correr una migración en Supabase:\nsupabase/migracion-profesionales.sql\n\nHasta entonces no se pueden guardar.');
    return;
  }
  if (state.profesionales.some(p => (p.nombre || '').toLowerCase() === nombre.toLowerCase())) {
    alert('Ese profesional ya está cargado'); return;
  }
  await store.add('profesionales', { nombre });
  if (store.lastWriteError) {
    store.lastWriteError = null;
    // El alta optimista no persistió: la sacamos del cache para no mostrar un fantasma.
    const i = state.profesionales.findIndex(p => (p.nombre || '').toLowerCase() === nombre.toLowerCase());
    if (i >= 0) state.profesionales.splice(i, 1);
    alert('No se pudo guardar el profesional (revisá la conexión). Reintentá.');
    renderProfesionales();
    return;
  }
  inp.value = '';
  renderProfesionales();
  populateProfSelects();
  populateAgendaProf();
}
async function eliminarProfesional(id) {
  const p = state.profesionales.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar al profesional "${p.nombre}"?\n(No borra sus turnos ni pacientes, solo lo saca del listado.)`)) return;
  await store.remove('profesionales', id);
  renderProfesionales();
  populateProfSelects();
  populateAgendaProf();
}

function onCoberturaChange() {
  const esOS = document.getElementById('pac-cobertura').value === 'obra_social';
  document.getElementById('pac-os-section').style.display = esOS ? 'block' : 'none';
  document.getElementById('pac-os-info').style.display = 'none';
  const hint = document.getElementById('pac-particular-hint');
  if (hint) hint.style.display = esOS ? 'none' : 'block';
}
const PACKS = ['Por sesión', 'Pack 4 sesiones', 'Pack 5 sesiones', 'Pack 6 sesiones', 'Pack 8 sesiones', 'Pack 10 sesiones', 'Pack 12 sesiones', 'Pack 15 sesiones', 'Pack 20 sesiones'];
const OS_CUBRE_FIELDS = [
  ['os-cubre-sesion', 'Por sesión'], ['os-cubre-5', 'Pack 5 sesiones'], ['os-cubre-10', 'Pack 10 sesiones'],
  ['os-cubre-15', 'Pack 15 sesiones'], ['os-cubre-20', 'Pack 20 sesiones'],
];

// Precio de un pack según las tarifas cargadas (prioriza el servicio si se pasa).
function tarifaDePack(concepto, servicio) {
  const matches = state.tarifas.filter(t => t.concepto === concepto);
  if (servicio) { const m = matches.find(t => t.servicio === servicio); if (m) return m.monto || 0; }
  return matches[0]?.monto || 0;
}
const PACK_SESIONES = { 'Por sesión': 1, 'Pack 4 sesiones': 4, 'Pack 5 sesiones': 5, 'Pack 6 sesiones': 6, 'Pack 8 sesiones': 8, 'Pack 10 sesiones': 10, 'Pack 12 sesiones': 12, 'Pack 15 sesiones': 15, 'Pack 20 sesiones': 20 };
// Precio del pack: tarifa directa, o (tarifa por sesión × N) si no cargaron la del pack.
function precioPack(concepto, servicio) {
  const directo = tarifaDePack(concepto, servicio);
  if (directo > 0) return directo;
  return tarifaDePack('Por sesión', servicio) * (PACK_SESIONES[concepto] || 1);
}
// Lo que cubre la OS para el pack: monto directo, o (cubre por sesión × N).
function cubrePack(os, concepto) {
  const c = (os && os.cubre) || {};
  if (c[concepto] > 0) return c[concepto];
  return (c['Por sesión'] || 0) * (PACK_SESIONES[concepto] || 1);
}
// Coseguro de un pack = precio − lo que cubre la obra social.
function coseguroPack(os, concepto, servicio) {
  return Math.max(0, precioPack(concepto, servicio) - cubrePack(os, concepto));
}
// Packs que tienen precio (tarifa directa o derivada de "por sesión").
function packsConPrecio(servicio) {
  return PACKS.filter(p => precioPack(p, servicio) > 0);
}
// Packs con tarifa DIRECTA cargada (no derivada). Para la card/preview de OS, así no
// se listan los 9 packs derivados cuando sólo hay una tarifa "Por sesión".
function packsConTarifaDirecta(servicio) {
  return PACKS.filter(p => tarifaDePack(p, servicio) > 0);
}
function leerCubreOS() {
  const cubre = {};
  OS_CUBRE_FIELDS.forEach(([id, pack]) => { cubre[pack] = parseInt(document.getElementById(id).value) || 0; });
  return cubre;
}
function packDeSesiones(n) {
  return ({ 4: 'Pack 4 sesiones', 5: 'Pack 5 sesiones', 6: 'Pack 6 sesiones', 8: 'Pack 8 sesiones', 10: 'Pack 10 sesiones', 12: 'Pack 12 sesiones', 15: 'Pack 15 sesiones', 20: 'Pack 20 sesiones' })[n] || null;
}

// Preview en vivo: coseguro (tarifa − cubre) por cada pack que tenga tarifa cargada.
function updateCoseguroPreview() {
  const osTmp = { cubre: leerCubreOS() };
  const box = document.getElementById('os-coseguro-preview');
  const rowsEl = document.getElementById('os-coseguro-rows');
  if (!box || !rowsEl) return;
  const packs = packsConTarifaDirecta();
  if (!packs.length) {
    rowsEl.innerHTML = '<span style="color:var(--text-muted)">Cargá primero las tarifas (Servicios → Tarifas) para que el coseguro se calcule solo.</span>';
  } else {
    rowsEl.innerHTML = packs.map(p => {
      const precio = precioPack(p), cubre = cubrePack(osTmp, p), cose = Math.max(0, precio - cubre);
      return `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>${p}</span><span><strong>${ars(cose)}</strong> <span style="color:var(--text-muted)">(${ars(precio)} − ${ars(cubre)})</span></span></div>`;
    }).join('');
  }
  box.style.display = 'block';
}

// En el alta, sugiere el "Total a pagar" = coseguro del pack que corresponde a las sesiones.
function sugerirTotalPagar() {
  if (document.getElementById('pac-cobertura').value !== 'obra_social') return;
  const os = state.obrasSociales.find(x => x.id === document.getElementById('pac-os-select').value);
  if (!os) return;
  const servicio = document.getElementById('pac-servicio').value;
  const ses = parseInt(document.getElementById('pac-sesiones-auth').value) || 0;
  const pack = packDeSesiones(ses);
  // Pack 5/10/15/20 con precio -> su coseguro; si no, por sesión × N.
  const total = (pack && precioPack(pack, servicio) > 0)
    ? coseguroPack(os, pack, servicio)
    : coseguroPack(os, 'Por sesión', servicio) * ses;
  document.getElementById('pac-total-pagar').value = total;
}

function onObrasSocialChange() {
  const os = state.obrasSociales.find(x => x.id === document.getElementById('pac-os-select').value);
  const infoDiv = document.getElementById('pac-os-info');
  if (os) {
    const servicio = document.getElementById('pac-servicio').value;
    const ses = parseInt(document.getElementById('pac-sesiones-auth').value) || 0;
    const pack = packDeSesiones(ses);
    const usaPack = pack && precioPack(pack, servicio) > 0;
    // "Cubre" y "Coseguro" se escalan igual (× N en la ruta por-sesión) para que cierren con el precio total.
    const cubreTotal = usaPack ? cubrePack(os, pack) : cubrePack(os, 'Por sesión') * (ses || 1);
    const total = usaPack ? coseguroPack(os, pack, servicio) : coseguroPack(os, 'Por sesión', servicio) * (ses || 1);
    document.getElementById('pac-os-monto').textContent = ars(cubreTotal);
    document.getElementById('pac-os-adicional').textContent = ars(total);
    document.getElementById('pac-os-cobertura').textContent = usaPack ? pack : (ses ? `por sesión × ${ses}` : 'por sesión');
    infoDiv.style.display = 'block';
    sugerirTotalPagar();
  } else { infoDiv.style.display = 'none'; }
}

function openModal(id) {
  populatePacienteSelects();
  document.getElementById(id).classList.add('open');
  if (id === 'modal-turno') {
    resetTurnoForm();
    const sel = document.getElementById('turno-hora');
    if (!sel.children.length) {
      for (let h = 8; h <= 22; h++) ['00', '15', '30', '45'].forEach(m => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = `${String(h).padStart(2, '0')}:${m}`;
        sel.appendChild(opt);
      });
    }
    if (!document.getElementById('turno-fecha').value)
      document.getElementById('turno-fecha').value = ymd(new Date());
  }
  if (id === 'modal-obrasocial') updateCoseguroPreview();
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ===== GUARDAR / MUTACIONES =====
function toggleDia(btn) {
  btn.classList.toggle('active');
  const hay = document.querySelectorAll('#turno-dias .dia-btn.active').length > 0;
  document.getElementById('turno-repetir-extra').style.display = hay ? 'block' : 'none';
}
function resetTurnoForm() {
  document.getElementById('turno-notas').value = '';
  document.querySelectorAll('#turno-dias .dia-btn.active').forEach(b => b.classList.remove('active'));
  const extra = document.getElementById('turno-repetir-extra');
  if (extra) extra.style.display = 'none';
}

async function guardarTurno() {
  const pacId = document.getElementById('turno-paciente').value;
  if (!pacId) { alert('Seleccioná un paciente'); return; }
  const pacObj = store.pacienteById(pacId);
  if (!pacObj) { alert('Paciente no encontrado'); return; }
  const fechaBase = document.getElementById('turno-fecha').value;
  if (!fechaBase) { alert('Elegí una fecha'); return; }

  const hora = document.getElementById('turno-hora').value;
  const serv = document.getElementById('turno-servicio').value;
  const servClassMap = { 'Rehabilitación': 'rehab', 'Readaptación': 'gym', 'Pilates': 'pilates', 'Recovery': 'recovery', 'Entrenamiento funcional': 'gym' };
  const prof = document.getElementById('turno-prof').value;
  const duracion = parseInt(document.getElementById('turno-duracion').value);
  const notas = document.getElementById('turno-notas').value.trim() || null;

  // Una o varias fechas (repetición semanal en los días marcados).
  const dias = [...document.querySelectorAll('#turno-dias .dia-btn.active')].map(b => parseInt(b.dataset.dia));
  let fechas;
  if (dias.length) {
    const semanas = Math.max(1, parseInt(document.getElementById('turno-semanas').value) || 1);
    fechas = [];
    const start = new Date(fechaBase + 'T00:00:00');
    for (let i = 0; i < semanas * 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      if (dias.includes(d.getDay())) fechas.push(ymd(d));
    }
    if (!fechas.length) fechas = [fechaBase];
  } else {
    fechas = [fechaBase];
  }

  // Cupo de sesiones autorizadas (turnos existentes + a crear).
  let cupo = Infinity;
  if (pacObj.sesionesAuth != null) {
    const usados = store.turnosDePaciente(pacObj.id).length;
    cupo = pacObj.sesionesAuth - usados;
    if (cupo <= 0) { mostrarBloqueado(pacObj, usados); return; }
  }

  // Se permiten varios turnos en el mismo horario (no se bloquea por "horario ocupado").
  const sinCupo = [];
  let creados = 0;
  for (const fecha of fechas) {
    if (creados >= cupo) { sinCupo.push(fecha); continue; }
    await store.add('turnos', {
      pacienteId: pacObj.id, paciente: pacObj.nombre, fecha, hora, duracion,
      servicio: serv, servClass: servClassMap[serv] || 'rehab', prof, notas, asistencia: null,
    });
    creados++;
  }

  closeModal('modal-turno');
  resetTurnoForm();

  if (fechas.length > 1 || sinCupo.length) {
    let msg = `Se agendaron ${creados} turno${creados !== 1 ? 's' : ''}.`;
    if (sinCupo.length) msg += `\n\n⚠️ Sin sesiones autorizadas disponibles para:\n${sinCupo.join(', ')}`;
    alert(msg);
  }

  if (state.currentPage === 'agenda') renderAgenda();
  else if (state.currentPage === 'dashboard') renderDashboard();
}

function mostrarBloqueado(pac, turnosAgendados) {
  document.getElementById('bloqueado-nombre').textContent = pac.nombre;
  document.getElementById('bloqueado-auth').textContent = pac.sesionesAuth;
  const detalle = document.getElementById('bloqueado-detalle');
  if (detalle) detalle.textContent = `Ya tiene ${turnosAgendados} turno${turnosAgendados !== 1 ? 's' : ''} agendado${turnosAgendados !== 1 ? 's' : ''} de ${pac.sesionesAuth} autorizado${pac.sesionesAuth !== 1 ? 's' : ''}.`;
  document.getElementById('modal-bloqueado').classList.add('open');
}

function previewFotoMedico(input) {
  const file = input.files[0];
  if (!file) return;
  const esImg = file.type.startsWith('image/');
  const reader = new FileReader();
  reader.onload = e => {
    // Guardamos el dataURL (imagen o PDF) en el src del <img> para persistirlo.
    document.getElementById('pac-foto-img').src = e.target.result;
    document.getElementById('pac-foto-img').style.display = esImg ? 'block' : 'none';
    document.getElementById('pac-foto-nombre').textContent = (esImg ? '' : '📄 ') + file.name;
    document.getElementById('pac-foto-preview').style.display = 'block';
    document.getElementById('pac-foto-drop').style.display = 'none';
  };
  reader.readAsDataURL(file);   // lee imágenes Y PDFs
}
function limpiarFotoMedico() {
  document.getElementById('pac-foto-input').value = '';
  document.getElementById('pac-foto-preview').style.display = 'none';
  document.getElementById('pac-foto-drop').style.display = 'block';
  document.getElementById('pac-foto-img').src = '';
  document.getElementById('pac-foto-img').style.display = 'block';
}

// Abrir el formulario en modo ALTA (paciente nuevo).
function nuevoPaciente() {
  editingPacienteId = null;
  pacienteReturnToTurno = false;
  openModal('modal-paciente');           // popula selects de obras sociales
  resetPacienteForm();
  document.getElementById('modal-paciente-title').textContent = 'Nuevo paciente';
  document.getElementById('btn-guardar-paciente').textContent = 'Guardar paciente';
}

// Alta rápida desde el modal "Nuevo turno": al guardar, vuelve al turno con el
// paciente recién creado ya seleccionado (el modal-turno queda abierto detrás).
function nuevoPacienteDesdeTurno() {
  nuevoPaciente();
  pacienteReturnToTurno = true;
}

// Abrir el formulario en modo EDICIÓN, precargado con los datos del paciente.
function editarPaciente(id) {
  const p = state.pacientes.find(x => x.id === id);
  if (!p) return;
  editingPacienteId = id;
  pacienteReturnToTurno = false;
  closeModal('modal-ficha');
  openModal('modal-paciente');           // popula selects ANTES de cargar valores
  fillPacienteForm(p);
  document.getElementById('modal-paciente-title').textContent = 'Editar paciente';
  document.getElementById('btn-guardar-paciente').textContent = 'Guardar cambios';
}

// --- Evaluación física / kinesiológica (sección 4 del alta) ---
const EVAL_OBS = [
  ['marcha', 'Marcha alterada'], ['postura', 'Postura alterada'], ['asimetrias', 'Asimetrías visibles'],
  ['inflamacion', 'Inflamación visible'], ['palpacion', 'Dolor a la palpación'], ['limitacion', 'Limitación de movilidad'],
  ['fuerza', 'Déficit de fuerza'], ['equilibrio', 'Déficit de equilibrio / propiocepción'],
  ['compensaciones', 'Compensaciones durante el movimiento'],
];
function leerEvalClinica() {
  const v = id => (document.getElementById(id)?.value ?? '').trim();
  const n = id => { const x = parseInt(document.getElementById(id)?.value); return isNaN(x) ? null : x; };
  const obs = {};
  EVAL_OBS.forEach(([k]) => obs[k] = !!document.getElementById('pac-ok-' + k)?.checked);
  return {
    dolorReposo: n('pac-dolor-reposo'), dolorMovimiento: n('pac-dolor-mov'), dolorDeporte: n('pac-dolor-dep'),
    inflamacion: v('pac-inflamacion'), hematoma: v('pac-hematoma'), inestabilidad: v('pac-inestabilidad'),
    rangoMovilidad: v('pac-rango-movilidad'), mecanismo: v('pac-mecanismo'), antecDeportivos: v('pac-antec-deportivos'),
    obs, obsTexto: v('pac-ok-obs'),
  };
}
function fillEvalClinica(e) {
  e = e || {};
  const set = (id, val) => { const x = document.getElementById(id); if (x) x.value = (val ?? '') === null ? '' : (val ?? ''); };
  set('pac-dolor-reposo', e.dolorReposo); set('pac-dolor-mov', e.dolorMovimiento); set('pac-dolor-dep', e.dolorDeporte);
  set('pac-inflamacion', e.inflamacion); set('pac-hematoma', e.hematoma); set('pac-inestabilidad', e.inestabilidad);
  set('pac-rango-movilidad', e.rangoMovilidad); set('pac-mecanismo', e.mecanismo); set('pac-antec-deportivos', e.antecDeportivos);
  const obs = e.obs || {};
  EVAL_OBS.forEach(([k]) => { const c = document.getElementById('pac-ok-' + k); if (c) c.checked = !!obs[k]; });
  set('pac-ok-obs', e.obsTexto);
}

function evalTieneDatos(e) {
  if (!e) return false;
  const obs = e.obs || {};
  const campos = [e.dolorReposo, e.dolorMovimiento, e.dolorDeporte, e.inflamacion, e.hematoma,
    e.inestabilidad, e.rangoMovilidad, e.mecanismo, e.antecDeportivos, e.obsTexto];
  return campos.some(v => v != null && v !== '') || EVAL_OBS.some(([k]) => obs[k]);
}
function fichaEvalHtml(e) {
  if (!evalTieneDatos(e)) return '';
  const dolor = (l, v) => `<div class="detail-item"><div class="detail-item-label">Dolor ${l}</div><div class="detail-item-value">${(v != null && v !== '') ? v + ' / 10' : '—'}</div></div>`;
  const kv2 = (l, v) => `<div class="detail-item"><div class="detail-item-label">${l}</div><div class="detail-item-value">${escapeHtml(v) || '—'}</div></div>`;
  const obs = e.obs || {};
  const positivos = EVAL_OBS.filter(([k]) => obs[k]).map(([, label]) => label);
  return `
    <div class="detail-section">
      <div class="detail-section-title">Evaluación física y kinesiológica</div>
      <div class="detail-grid">
        ${dolor('en reposo', e.dolorReposo)}${dolor('en movimiento', e.dolorMovimiento)}${dolor('en actividad', e.dolorDeporte)}
        ${kv2('¿Inflamación?', e.inflamacion)}${kv2('¿Hematoma?', e.hematoma)}${kv2('¿Inestabilidad?', e.inestabilidad)}
        ${kv2('Rango de movilidad', e.rangoMovilidad)}${kv2('Mecanismo lesional', e.mecanismo)}${kv2('Antec. deportivos', e.antecDeportivos)}
      </div>
      <div style="margin-top:10px">
        <div class="detail-item-label" style="margin-bottom:6px">Observación kinesiológica</div>
        ${positivos.length ? positivos.map(l => `<span class="badge badge-orange" style="margin:2px 4px 2px 0">${l}</span>`).join('') : '<span style="font-size:13px;color:var(--text-muted)">Sin hallazgos marcados</span>'}
        ${e.obsTexto ? `<div style="font-size:13px;margin-top:8px">${escapeHtml(e.obsTexto)}</div>` : ''}
      </div>
    </div>`;
}

function imprimirFichaActual() {
  if (currentInformePacienteId) imprimirFicha(currentInformePacienteId);
}
function imprimirFicha(id) {
  const p = obtenerPacienteInforme(id);
  if (!p) return;
  const obraSocial = (p.tipoCobertura === 'obra_social' && p.obraSocialId) ? state.obrasSociales.find(x => x.id === p.obraSocialId) : null;
  const e = p.evalClinica || {};
  const obs = e.obs || {};
  const row = (l, v) => `<div class="fp-row"><div class="l">${l}</div><div class="v">${escapeHtml(v ?? '') || '—'}</div></div>`;
  const dolor = v => (v != null && v !== '') ? `${v}/10` : '—';
  const ck = (label, on) => `<div class="ck">${on ? '☑' : '☐'} ${label}</div>`;
  const hoy = new Date();
  document.getElementById('ficha-print').innerHTML = `
    <div class="fp-wrap">
      <div class="fp-head">
        <div class="fp-logo">kinesico<span class="b">SPORT</span><small>Centro Kinesiológico</small></div>
        <div class="fp-title">Ficha kinesiológica<br>Emitida: ${hoy.toLocaleDateString('es-AR')}</div>
      </div>
      <div class="fp-name">${escapeHtml(p.nombre)}</div>
      <div style="font-size:13px;color:#555">${escapeHtml(p.servicio || '')} · ${escapeHtml(p.prof || '')}</div>

      <div class="fp-h2">Datos del paciente</div>
      <div class="fp-grid">
        ${row('DNI', p.dni)}${row('Edad', p.edad)}
        ${row('Teléfono', p.tel)}${row('Email', p.email)}
        ${row('Deporte / actividad', p.deporte)}${row('Cobertura', obraSocial ? obraSocial.nombre : 'Particular')}
      </div>
      ${row('Motivo de consulta', p.motivo)}${row('Lesión / diagnóstico', p.lesion)}

      <div class="fp-h2">Evaluación física</div>
      <div class="fp-grid">
        ${row('Dolor en reposo', dolor(e.dolorReposo))}${row('Dolor en movimiento', dolor(e.dolorMovimiento))}
        ${row('Dolor en actividad', dolor(e.dolorDeporte))}${row('¿Inflamación?', e.inflamacion)}
        ${row('¿Hematoma / moretón?', e.hematoma)}${row('¿Inestabilidad?', e.inestabilidad)}
      </div>
      ${row('Rango de movilidad articular (grados)', e.rangoMovilidad)}
      ${row('Mecanismo lesional', e.mecanismo)}
      ${row('Antecedentes deportivos y lesiones previas', e.antecDeportivos)}

      <div class="fp-h2">Observación kinesiológica</div>
      <div class="fp-checks">${EVAL_OBS.map(([k, label]) => ck(label, obs[k])).join('')}</div>
      ${e.obsTexto ? `<div style="margin-top:8px;font-size:13px"><strong>Observaciones:</strong> ${escapeHtml(e.obsTexto)}</div>` : ''}

      <div class="fp-h2">Plan de rehabilitación</div>
      <div class="fp-grid">
        ${row('Objetivo principal', p.objetivo)}${row('Etapa actual', p.etapaActual || deducirEtapaPaciente(p))}
      </div>
      ${row('Plan de rehabilitación', p.planRehab)}
      ${row('Progresión prevista / actual', p.progresion)}

      <div class="fp-firmas">
        <div class="fp-firma"><div class="line"></div><div class="cap">Firma del paciente</div></div>
        <div class="fp-firma"><div class="line"></div><div class="cap">Firma y sello del profesional</div></div>
      </div>
      <div class="fp-fecha">Fecha: ____ / ____ / ________</div>
    </div>`;
  window.print();
}

function fillPacienteForm(p) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  set('pac-nombre', p.nombre); set('pac-dni', p.dni); set('pac-tel', p.tel); set('pac-email', p.email);
  set('pac-edad', p.edad); set('pac-deporte', p.deporte);
  // El servicio del paciente debe verse aunque ya no esté en la lista actual.
  const servSel = document.getElementById('pac-servicio');
  if (servSel && p.servicio && ![...servSel.options].some(o => o.value === p.servicio || o.textContent === p.servicio)) {
    servSel.insertAdjacentHTML('afterbegin', `<option>${escapeHtml(p.servicio)}</option>`);
  }
  set('pac-servicio', p.servicio);
  set('pac-motivo', p.motivo); set('pac-lesion', p.lesion);
  set('pac-antecedentes', p.antecedentes); set('pac-evaluacion', p.evaluacion);
  set('pac-objetivo', p.objetivo); set('pac-etapa', p.etapaActual || deducirEtapaPaciente(p));
  set('pac-plan', p.planRehab); set('pac-progresion', p.progresion);
  set('pac-observaciones', p.observaciones);
  const profSel = document.getElementById('pac-prof');
  if (profSel) { fillProfSelect(profSel, p.prof); profSel.value = p.prof || ''; }
  set('pac-cobertura', p.tipoCobertura || 'particular');
  onCoberturaChange();
  set('pac-os-select', p.obraSocialId || '');
  set('pac-sesiones-auth', p.sesionesAuth ?? '');
  onObrasSocialChange(); // recién acá: ya están seteados servicio, OS y sesiones reales
  set('pac-total-pagar', p.totalPagar ?? ''); // pisa la sugerencia con el total guardado
  if (p.fotoMedico && p.fotoMedico.src) {
    const esImg = p.fotoMedico.src.startsWith('data:image');
    document.getElementById('pac-foto-img').src = p.fotoMedico.src;
    document.getElementById('pac-foto-img').style.display = esImg ? 'block' : 'none';
    document.getElementById('pac-foto-nombre').textContent = (esImg ? '' : '📄 ') + (p.fotoMedico.nombre || '');
    document.getElementById('pac-foto-preview').style.display = 'block';
    document.getElementById('pac-foto-drop').style.display = 'none';
  } else {
    limpiarFotoMedico();
  }
  fillEvalClinica(p.evalClinica);
}

function resetPacienteForm() {
  ['pac-nombre', 'pac-dni', 'pac-tel', 'pac-email', 'pac-edad', 'pac-deporte', 'pac-motivo', 'pac-lesion',
    'pac-antecedentes', 'pac-evaluacion', 'pac-objetivo', 'pac-plan', 'pac-progresion', 'pac-observaciones',
    'pac-sesiones-auth', 'pac-total-pagar']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('pac-servicio').selectedIndex = 0;
  document.getElementById('pac-etapa').selectedIndex = 0;
  document.getElementById('pac-prof').selectedIndex = 0;
  document.getElementById('pac-cobertura').value = 'particular';
  document.getElementById('pac-os-select').value = '';
  onCoberturaChange();
  limpiarFotoMedico();
  fillEvalClinica({});
}

async function guardarPaciente() {
  const nombre = document.getElementById('pac-nombre').value.trim();
  if (!nombre) { alert('Ingresá el nombre del paciente'); return; }
  const tipoCobertura = document.getElementById('pac-cobertura').value;
  const obraSocialId = tipoCobertura === 'obra_social' ? (document.getElementById('pac-os-select').value || null) : null;
  const sesAuth = parseInt(document.getElementById('pac-sesiones-auth').value) || null;
  const totalPagar = parseInt(document.getElementById('pac-total-pagar').value) || 0;
  const fotoImg = document.getElementById('pac-foto-img').src;
  const fotoNombre = document.getElementById('pac-foto-nombre').textContent.replace(/^📄\s*/, '');
  const fotoMedico = fotoImg && fotoImg !== window.location.href ? { src: fotoImg, nombre: fotoNombre } : null;

  const campos = {
    nombre,
    dni: document.getElementById('pac-dni').value.trim(),
    tel: document.getElementById('pac-tel').value.trim(),
    email: document.getElementById('pac-email').value.trim(),
    edad: document.getElementById('pac-edad').value.trim(),
    deporte: document.getElementById('pac-deporte').value.trim(),
    servicio: document.getElementById('pac-servicio').value,
    motivo: document.getElementById('pac-motivo').value.trim(),
    lesion: document.getElementById('pac-lesion').value.trim(),
    antecedentes: document.getElementById('pac-antecedentes').value.trim(),
    evaluacion: document.getElementById('pac-evaluacion').value.trim(),
    objetivo: document.getElementById('pac-objetivo').value.trim(),
    etapaActual: document.getElementById('pac-etapa').value,
    planRehab: document.getElementById('pac-plan').value.trim(),
    progresion: document.getElementById('pac-progresion').value.trim(),
    observaciones: document.getElementById('pac-observaciones').value.trim(),
    prof: document.getElementById('pac-prof').value,
    sesionesAuth: sesAuth,
    totalPagar,
    fotoMedico,
    evalClinica: leerEvalClinica(),
    tipoCobertura, obraSocialId
  };

  let createdId = null;
  if (editingPacienteId) {
    // Edición: merge sobre el existente (preserva sesiones/deuda, que se manejan aparte).
    await store.update('pacientes', editingPacienteId, campos);
    editingPacienteId = null;
  } else {
    // Alta: arranca con 0 sesiones; el "total a pagar" pasa a ser la deuda inicial.
    const nuevo = await store.add('pacientes', normalizarPaciente({
      ...campos, sesiones: 0, deuda: totalPagar, estado: totalPagar > 0 ? 'pendiente' : 'pagado'
    }));
    createdId = nuevo.id;
  }

  resetPacienteForm();
  closeModal('modal-paciente');
  renderPacientes();

  // Si el alta vino desde "Nuevo turno", volver y dejar seleccionado al paciente nuevo.
  if (pacienteReturnToTurno && createdId) {
    pacienteReturnToTurno = false;
    populatePacienteSelects();
    const sel = document.getElementById('turno-paciente');
    if (sel) sel.value = createdId;   // el modal-turno sigue abierto detrás
  } else {
    pacienteReturnToTurno = false;
  }
}

function onCobroTipoChange() {
  const tipo = document.getElementById('cobro-tipo').value;
  if (tipo === 'Saldar deuda') {
    const p = state.pacientes.find(x => x.id === document.getElementById('cobro-pac-id').value);
    if (p && p.deuda > 0) {
      document.getElementById('cobro-monto').value = p.deuda;
      document.getElementById('cobro-estado').value = 'Pagado';
    }
  }
}
function abrirCobro(pacId) {
  const p = state.pacientes.find(x => x.id === pacId);
  if (!p) return;
  const tieneDeuda = p.deuda > 0;
  document.getElementById('cobro-modal-titulo').textContent = p.nombre;
  document.getElementById('cobro-pac-id').value = pacId;
  const deudaEl = document.getElementById('cobro-deuda-actual');
  deudaEl.innerHTML = tieneDeuda
    ? `Deuda actual: <strong style="font-size:16px">${ars(p.deuda)}</strong>`
    : '✓ Sin deuda pendiente';
  deudaEl.style.color = tieneDeuda ? 'var(--red)' : 'var(--green)';
  // Si debe, abrimos directamente en "Saldar deuda" con el monto precargado.
  document.getElementById('cobro-tipo').value = tieneDeuda ? 'Saldar deuda' : 'Por sesión';
  document.getElementById('cobro-monto').value = tieneDeuda ? p.deuda : '';
  document.getElementById('cobro-estado').value = 'Pagado';
  document.getElementById('modal-cobro').classList.add('open');
}
async function confirmarCobro() {
  const pacId = document.getElementById('cobro-pac-id').value;
  const monto = parseInt(document.getElementById('cobro-monto').value) || 0;
  const tipo = document.getElementById('cobro-tipo').value;
  const estado = document.getElementById('cobro-estado').value;
  if (!monto) { alert('Ingresá el monto'); return; }

  const p = state.pacientes.find(x => x.id === pacId);
  // La deuda SÓLO se descuenta con un cobro "Saldar deuda". Un cobro por sesión/pack
  // marcado Pagado NO debe borrar la deuda vieja del paciente.
  if (p && tipo === 'Saldar deuda' && estado === 'Pagado' && p.deuda > 0) {
    if (monto > p.deuda && !confirm(`El monto (${ars(monto)}) es mayor a la deuda (${ars(p.deuda)}).\nSe salda por completo y el excedente NO queda como saldo a favor.\n\n¿Continuar?`)) return;
    const nueva = Math.max(0, p.deuda - monto);
    await store.update('pacientes', p.id, { deuda: nueva, estado: nueva <= 0 ? 'pagado' : p.estado });
  } else if (p && estado === 'Pendiente') {
    await store.update('pacientes', p.id, { deuda: (p.deuda || 0) + monto, estado: 'pendiente' });
  }
  await store.add('pagos', {
    pacienteId: p?.id || null, paciente: p?.nombre || '',
    fecha: ymd(new Date()), concepto: tipo, monto, estado
  });
  document.getElementById('modal-cobro').classList.remove('open');
  renderPagos();
  if (state.currentPage === 'cobranzas') renderCobranzas();
}

async function guardarPago() {
  const pac = document.getElementById('pago-paciente');
  const pacId = pac.value;
  const p = state.pacientes.find(x => x.id === pacId);
  const monto = parseInt(document.getElementById('pago-monto').value) || 0;
  const tipo = document.getElementById('pago-tipo').value;
  const estado = document.getElementById('pago-estado').value;

  await store.add('pagos', {
    pacienteId: p?.id || null, paciente: p?.nombre || '',
    fecha: ymd(new Date()), concepto: tipo, monto, estado
  });
  if (p) {
    if (estado === 'Pendiente') await store.update('pacientes', p.id, { deuda: (p.deuda || 0) + monto, estado: 'pendiente' });
    // Sólo "Saldar deuda" descuenta de la deuda (un pago por sesión/pack no la borra).
    else if (tipo === 'Saldar deuda' && estado === 'Pagado' && p.deuda > 0) {
      const nueva = Math.max(0, p.deuda - monto);
      await store.update('pacientes', p.id, { deuda: nueva, estado: nueva <= 0 ? 'pagado' : p.estado });
    }
  }
  closeModal('modal-pago');
  renderPagos();
  if (state.currentPage === 'cobranzas') renderCobranzas();
}

async function guardarServicio() {
  const nombre = document.getElementById('serv-nombre').value.trim();
  if (!nombre) { alert('Ingresá el nombre'); return; }
  await store.add('servicios', {
    nombre,
    desc: document.getElementById('serv-desc').value,
    icono: document.getElementById('serv-icono').value || '📋',
    color: 'blue'
  });
  ['serv-nombre', 'serv-desc', 'serv-icono'].forEach(id => document.getElementById(id).value = '');
  closeModal('modal-servicio'); renderServicios();
}

async function eliminarServicio(id) {
  const s = state.servicios.find(x => x.id === id);
  if (!s) return;
  if (!confirm(`¿Eliminar el servicio "${s.nombre}"?\n(No borra pacientes ni turnos, solo lo quita del listado de servicios.)`)) return;
  await store.remove('servicios', id);
  renderServicios();
  if (state.currentPage === 'agenda') renderAgenda();
}

// ===== FICHA / INFORME =====
function obtenerPacienteInforme(id) {
  const pacienteId = id ?? currentInformePacienteId;
  if (!pacienteId) return null;
  const paciente = state.pacientes.find(x => x.id === pacienteId);
  if (!paciente) return null;
  currentInformePacienteId = pacienteId;
  return normalizarPaciente(paciente);
}

function generarInformePacienteTexto(p) {
  const turnos = store.turnosDePaciente(p.id)
    .slice().sort((a, b) => (`${b.fecha} ${b.hora}`).localeCompare(`${a.fecha} ${a.hora}`));
  const ultimoTurno = turnos[0];
  const obraSocial = p.tipoCobertura === 'obra_social' && p.obraSocialId
    ? state.obrasSociales.find(x => x.id === p.obraSocialId) : null;
  const restantes = p.sesionesAuth != null ? Math.max(p.sesionesAuth - p.sesiones, 0) : 'Sin tope';

  return [
    'INFORME DE PLAN DE REHABILITACIÓN Y PROGRESIÓN', '',
    'DATOS DEL PACIENTE',
    `Paciente: ${p.nombre}`,
    `Edad: ${p.edad || 'No informada'}`,
    `Profesional: ${p.prof || 'No asignado'}`,
    `Servicio: ${p.servicio || 'No definido'}`,
    `Etapa actual: ${p.etapaActual || deducirEtapaPaciente(p)}`,
    `Cobertura: ${obraSocial ? obraSocial.nombre : 'Particular'}`, '',
    'EVALUACIÓN CLÍNICA',
    `Motivo de consulta: ${p.motivo || 'Sin dato'}`,
    `Lesión / diagnóstico: ${p.lesion || 'Sin dato'}`,
    `Antecedentes: ${p.antecedentes || 'Sin antecedentes cargados.'}`,
    `Evaluación inicial: ${p.evaluacion || 'Sin evaluación cargada.'}`, '',
    'PLAN DE REHABILITACIÓN',
    `Objetivo principal: ${p.objetivo || 'Sin objetivo definido.'}`,
    `Plan de rehabilitación: ${p.planRehab || 'Sin plan cargado.'}`,
    `Progresión observada / prevista: ${p.progresion || 'Sin progresión registrada.'}`,
    `Observaciones: ${p.observaciones || 'Sin observaciones.'}`, '',
    'SEGUIMIENTO',
    `Sesiones realizadas: ${p.sesiones}`,
    `Sesiones restantes: ${restantes}${p.sesionesAuth != null ? ` de ${p.sesionesAuth}` : ''}`,
    `Último turno: ${ultimoTurno ? `${ultimoTurno.fecha} ${ultimoTurno.hora}` : 'Sin turnos registrados'}`, '',
    'Este informe fue generado desde KineApp.'
  ].join('\n');
}

function abrirInformePaciente(id) {
  const paciente = obtenerPacienteInforme(id);
  if (!paciente) return;
  const informe = generarInformePacienteTexto(paciente);
  document.getElementById('informe-content').innerHTML = `
    <div class="report-meta">
      <div class="report-chip">${escapeHtml(paciente.nombre)}</div>
      <div class="report-chip">${escapeHtml(paciente.servicio)}</div>
      <div class="report-chip">${escapeHtml(paciente.etapaActual || deducirEtapaPaciente(paciente))}</div>
    </div>
    <div style="font-size:13px;color:var(--text-muted);margin:12px 0 16px">
      Informe listo para compartir por WhatsApp o mail con el plan de rehabilitación y la progresión actual del paciente.
    </div>
    <div class="report-preview">${escapeHtml(informe)}</div>`;
  openModal('modal-informe');
}

function copiarInformePaciente() {
  const paciente = obtenerPacienteInforme();
  if (!paciente) return;
  const texto = generarInformePacienteTexto(paciente);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(() => alert('Informe copiado al portapapeles.')).catch(() => alert('No se pudo copiar el informe.'));
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = texto; document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); document.body.removeChild(ta);
  alert('Informe copiado al portapapeles.');
}
function compartirInformeWhatsApp(id) {
  const paciente = obtenerPacienteInforme(id);
  if (!paciente) return;
  if (!paciente.tel) { alert('Este paciente no tiene teléfono cargado.'); return; }
  const telefono = telWhatsApp(paciente.tel);
  const texto = encodeURIComponent(`Hola, compartimos el informe de plan de rehabilitación y progresión.\n\n${generarInformePacienteTexto(paciente)}`);
  window.open(`https://wa.me/${telefono}?text=${texto}`, '_blank');
}
function compartirInformeMail(id) {
  const paciente = obtenerPacienteInforme(id);
  if (!paciente) return;
  if (!paciente.email) { alert('Este paciente no tiene email cargado.'); return; }
  const asunto = encodeURIComponent(`Informe de plan de rehabilitación y progresión - ${paciente.nombre}`);
  const cuerpo = encodeURIComponent(`Hola,\n\nCompartimos el informe actualizado del paciente.\n\n${generarInformePacienteTexto(paciente)}`);
  window.location.href = `mailto:${encodeURIComponent(paciente.email)}?subject=${asunto}&body=${cuerpo}`;
}

function descargarInformePDF() {
  const p = obtenerPacienteInforme();
  if (!p) return;
  if (!(window.jspdf && window.generarInformePDF)) {
    alert('No se pudo cargar el generador de PDF. Revisá tu conexión a internet e intentá de nuevo.');
    return;
  }
  const turnos = store.turnosDePaciente(p.id).slice()
    .sort((a, b) => (`${b.fecha} ${b.hora}`).localeCompare(`${a.fecha} ${a.hora}`));
  const obraSocial = (p.tipoCobertura === 'obra_social' && p.obraSocialId)
    ? state.obrasSociales.find(x => x.id === p.obraSocialId) : null;
  const restantes = p.sesionesAuth != null ? Math.max(p.sesionesAuth - p.sesiones, 0) : null;
  window.generarInformePDF(p, {
    etapa: p.etapaActual || deducirEtapaPaciente(p),
    obraSocial, restantes, ultimoTurno: turnos[0] || null
  });
}

function verPaciente(id) {
  const p = obtenerPacienteInforme(id);
  if (!p) return;
  const turnPac = store.turnosDePaciente(p.id);
  const asistidos = turnPac.filter(t => t.asistencia === 'asistio').length;
  const restantes = p.sesionesAuth != null ? Math.max(p.sesionesAuth - p.sesiones, 0) : null;
  const obraSocial = p.tipoCobertura === 'obra_social' && p.obraSocialId
    ? state.obrasSociales.find(x => x.id === p.obraSocialId) : null;

  const kv = (label, value) => `<div class="detail-item"><div class="detail-item-label">${label}</div><div class="detail-item-value">${escapeHtml(value)}</div></div>`;

  document.getElementById('ficha-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border)">
      <div style="width:52px;height:52px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${servicioEmoji(p.servicio)}</div>
      <div>
        <div style="font-size:18px;font-weight:600">${escapeHtml(p.nombre)}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:2px">${escapeHtml(p.prof)} · <span class="badge badge-${servicioColor(p.servicio)}">${escapeHtml(p.servicio)}</span></div>
      </div>
    </div>
    <div class="ficha-actions">
      <button class="btn btn-primary" onclick="editarPaciente('${p.id}')">✏️ Editar ficha</button>
      <button class="btn btn-secondary" onclick="abrirInformePaciente('${p.id}')">Ver informe de progreso</button>
      <button class="btn btn-success" onclick="compartirInformeWhatsApp('${p.id}')">Enviar por WhatsApp</button>
      <button class="btn btn-secondary" onclick="compartirInformeMail('${p.id}')">Enviar por mail</button>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Ficha clínica individual</div>
      <div class="detail-grid">
        ${kv('DNI', p.dni || '—')}${kv('Teléfono', p.tel || '—')}${kv('Email', p.email || '—')}
        ${kv('Edad', p.edad || '—')}${kv('Deporte / Actividad', p.deporte || '—')}${kv('Lesión / Diagnóstico', p.lesion || '—')}
        ${kv('Motivo de consulta', p.motivo || '—')}
      </div>
    </div>
    <div class="detail-section soft">
      <div class="detail-section-title">Cobertura y seguimiento</div>
      <div class="detail-grid">
        ${kv('Tipo de cobertura', obraSocial ? obraSocial.nombre : 'Paciente particular')}
        ${kv('Total a pagar', ars(p.totalPagar || 0))}
        ${kv('Sesiones realizadas', p.sesiones)}
        ${kv('Sesiones restantes', restantes != null ? `${restantes} de ${p.sesionesAuth}` : 'Sin tope cargado')}
      </div>
      ${obraSocial ? (() => {
        const ses = p.sesionesAuth || 0;
        const pack = packDeSesiones(ses);
        const usaPack = pack && precioPack(pack, p.servicio) > 0;
        const total = usaPack ? coseguroPack(obraSocial, pack, p.servicio) : coseguroPack(obraSocial, 'Por sesión', p.servicio) * (ses || 1);
        return `<div style="margin-top:12px;padding:12px;border-radius:10px;background:var(--primary-light);border:1px solid var(--primary-soft);font-size:13px"><strong>${escapeHtml(obraSocial.nombre)}</strong> · <span style="color:var(--primary);font-weight:600">Coseguro ${ars(total)}${ses ? ` (${ses} ses.)` : ''}</span></div>`;
      })() : ''}
    </div>
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <div style="flex:1;text-align:center;background:var(--primary-light);border-radius:var(--radius-sm);padding:12px"><div style="font-size:26px;font-weight:700;color:var(--primary)">${p.sesiones}</div><div style="font-size:12px;color:var(--text-muted)">realizadas</div></div>
      ${p.sesionesAuth != null ? (() => {
        const color = restantes === 0 ? 'var(--red)' : restantes === 1 ? 'var(--orange)' : 'var(--teal)';
        const bg = restantes === 0 ? 'var(--red-light)' : restantes === 1 ? 'var(--orange-light)' : 'var(--teal-light)';
        return `<div style="flex:1;text-align:center;background:${bg};border-radius:var(--radius-sm);padding:12px"><div style="font-size:26px;font-weight:700;color:${color}">${restantes}</div><div style="font-size:12px;color:var(--text-muted)">restantes de ${p.sesionesAuth}</div></div>`;
      })() : ''}
      <div style="flex:1;text-align:center;background:var(--green-light);border-radius:var(--radius-sm);padding:12px"><div style="font-size:26px;font-weight:700;color:var(--green)">${asistidos}</div><div style="font-size:12px;color:var(--text-muted)">asistencias</div></div>
      <div style="flex:1;text-align:center;background:${p.deuda > 0 ? 'var(--red-light)' : 'var(--green-light)'};border-radius:var(--radius-sm);padding:12px"><div style="font-size:26px;font-weight:700;color:${p.deuda > 0 ? 'var(--red)' : 'var(--green)'}">${ars(p.deuda)}</div><div style="font-size:12px;color:var(--text-muted)">deuda</div></div>
    </div>
    ${p.fotoMedico ? `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px">Pedido médico</div>
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;background:var(--bg);padding:12px;text-align:center">
        ${p.fotoMedico.src && p.fotoMedico.src.startsWith('data:image')
          ? `<img src="${p.fotoMedico.src}" style="max-width:100%;max-height:220px;border-radius:6px;cursor:pointer" title="Tocá para ampliar" onclick="window.open(this.src)">
             <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Tocá la imagen para ampliar</div>`
          : `<div style="font-size:34px">📄</div>
             <div style="font-size:13px;color:var(--text-muted);margin:4px 0 10px">${escapeHtml(p.fotoMedico.nombre || 'Pedido médico')}</div>
             <a class="btn btn-secondary" href="${p.fotoMedico.src}" target="_blank" rel="noopener" download="${escapeHtml(p.fotoMedico.nombre || 'pedido-medico')}">Abrir / descargar</a>`}
      </div></div>` : ''}
    <div class="detail-section">
      <div class="detail-section-title">Evaluación y planificación</div>
      <div class="detail-grid">
        ${kv('Antecedentes', p.antecedentes || 'Sin antecedentes cargados.')}
        ${kv('Evaluación inicial', p.evaluacion || 'Sin evaluación cargada.')}
        ${kv('Objetivo principal', p.objetivo || 'Sin objetivo definido.')}
        ${kv('Plan de rehabilitación', p.planRehab || 'Sin plan cargado.')}
        ${kv('Progresión', p.progresion || 'Sin progresión registrada.')}
        ${kv('Observaciones', p.observaciones || 'Sin observaciones.')}
      </div>
    </div>
    ${fichaEvalHtml(p.evalClinica)}
    <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Historial de turnos</div>
    ${turnPac.length === 0 ? '<p style="color:var(--text-muted);font-size:13px">Sin turnos registrados</p>'
      : turnPac.slice(-5).reverse().map(t => `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:16px">${servicioEmoji(t.servicio)}</span>
          <div style="flex:1"><div style="font-size:13px;font-weight:500">${t.fecha} · ${t.hora}</div>
            <div style="font-size:12px;color:var(--text-muted)">${escapeHtml(t.prof)} · ${t.duracion}min</div></div>
          ${asistBadge(t.asistencia)}
        </div>`).join('')}`;
  openModal('modal-ficha');
}

// re-render en resize (cambia layout desktop/mobile)
window.addEventListener('resize', () => {
  if (state.currentPage === 'agenda') renderAgenda();
  if (state.currentPage === 'pacientes') renderPacientes();
  if (state.currentPage === 'cobranzas') renderCobranzas();
});

// ===== ARRANQUE =====
boot();
