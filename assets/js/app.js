// ===== ESTADO GLOBAL =====
let state = {
  currentPage: 'dashboard',
  currentWeekOffset: 0,
  pacientes: [
    { id:1, nombre:'Martina López', tel:'261-555-1234', deporte:'Running', servicio:'Rehabilitación', motivo:'Dolor rodilla', lesion:'Condromalacia rotuliana', prof:'Lic. García', sesiones:12, sesionesAuth:15, fotoMedico:null, deuda:0, estado:'pagado', tipoCobertura:'obra_social', obraSocialId:1 },
    { id:2, nombre:'Carlos Herrera', tel:'261-555-5678', deporte:'Fútbol', servicio:'Readaptación', motivo:'Post-cirugía', lesion:'Rotura LCA', prof:'Lic. Romero', sesiones:8, sesionesAuth:20, fotoMedico:null, deuda:15000, estado:'pendiente', tipoCobertura:'particular', obraSocialId:null },
    { id:3, nombre:'Sofía Mendez', tel:'261-555-9012', deporte:'Pilates', servicio:'Pilates', motivo:'Fortalecimiento', lesion:'Lumbalgia crónica', prof:'Lic. Paz', sesiones:20, sesionesAuth:null, fotoMedico:null, deuda:0, estado:'pagado', tipoCobertura:'obra_social', obraSocialId:2 },
    { id:4, nombre:'Diego Ramos', tel:'261-555-3456', deporte:'Natación', servicio:'Recovery', motivo:'Recuperación', lesion:'Tendinitis hombro', prof:'Lic. García', sesiones:5, sesionesAuth:10, fotoMedico:null, deuda:8000, estado:'pendiente', tipoCobertura:'particular', obraSocialId:null },
    { id:5, nombre:'Ana Torres', tel:'261-555-7890', deporte:'Vóley', servicio:'Rehabilitación', motivo:'Dolor tobillo', lesion:'Esguince grado II', prof:'Lic. Romero', sesiones:3, sesionesAuth:10, fotoMedico:null, deuda:0, estado:'pagado', tipoCobertura:'obra_social', obraSocialId:3 },
    { id:6, nombre:'Lucas Gómez', tel:'261-555-2345', deporte:'Ciclismo', servicio:'Entrenamiento funcional', motivo:'Rendimiento', lesion:'—', prof:'Lic. Paz', sesiones:15, sesionesAuth:null, fotoMedico:null, deuda:0, estado:'pagado', tipoCobertura:'particular', obraSocialId:null },
  ],
  turnos: [],
  asistencia: {},
  pagos: [
    { id:1, fecha:'2025-06-10', paciente:'Martina López', concepto:'Pack 10 sesiones', monto:25000, estado:'Pagado' },
    { id:2, fecha:'2025-06-10', paciente:'Sofía Mendez', concepto:'Pack mensual', monto:18000, estado:'Pagado' },
    { id:3, fecha:'2025-06-11', paciente:'Carlos Herrera', concepto:'Por sesión', monto:3500, estado:'Pendiente' },
    { id:4, fecha:'2025-06-11', paciente:'Diego Ramos', concepto:'Pack 5 sesiones', monto:8000, estado:'Pendiente' },
    { id:5, fecha:'2025-06-12', paciente:'Ana Torres', concepto:'Por sesión', monto:3500, estado:'Pagado' },
  ],
  servicios: [
    { nombre:'Rehabilitación', desc:'Tratamiento kinesiológico de lesiones', icono:'🦴', color:'blue' },
    { nombre:'Readaptación', desc:'Vuelta al deporte post-lesión', icono:'🏃', color:'teal' },
    { nombre:'Entrenamiento funcional', desc:'Acondicionamiento físico especializado', icono:'💪', color:'green' },
    { nombre:'Pilates', desc:'Pilates clínico y terapéutico', icono:'🧘', color:'purple' },
    { nombre:'Recovery', desc:'Presoterapia, crioterapia y más', icono:'❄️', color:'orange' },
  ],
  tarifas: [
    { id:1, servicio:'Rehabilitación', concepto:'Sesión individual', monto:5000 },
    { id:2, servicio:'Rehabilitación', concepto:'Pack 10 sesiones', monto:45000 },
    { id:3, servicio:'Pilates', concepto:'Sesión individual', monto:4000 },
    { id:4, servicio:'Pilates', concepto:'Pack mensual (8 sesiones)', monto:28000 },
    { id:5, servicio:'Recovery', concepto:'Presoterapia (30 min)', monto:6000 },
    { id:6, servicio:'Readaptación', concepto:'Sesión individual', monto:5500 },
    { id:7, servicio:'Entrenamiento funcional', concepto:'Sesión individual', monto:4500 },
  ],
  obrasSociales: [
    { id:1, nombre:'OSDE', cobertura:'80%', servicios:'Rehabilitación, Pilates', contacto:'0800-555-6733', montoPorSesion:4000, adicional10:8000 },
    { id:2, nombre:'Swiss Medical', cobertura:'70%', servicios:'Rehabilitación', contacto:'0810-888-7946', montoPorSesion:3500, adicional10:6000 },
    { id:3, nombre:'Medifé', cobertura:'75%', servicios:'Rehabilitación, Readaptación', contacto:'0810-555-6334', montoPorSesion:3800, adicional10:7000 },
    { id:4, nombre:'Galeno', cobertura:'65%', servicios:'Rehabilitación', contacto:'0800-222-6200', montoPorSesion:3200, adicional10:5000 },
  ],
  gastos: [
    { id:1, concepto:'Alquiler local', categoria:'Infraestructura', monto:180000, vencimiento:'2026-03-10', pagado:true },
    { id:2, concepto:'Luz', categoria:'Servicios', monto:28000, vencimiento:'2026-03-15', pagado:true },
    { id:3, concepto:'Internet', categoria:'Servicios', monto:12000, vencimiento:'2026-03-20', pagado:false },
    { id:4, concepto:'Sueldo Lic. García', categoria:'Sueldos', monto:250000, vencimiento:'2026-03-30', pagado:false },
    { id:5, concepto:'Sueldo Lic. Romero', categoria:'Sueldos', monto:230000, vencimiento:'2026-03-30', pagado:false },
    { id:6, concepto:'Sueldo Lic. Paz', categoria:'Sueldos', monto:220000, vencimiento:'2026-03-30', pagado:false },
    { id:7, concepto:'Insumos y materiales', categoria:'Insumos', monto:35000, vencimiento:'2026-03-25', pagado:true },
    { id:8, concepto:'Seguro del local', categoria:'Infraestructura', monto:18000, vencimiento:'2026-03-05', pagado:true },
  ]
};

let currentInformePacienteId = null;

const pacienteDefaults = {
  email: '',
  edad: '',
  antecedentes: '',
  evaluacion: '',
  objetivo: '',
  etapaActual: '',
  planRehab: '',
  progresion: '',
  observaciones: ''
};

function deducirEtapaPaciente(paciente) {
  if(paciente.etapaActual) return paciente.etapaActual;
  const sesiones = paciente.sesiones || 0;
  if(sesiones === 0) return 'Evaluación inicial';
  if(sesiones <= 2) return 'Control del dolor';
  if(sesiones <= 5) return 'Movilidad y activación';
  if(sesiones <= 10) return 'Fortalecimiento';
  if(sesiones <= 15) return 'Readaptación funcional';
  return 'Retorno al deporte';
}

function normalizarPaciente(paciente) {
  const normalizado = { ...pacienteDefaults, ...paciente };
  if(!normalizado.etapaActual) normalizado.etapaActual = deducirEtapaPaciente(normalizado);
  return normalizado;
}

state.pacientes = state.pacientes.map(normalizarPaciente);

// Generar turnos de ejemplo
function initTurnos() {
  const hoy = new Date();
  const pacs = ['Martina López','Carlos Herrera','Sofía Mendez','Diego Ramos','Ana Torres','Lucas Gómez'];
  const servs = ['rehab','gym','pilates','recovery','rehab','gym'];
  const profs = ['Lic. García','Lic. Romero','Lic. Paz','Lic. García','Lic. Romero','Lic. Paz'];
  const horas = ['09:00','09:45','10:30','11:15','14:00','15:00','16:00','17:00'];
  
  for(let d=-1; d<=5; d++) {
    const fecha = new Date(hoy); fecha.setDate(hoy.getDate() + d);
    const fechaStr = fecha.toISOString().split('T')[0];
    if(fecha.getDay() === 0) continue; // sin domingos
    const qty = Math.floor(Math.random()*4)+3;
    for(let i=0;i<qty;i++) {
      state.turnos.push({
        id: state.turnos.length+1,
        paciente: pacs[i % pacs.length],
        fecha: fechaStr,
        hora: horas[i % horas.length],
        duracion: [30,45,60][i%3],
        servicio: ['Rehabilitación','Readaptación','Pilates','Recovery'][i%4],
        servClass: servs[i % servs.length],
        prof: profs[i % profs.length],
        asistencia: null
      });
    }
  }
}

// ===== NAV =====
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if(n.getAttribute('onclick') && n.getAttribute('onclick').includes("'"+page+"'")) n.classList.add('active');
  });
  const bnavEl = document.getElementById('bnav-'+page);
  if(bnavEl) bnavEl.classList.add('active');
  state.currentPage = page;
  renderPage(page);
}

function toggleMasMenu() {
  const m = document.getElementById('mas-menu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', e => {
  const m = document.getElementById('mas-menu');
  if(m && !m.contains(e.target) && !e.target.closest('#bnav-mas')) m.style.display = 'none';
});

function renderPage(page) {
  if(page==='dashboard') renderDashboard();
  if(page==='agenda') renderAgenda();
  if(page==='pacientes') renderPacientes();
  if(page==='asistencia') renderAsistencia();
  if(page==='pagos') renderPagos();
  if(page==='cobranzas') renderCobranzas();
  if(page==='recordatorios') renderRecordatorios();
  if(page==='servicios') renderServicios();
}

// ===== DASHBOARD =====
function renderDashboard() {
  const hoy = new Date();
  document.getElementById('hoy-fecha').textContent = hoy.toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  
  const fechaHoy = hoy.toISOString().split('T')[0];
  const turnosHoy = state.turnos.filter(t => t.fecha === fechaHoy);
  document.getElementById('stat-hoy').textContent = turnosHoy.length;
  
  const list = document.getElementById('turnos-hoy-list');
  if(turnosHoy.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">No hay turnos para hoy</p>';
  } else {
    list.innerHTML = turnosHoy.slice(0,5).map(t => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:20px;width:28px;text-align:center">${servicioEmoji(t.servicio)}</span>
        <div style="flex:1">
          <div style="font-weight:500;font-size:14px">${t.paciente}</div>
          <div style="font-size:12px;color:var(--text-muted)">${t.hora} · ${t.prof}</div>
        </div>
        <span class="badge badge-${servicioColor(t.servicio)}">${t.servicio}</span>
      </div>
    `).join('');
  }
  
  const caja = document.getElementById('caja-list');
  const cobrado = state.pagos.filter(p => p.estado === 'Pagado').reduce((s,p)=>s+p.monto,0);
  caja.innerHTML = state.pagos.slice(-4).reverse().map(p => `
    <div class="caja-row">
      <div>
        <div style="font-size:14px;font-weight:500">${p.paciente}</div>
        <div style="font-size:12px;color:var(--text-muted)">${p.concepto} · ${p.fecha}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:600;${p.estado==='Pagado'?'color:var(--green)':'color:var(--red)'}">$${p.monto.toLocaleString('es-AR')}</div>
        <span class="badge ${p.estado==='Pagado'?'badge-green':'badge-red'}">${p.estado}</span>
      </div>
    </div>
  `).join('');

  // Alertas de sesiones
  const alertasSesiones = state.pacientes.filter(p => {
    if(p.sesionesAuth == null) return false;
    const restantes = p.sesionesAuth - p.sesiones;
    return restantes <= 1 && restantes >= 0;
  });
  const alertasEl = document.getElementById('alertas-sesiones-dash');
  if(alertasSesiones.length > 0) {
    alertasEl.innerHTML = alertasSesiones.map(p => {
      const restantes = p.sesionesAuth - p.sesiones;
      return `
        <div style="background:${restantes===0?'var(--red-light)':'var(--orange-light)'};border:1px solid ${restantes===0?'#fecaca':'#fed7aa'};border-radius:var(--radius-sm);padding:12px 16px;display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:20px">${restantes===0?'??':'??'}</span>
          <div style="flex:1">
            <strong>${p.nombre}</strong> —
            ${restantes===0
              ? '<span style="color:var(--red)">Agotó todas sus sesiones autorizadas</span>'
              : '<span style="color:var(--orange)">Le queda <strong>1 sesión</strong> autorizada</span>'}
          </div>
          <button class="btn btn-sm btn-secondary" onclick="navigate('pacientes')">Ver</button>
        </div>`;
    }).join('');
    alertasEl.style.display = 'block';
  } else {
    alertasEl.innerHTML = '';
    alertasEl.style.display = 'none';
  }
}

// ===== AGENDA =====
let weekOffset = 0;
let dayOffset = 0; // for mobile single-day view
let filtroActividad = '';

function changeWeek(dir) {
  if(isMobile()) {
    dayOffset += dir;
    // Skip Sundays
    const hoy = new Date();
    const dia = new Date(hoy); dia.setDate(hoy.getDate() + dayOffset);
    if(dia.getDay() === 0) dayOffset += dir; // skip Sunday in same direction
  } else {
    weekOffset += dir;
  }
  renderAgenda();
}

function setFiltroActividad(btn, serv) {
  filtroActividad = serv;
  document.querySelectorAll('.filtro-act').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAgenda();
}

function renderAgenda() {
  const hoy = new Date();

  if(isMobile()) {
    // Single day view on mobile
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() + dayOffset);
    const diaNom = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    document.getElementById('week-label').textContent =
      `${diaNom[dia.getDay()]} ${dia.getDate()}/${dia.getMonth()+1}/${dia.getFullYear()}`;

    const horas = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];
    const fechaStr = dia.toISOString().split('T')[0];
    const esHoy = dia.toDateString() === hoy.toDateString();
    const grid = document.getElementById('agenda-grid');
    let html = '<div class="cell agenda-header"></div>';
    html += `<div class="cell agenda-header" style="${esHoy?'background:var(--primary-light);color:var(--primary);font-weight:700':''}">${diaNom[dia.getDay()]} ${dia.getDate()}</div>`;
    horas.forEach(hora => {
      html += `<div class="cell agenda-time">${hora}</div>`;
      const horaH = parseInt(hora.split(':')[0]);
      const slotTurnos = state.turnos.filter(t => {
        if(t.fecha !== fechaStr) return false;
        if(parseInt(t.hora.split(':')[0]) !== horaH) return false;
        if(filtroActividad && t.servClass !== filtroActividad) return false;
        return true;
      });
      let slotHtml = slotTurnos.map(t => `
        <div class="turno ${t.servClass}" onclick="event.stopPropagation();mostrarTurno(${t.id})"
          title="${t.paciente}">
          <span style="font-weight:600">${t.paciente.split(' ')[0]}</span>
          <span style="opacity:.75;font-size:10px;margin-left:3px">${t.hora}</span>
        </div>`).join('');
      html += `<div class="cell agenda-slot" onclick="abrirNuevoTurno('${fechaStr}','${hora}')">
        ${slotHtml}
        <div class="slot-add-btn" onclick="event.stopPropagation();abrirNuevoTurno('${fechaStr}','${hora}')">+</div>
      </div>`;
    });
    grid.innerHTML = html;
    return;
  }

  // Desktop: weekly view
  const lunes = new Date(hoy);  lunes.setDate(hoy.getDate() - ((hoy.getDay()||7)-1) + weekOffset*7);
  const dias = [];
  for(let i=0;i<6;i++) {
    const d = new Date(lunes); d.setDate(lunes.getDate()+i);
    dias.push(d);
  }
  document.getElementById('week-label').textContent =
    `${lunes.getDate()}/${lunes.getMonth()+1} — ${dias[5].getDate()}/${dias[5].getMonth()+1}/${dias[5].getFullYear()}`;

  const horas = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];
  const diaNom = ['Lun','Mar','Mié','Jue','Vie','Sáb'];
  const grid = document.getElementById('agenda-grid');
  let html = '<div class="cell agenda-header"></div>';
  dias.forEach((d,i) => {
    const esHoy = d.toDateString() === hoy.toDateString();
    html += `<div class="cell agenda-header" style="${esHoy?'background:var(--primary-light);color:var(--primary);font-weight:700':''}">${diaNom[i]} ${d.getDate()}</div>`;
  });
  horas.forEach(hora => {
    html += `<div class="cell agenda-time">${hora}</div>`;
    dias.forEach(d => {
      const fechaStr = d.toISOString().split('T')[0];
      const horaH = parseInt(hora.split(':')[0]);
      const slotTurnos = state.turnos.filter(t => {
        if(t.fecha !== fechaStr) return false;
        if(parseInt(t.hora.split(':')[0]) !== horaH) return false;
        if(filtroActividad && t.servClass !== filtroActividad) return false;
        return true;
      });
      let slotHtml = slotTurnos.map(t => `
        <div class="turno ${t.servClass}" onclick="event.stopPropagation();mostrarTurno(${t.id})"
          title="${t.paciente} · ${t.prof} · ${t.duracion}min">
          <span style="font-weight:600">${t.paciente.split(' ')[0]}</span>
          <span style="opacity:.75;font-size:10px;margin-left:3px">${t.hora}</span>
        </div>`).join('');
      html += `<div class="cell agenda-slot" onclick="abrirNuevoTurno('${fechaStr}','${hora}')">
        ${slotHtml}
        <div class="slot-add-btn" onclick="event.stopPropagation();abrirNuevoTurno('${fechaStr}','${hora}')">+</div>
      </div>`;
    });
  });
  grid.innerHTML = html;
}
  
function abrirNuevoTurno(fecha, hora) {
  document.getElementById('turno-fecha').value = fecha;
  document.getElementById('turno-hora').value = hora;
  openModal('modal-turno');
}

function mostrarTurno(id) {
  const t = state.turnos.find(x => x.id === id);
  if(!t) return;
  const asistLabel = t.asistencia === 'asistio' ? '? Asistió'
    : t.asistencia === 'ausente' ? '? Ausente'
    : t.asistencia === 'reprog' ? '? Reprogramado'
    : '— Pendiente';
  document.getElementById('turno-detalle-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div style="font-size:32px">${servicioEmoji(t.servicio)}</div>
      <div>
        <div style="font-size:17px;font-weight:600">${t.paciente}</div>
        <div style="font-size:13px;color:var(--text-muted)">${t.prof}</div>
      </div>
    </div>
    <div class="grid-2" style="gap:10px;margin-bottom:16px">
      <div style="background:var(--bg);border-radius:8px;padding:10px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);margin-bottom:3px">Fecha y hora</div>
        <div style="font-size:14px;font-weight:500">${t.fecha} · ${t.hora}</div>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:10px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);margin-bottom:3px">Duración</div>
        <div style="font-size:14px;font-weight:500">${t.duracion} min</div>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:10px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);margin-bottom:3px">Servicio</div>
        <div style="font-size:14px;font-weight:500">${t.servicio}</div>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:10px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);margin-bottom:3px">Asistencia</div>
        <div style="font-size:14px;font-weight:500">${asistLabel}</div>
      </div>
    </div>
    ${t.notas ? `<div style="background:var(--primary-light);border-radius:8px;padding:10px;font-size:13px;color:var(--primary)">📝 ${t.notas}</div>` : ''}
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-sm btn-success" onclick="marcarTurnoAsist(${t.id},'asistio')">? Asistió</button>
      <button class="btn btn-sm btn-danger" onclick="marcarTurnoAsist(${t.id},'ausente')">? Ausente</button>
      <button class="btn btn-sm btn-secondary" onclick="marcarTurnoAsist(${t.id},'reprog')">? Reprogramar</button>
      <button class="btn btn-sm btn-secondary" onclick="eliminarTurno(${t.id})" style="margin-left:auto;color:var(--red)">Eliminar</button>
    </div>
  `;
  openModal('modal-turno-detalle');
}

function marcarTurnoAsist(id, estado) {
  const t = state.turnos.find(x => x.id === id);
  if(t) { t.asistencia = t.asistencia === estado ? null : estado; }
  closeModal('modal-turno-detalle');
  renderAgenda();
}

function eliminarTurno(id) {
  if(!confirm('¿Eliminar este turno?')) return;
  state.turnos = state.turnos.filter(x => x.id !== id);
  closeModal('modal-turno-detalle');
  renderAgenda();
}

// ===== PACIENTES =====
function isMobile() { return window.innerWidth <= 900; }

function renderPacientes(filtro='', servFiltro='') {
  const pacsFiltrados = state.pacientes.filter(p => {
    const matchNombre = p.nombre.toLowerCase().includes(filtro.toLowerCase()) || p.lesion.toLowerCase().includes(filtro.toLowerCase());
    const matchServ = !servFiltro || p.servicio === servFiltro;
    return matchNombre && matchServ;
  });

  // Toggle desktop vs mobile view
  const desktopEl = document.getElementById('pacientes-tabla-desktop');
  const mobileEl  = document.getElementById('pacientes-cards-mobile');
  if(desktopEl) desktopEl.style.display = isMobile() ? 'none' : 'block';
  if(mobileEl)  mobileEl.style.display  = isMobile() ? 'block' : 'none';
  
  const tbody = document.getElementById('tbody-pacientes');
  tbody.innerHTML = pacsFiltrados.map(p => {
    const restantes = p.sesionesAuth != null ? p.sesionesAuth - p.sesiones : null;
    const sesAlert = restantes === 0 ? 'badge-red' : restantes === 1 ? 'badge-orange' : 'badge-gray';
    const sesLabel = p.sesionesAuth != null
      ? `${p.sesiones}/${p.sesionesAuth} ${restantes===0?'??':restantes===1?'??':''}`
      : `${p.sesiones}`;
    return `
    <tr>
      <td><strong>${p.nombre}</strong></td>
      <td>${p.tel}</td>
      <td><span class="badge badge-${servicioColor(p.servicio)}">${p.servicio}</span></td>
      <td>${p.lesion}</td>
      <td>${p.prof}</td>
      <td style="text-align:center">
        ${p.sesionesAuth != null
          ? `<span class="badge ${sesAlert}" style="font-size:12px">${sesLabel}</span>`
          : `<span style="font-weight:600">${p.sesiones}</span>`}
      </td>
      <td><span class="badge ${p.deuda>0?'badge-red':'badge-green'}">${p.deuda>0?'Debe $'+p.deuda.toLocaleString():'Al día'}</span></td>
      <td style="display:flex;gap:6px">
        <button class="btn btn-sm btn-secondary" onclick="verPaciente(${p.id})">Ver ficha</button>
        <button class="btn btn-sm" style="background:var(--red-light);color:var(--red)" onclick="confirmarBorrarPaciente(${p.id})">?</button>
      </td>
    </tr>`;
  }).join('');

  // Mobile cards
  if(mobileEl) {
    mobileEl.innerHTML = pacsFiltrados.length === 0
      ? '<p style="padding:20px;color:var(--text-muted);text-align:center;font-size:13px">Sin pacientes</p>'
      : pacsFiltrados.map(p => {
          const restantes = p.sesionesAuth != null ? p.sesionesAuth - p.sesiones : null;
          const sesLabel = p.sesionesAuth != null
            ? `${p.sesiones}/${p.sesionesAuth} ${restantes===0?'??':restantes===1?'??':''}`
            : `${p.sesiones}`;
          const sesColor = restantes===0?'var(--red)':restantes===1?'var(--orange)':'var(--primary)';
          const os = p.tipoCobertura==='obra_social' && p.obraSocialId
            ? state.obrasSociales.find(x=>x.id===p.obraSocialId)?.nombre || ''
            : '';
          return `
          <div class="pac-card">
            <div class="pac-card-top">
              <div>
                <div class="pac-card-nombre">${p.nombre}</div>
                <div style="margin-top:3px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  <span class="badge badge-${servicioColor(p.servicio)}">${p.servicio}</span>
                  ${os ? `<span class="badge badge-blue">${os}</span>` : '<span class="badge badge-gray">Particular</span>'}
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-size:18px;font-weight:700;color:${sesColor}">${sesLabel}</div>
                <div style="font-size:10px;color:var(--text-muted)">sesiones</div>
              </div>
            </div>
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:6px">
              🩺 ${p.lesion || '—'} &nbsp;·&nbsp; 👨 ${p.prof}
            </div>
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">
              ☎️ ${p.tel || '—'}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span class="badge ${p.deuda>0?'badge-red':'badge-green'}">${p.deuda>0?'Debe $'+p.deuda.toLocaleString('es-AR'):'Al día'}</span>
              <div class="pac-card-actions">
                <button class="btn btn-sm btn-secondary" onclick="verPaciente(${p.id})">Ver ficha</button>
                <button class="btn btn-sm" style="background:var(--red-light);color:var(--red)" onclick="confirmarBorrarPaciente(${p.id})">? Borrar</button>
              </div>
            </div>
          </div>`;
        }).join('');
  }

  // populate modal selects
  const opts = state.pacientes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  document.getElementById('turno-paciente').innerHTML = '<option>— Seleccionar —</option>'+opts;
  document.getElementById('pago-paciente').innerHTML = opts;
}

function filtrarPacientes(v) { renderPacientes(v); }
function filtrarPorServicio(v) { renderPacientes('', v); }

function confirmarBorrarPaciente(id) {
  const p = state.pacientes.find(x => x.id === id);
  if(!p) return;
  document.getElementById('borrar-pac-nombre').textContent = p.nombre;
  document.getElementById('borrar-pac-detalle').textContent =
    `${p.sesiones} sesiones · ${state.turnos.filter(t => t.paciente === p.nombre).length} turnos en agenda`;
  document.getElementById('btn-confirmar-borrar').onclick = () => borrarPaciente(id);
  document.getElementById('modal-borrar-pac').classList.add('open');
}

function borrarPaciente(id) {
  const p = state.pacientes.find(x => x.id === id);
  if(!p) return;
  state.pacientes = state.pacientes.filter(x => x.id !== id);
  state.turnos = state.turnos.filter(t => t.paciente !== p.nombre);
  document.getElementById('modal-borrar-pac').classList.remove('open');
  renderPacientes();
}

function verPaciente(id) {
  const p = state.pacientes.find(x => x.id === id);
  if(!p) return;
  const turnPac = state.turnos.filter(t => t.paciente === p.nombre);
  const asistidos = turnPac.filter(t => t.asistencia === 'asistio').length;

  document.getElementById('ficha-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border)">
      <div style="width:52px;height:52px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">
        ${servicioEmoji(p.servicio)}
      </div>
      <div>
        <div style="font-size:18px;font-weight:600">${p.nombre}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:2px">${p.prof} · <span class="badge badge-${servicioColor(p.servicio)}">${p.servicio}</span></div>
      </div>
    </div>
    <div class="grid-2" style="margin-bottom:16px;gap:12px">
      <div style="background:var(--bg);border-radius:var(--radius-sm);padding:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:4px">Teléfono</div>
        <div style="font-size:14px;font-weight:500">${p.tel || '—'}</div>
      </div>
      <div style="background:var(--bg);border-radius:var(--radius-sm);padding:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:4px">Deporte</div>
        <div style="font-size:14px;font-weight:500">${p.deporte || '—'}</div>
      </div>
      <div style="background:var(--bg);border-radius:var(--radius-sm);padding:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:4px">Lesión / Diagnóstico</div>
        <div style="font-size:14px;font-weight:500">${p.lesion || '—'}</div>
      </div>
      <div style="background:var(--bg);border-radius:var(--radius-sm);padding:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:4px">Motivo de consulta</div>
        <div style="font-size:14px;font-weight:500">${p.motivo || '—'}</div>
      </div>
    </div>
    ${(() => {
      if(p.tipoCobertura === 'obra_social' && p.obraSocialId) {
        const os = state.obrasSociales.find(x => x.id === p.obraSocialId);
        if(os) return `
          <div style="background:var(--primary-light);border:1px solid var(--primary-soft);border-radius:var(--radius-sm);padding:12px;margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--primary);margin-bottom:8px">🏥 ${os.nombre}</div>
            <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px">
              <div><span style="color:var(--text-muted)">Cobertura:</span> <strong>${os.cobertura}</strong></div>
              <div><span style="color:var(--text-muted)">Reconoce x sesión:</span> <strong style="color:var(--green)">$${(os.montoPorSesion||0).toLocaleString('es-AR')}</strong></div>
              <div><span style="color:var(--text-muted)">Adicional x10:</span> <strong style="color:var(--primary)">$${(os.adicional10||0).toLocaleString('es-AR')}</strong></div>
            </div>
          </div>`;
      }
      return `<div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px 14px;margin-bottom:16px;font-size:13px;color:var(--text-muted)">💳 Paciente particular</div>`;
    })()}
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <div style="flex:1;text-align:center;background:var(--primary-light);border-radius:var(--radius-sm);padding:12px">
        <div style="font-size:26px;font-weight:700;color:var(--primary)">${p.sesiones}</div>
        <div style="font-size:12px;color:var(--text-muted)">realizadas</div>
      </div>
      ${p.sesionesAuth != null ? (() => {
        const restantes = p.sesionesAuth - p.sesiones;
        const color = restantes === 0 ? 'var(--red)' : restantes === 1 ? 'var(--orange)' : 'var(--teal)';
        const bg = restantes === 0 ? 'var(--red-light)' : restantes === 1 ? 'var(--orange-light)' : 'var(--teal-light)';
        return `<div style="flex:1;text-align:center;background:${bg};border-radius:var(--radius-sm);padding:12px">
          <div style="font-size:26px;font-weight:700;color:${color}">${restantes}</div>
          <div style="font-size:12px;color:var(--text-muted)">restantes de ${p.sesionesAuth}</div>
        </div>`;
      })() : ''}
      <div style="flex:1;text-align:center;background:var(--green-light);border-radius:var(--radius-sm);padding:12px">
        <div style="font-size:26px;font-weight:700;color:var(--green)">${asistidos}</div>
        <div style="font-size:12px;color:var(--text-muted)">asistencias</div>
      </div>
      <div style="flex:1;text-align:center;background:${p.deuda>0?'var(--red-light)':'var(--green-light)'};border-radius:var(--radius-sm);padding:12px">
        <div style="font-size:26px;font-weight:700;color:${p.deuda>0?'var(--red)':'var(--green)'}">$${p.deuda.toLocaleString('es-AR')}</div>
        <div style="font-size:12px;color:var(--text-muted)">deuda</div>
      </div>
    </div>
    ${p.fotoMedico ? `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px">📄 Pedido médico</div>
        <div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;background:var(--bg);padding:10px;text-align:center">
          ${p.fotoMedico.src && p.fotoMedico.src.startsWith('data:image')
            ? `<img src="${p.fotoMedico.src}" style="max-width:100%;max-height:200px;border-radius:6px;cursor:pointer" onclick="window.open(this.src)">`
            : `<div style="font-size:13px;color:var(--text-muted)">📄 ${p.fotoMedico.nombre}</div>`}
        </div>
      </div>` : ''}
    <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Historial de turnos</div>
    ${turnPac.length === 0
      ? '<p style="color:var(--text-muted);font-size:13px">Sin turnos registrados</p>'
      : turnPac.slice(-5).reverse().map(t => `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:16px">${servicioEmoji(t.servicio)}</span>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500">${t.fecha} · ${t.hora}</div>
            <div style="font-size:12px;color:var(--text-muted)">${t.prof} · ${t.duracion}min</div>
          </div>
          ${t.asistencia === 'asistio' ? '<span class="badge badge-green">Asistió</span>'
            : t.asistencia === 'ausente' ? '<span class="badge badge-red">Ausente</span>'
            : t.asistencia === 'reprog' ? '<span class="badge badge-orange">Reprog.</span>'
            : '<span class="badge badge-gray">Pendiente</span>'}
        </div>
      `).join('')
    }
  `;
  openModal('modal-ficha');
}

// ===== ASISTENCIA =====
function renderAsistencia() {
  const fechaInput = document.getElementById('fecha-asist');
  if(!fechaInput.value) {
    const hoy = new Date(); fechaInput.value = hoy.toISOString().split('T')[0];
  }
  const fecha = fechaInput.value;
  const turnosDia = state.turnos.filter(t => t.fecha === fecha);
  
  let asistio=0, ausente=0, reprog=0;
  turnosDia.forEach(t => {
    if(t.asistencia==='asistio') asistio++;
    else if(t.asistencia==='ausente') ausente++;
    else if(t.asistencia==='reprog') reprog++;
  });
  
  document.getElementById('asist-count').textContent = asistio;
  document.getElementById('aus-count').textContent = ausente;
  document.getElementById('rep-count').textContent = reprog;
  
  const list = document.getElementById('asist-list');
  if(turnosDia.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:16px 0;text-align:center">No hay turnos para esta fecha</p>';
    return;
  }
  list.innerHTML = turnosDia.map(t => `
    <div class="asist-row">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:22px">${servicioEmoji(t.servicio)}</span>
        <div>
          <div style="font-weight:500">${t.paciente}</div>
          <div style="font-size:12px;color:var(--text-muted)">${t.hora} · ${t.duracion}min · ${t.prof}</div>
        </div>
      </div>
      <div class="asist-actions">
        <button class="asist-btn asistio ${t.asistencia==='asistio'?'active-asistio':''}" onclick="marcarAsist(${t.id},'asistio')" title="Asistió">?</button>
        <button class="asist-btn ausente ${t.asistencia==='ausente'?'active-ausente':''}" onclick="marcarAsist(${t.id},'ausente')" title="Ausente">?</button>
        <button class="asist-btn reprog ${t.asistencia==='reprog'?'active-reprog':''}" onclick="marcarAsist(${t.id},'reprog')" title="Reprogramar">?</button>
      </div>
    </div>
  `).join('');
}

function marcarAsist(turnoId, estado) {
  const t = state.turnos.find(x => x.id===turnoId);
  if(!t) return;
  const eraAsistio = t.asistencia === 'asistio';
  const ahoraAsistio = estado === 'asistio' && !eraAsistio;
  const dejóDeAsistir = eraAsistio && estado !== 'asistio';

  t.asistencia = t.asistencia===estado ? null : estado;

  // Actualizar sesiones del paciente
  const pac = state.pacientes.find(p => p.nombre === t.paciente);
  if(pac) {
    if(ahoraAsistio) {
      pac.sesiones = (pac.sesiones || 0) + 1;
      // Si tiene sesiones autorizadas, verificar estado
      if(pac.sesionesAuth != null) {
        const restantes = pac.sesionesAuth - pac.sesiones;
        if(restantes === 0) {
          // Usó la última — mostrar cartel celebración
          setTimeout(() => mostrarCompletado(pac), 300);
        } else if(restantes === 1) {
          // Aviso: le queda 1
          renderDashboard(); // actualiza alertas
        }
      }
    } else if(dejóDeAsistir) {
      pac.sesiones = Math.max(0, (pac.sesiones || 0) - 1);
    }
  }

  renderAsistencia();
  if(state.currentPage === 'dashboard') renderDashboard();
}

function mostrarCompletado(pac) {
  document.getElementById('completado-nombre').textContent = pac.nombre;
  document.getElementById('completado-sesiones').textContent = pac.sesionesAuth;
  document.getElementById('modal-completado').classList.add('open');
}

// ===== PAGOS (gastos del centro) =====
let filtroGastos = 'todos';

function setFiltroGastos(btn, filtro) {
  filtroGastos = filtro;
  document.querySelectorAll('#page-pagos .filtro-act').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPagos();
}

const categoriaIcono = { Sueldos:'💼', Infraestructura:'🏢', Servicios:'💡', Insumos:'📦', Impuestos:'🧾', Otros:'📌' };
const categoriaColor = { Sueldos:'purple', Infraestructura:'blue', Servicios:'teal', Insumos:'orange', Impuestos:'red', Otros:'gray' };

function renderPagos() {
  const hoy = new Date();
  const pendientes = state.gastos.filter(g => !g.pagado);
  const pagados    = state.gastos.filter(g => g.pagado);
  const totalPend  = pendientes.reduce((s,g) => s+g.monto, 0);
  const totalPag   = pagados.reduce((s,g) => s+g.monto, 0);

  document.getElementById('gasto-total-pendiente').textContent = '$' + totalPend.toLocaleString('es-AR');
  document.getElementById('gasto-total-pagado').textContent    = '$' + totalPag.toLocaleString('es-AR');
  document.getElementById('gasto-total-mes').textContent       = '$' + (totalPend+totalPag).toLocaleString('es-AR');

  let lista = [...state.gastos];
  if(filtroGastos === 'pendiente') lista = lista.filter(g => !g.pagado);
  if(filtroGastos === 'pagado')    lista = lista.filter(g => g.pagado);
  // Pendientes primero, luego por vencimiento
  lista.sort((a,b) => {
    if(!a.pagado && b.pagado) return -1;
    if(a.pagado && !b.pagado) return 1;
    return (a.vencimiento||'').localeCompare(b.vencimiento||'');
  });

  const checklist = document.getElementById('gastos-checklist');
  if(lista.length === 0) {
    checklist.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center">No hay gastos para mostrar</p>';
    return;
  }

  // Agrupar por categoría
  const grupos = {};
  lista.forEach(g => {
    if(!grupos[g.categoria]) grupos[g.categoria] = [];
    grupos[g.categoria].push(g);
  });

  checklist.innerHTML = Object.entries(grupos).map(([cat, items]) => `
    <div style="margin-bottom:4px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);padding:8px 4px 4px;display:flex;align-items:center;gap:6px">
        <span>${categoriaIcono[cat] || '📌'}</span> ${cat}
      </div>
      ${items.map(g => {
        const venc = g.vencimiento ? new Date(g.vencimiento) : null;
        const vencido = venc && !g.pagado && venc < hoy;
        const vencHoy = venc && !g.pagado && venc.toDateString() === hoy.toDateString();
        return `
          <div class="pago-checklist-item ${g.pagado?'cobrado':''}" onclick="toggleGasto(${g.id})">
            <div class="pago-check ${g.pagado?'checked':''}">
              ${g.pagado ? '✓' : ''}
            </div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:14px;${g.pagado?'text-decoration:line-through;color:var(--text-muted)':''}">${g.concepto}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
                Vence: ${g.vencimiento||'—'}
                ${vencido ? '<span style="color:var(--red);font-weight:600;margin-left:6px">⚠️ Vencido</span>' : ''}
                ${vencHoy ? '<span style="color:var(--orange);font-weight:600;margin-left:6px">⏳ Hoy</span>' : ''}
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700;font-size:15px;${g.pagado?'color:var(--text-muted)':vencido?'color:var(--red)':'color:var(--text)'}">${g.pagado?'':'-'}$${g.monto.toLocaleString('es-AR')}</div>
              <button onclick="event.stopPropagation();eliminarGasto(${g.id})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:11px;margin-top:2px">Eliminar</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');
}

function toggleGasto(id) {
  const g = state.gastos.find(x => x.id === id);
  if(g) g.pagado = !g.pagado;
  renderPagos();
}

function guardarGasto() {
  const concepto = document.getElementById('gasto-concepto').value.trim();
  if(!concepto) { alert('Ingresá el concepto'); return; }
  state.gastos.push({
    id: Date.now(),
    concepto,
    categoria: document.getElementById('gasto-categoria').value,
    monto: parseInt(document.getElementById('gasto-monto').value) || 0,
    vencimiento: document.getElementById('gasto-vencimiento').value,
    pagado: document.getElementById('gasto-estado').value === 'true'
  });
  document.getElementById('gasto-concepto').value = '';
  document.getElementById('gasto-monto').value = '';
  closeModal('modal-gasto');
  renderPagos();
}

function eliminarGasto(id) {
  state.gastos = state.gastos.filter(x => x.id !== id);
  renderPagos();
}

// ===== COBRANZAS =====
function renderCobranzas() {
  const pagados  = state.pagos.filter(p=>p.estado==='Pagado').reduce((s,p)=>s+p.monto,0);
  const pendiente = state.pagos.filter(p=>p.estado==='Pendiente').reduce((s,p)=>s+p.monto,0);

  document.getElementById('caja-hoy').textContent  = '$'+pagados.toLocaleString('es-AR');
  document.getElementById('caja-mes').textContent  = '$'+pagados.toLocaleString('es-AR');
  document.getElementById('caja-deuda').textContent = '$'+pendiente.toLocaleString('es-AR');

  // Toggle desktop/mobile
  const tablaD = document.getElementById('cobranzas-tabla-desktop');
  const cardsM = document.getElementById('cobranzas-cards-mobile');
  const histD  = document.getElementById('cobranzas-hist-desktop');
  const histM  = document.getElementById('cobranzas-hist-mobile');
  if(tablaD) tablaD.style.display = isMobile() ? 'none' : 'block';
  if(cardsM) cardsM.style.display = isMobile() ? 'block' : 'none';
  if(histD)  histD.style.display  = isMobile() ? 'none' : 'block';
  if(histM)  histM.style.display  = isMobile() ? 'block' : 'none';

  // Alertas
  const deudores = state.pacientes.filter(p => p.deuda > 0);
  const alertDiv = document.getElementById('alertas-deuda');
  alertDiv.innerHTML = deudores.map(p => `
    <div class="deuda-alert">
      <span style="font-size:22px">📱</span>
      <div style="flex:1">
        <strong>${p.nombre}</strong> — deuda de <strong>$${p.deuda.toLocaleString('es-AR')}</strong>
        <span style="font-size:12px;color:var(--text-muted);margin-left:8px">${p.servicio}</span>
      </div>
      <button class="btn btn-sm btn-primary" onclick="abrirCobro(${p.id})">Cobrar</button>
    </div>
  `).join('');

  // Por paciente
  const os = (p) => {
    if(p.tipoCobertura === 'obra_social' && p.obraSocialId) {
      const o = state.obrasSociales.find(x => x.id === p.obraSocialId);
      return o ? `<span class="badge badge-blue">${o.nombre}</span>` : '—';
    }
    return '<span class="badge badge-gray">Particular</span>';
  };
  document.getElementById('tbody-cobranzas-pacientes').innerHTML = state.pacientes.map(p => `
    <tr>
      <td><strong>${p.nombre}</strong></td>
      <td>${p.servicio}</td>
      <td>${os(p)}</td>
      <td style="text-align:center">${p.sesiones}</td>
      <td style="${p.deuda>0?'color:var(--red);font-weight:600':''}">$${p.deuda.toLocaleString('es-AR')}</td>
      <td><span class="badge ${p.deuda>0?'badge-red':'badge-green'}">${p.deuda>0?'Pendiente':'Al día'}</span></td>
      <td><button class="btn btn-sm btn-primary" onclick="abrirCobro(${p.id})">Cobrar</button></td>
    </tr>
  `).join('');

  // Historial
  document.getElementById('tbody-cobranzas-hist').innerHTML = [...state.pagos].reverse().map(p => `
    <tr>
      <td>${p.fecha}</td>
      <td>${p.paciente}</td>
      <td>${p.concepto}</td>
      <td style="font-weight:600">$${p.monto.toLocaleString('es-AR')}</td>
      <td><span class="badge ${p.estado==='Pagado'?'badge-green':'badge-red'}">${p.estado}</span></td>
    </tr>
  `).join('');

  // Mobile cards - por paciente
  const mobileEl = document.getElementById('cobranzas-cards-mobile');
  if(mobileEl) {
    mobileEl.innerHTML = state.pacientes.map(p => `
      <div class="pac-card">
        <div class="pac-card-top">
          <div>
            <div class="pac-card-nombre">${p.nombre}</div>
            <div style="margin-top:3px;display:flex;gap:6px;flex-wrap:wrap">
              <span class="badge badge-${servicioColor(p.servicio)}">${p.servicio}</span>
              ${os(p)}
            </div>
          </div>
          <span class="badge ${p.deuda>0?'badge-red':'badge-green'}" style="font-size:13px">${p.deuda>0?'$'+p.deuda.toLocaleString('es-AR'):'Al día'}</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:10px">
          ${p.sesiones} sesiones realizadas
        </div>
        <button class="btn btn-sm btn-primary" style="width:100%" onclick="abrirCobro(${p.id})">💸 Cobrar</button>
      </div>
    `).join('');
  }

  // Mobile historial
  const histMobile = document.getElementById('cobranzas-hist-mobile');
  if(histMobile) {
    histMobile.innerHTML = [...state.pagos].reverse().map(p => `
      <div class="pac-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-weight:600;font-size:14px">${p.paciente}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${p.concepto} · ${p.fecha}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;font-size:15px;${p.estado==='Pagado'?'color:var(--green)':'color:var(--red)'}">$${p.monto.toLocaleString('es-AR')}</div>
            <span class="badge ${p.estado==='Pagado'?'badge-green':'badge-red'}" style="margin-top:4px">${p.estado}</span>
          </div>
        </div>
      </div>
    `).join('');
  }
}

// ===== RECORDATORIOS =====
function renderRecordatorios() {
  const hoy = new Date();
  const manana = new Date(hoy); manana.setDate(hoy.getDate()+1);
  const manStr = manana.toISOString().split('T')[0];
  const turnosManana = state.turnos.filter(t => t.fecha === manStr);
  
  document.getElementById('rec-enviados').textContent = 12;
  
  const prox = document.getElementById('proximos-rec');
  if(turnosManana.length === 0) {
    prox.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No hay turnos para mañana</p>';
  } else {
    prox.innerHTML = turnosManana.map(t => `
      <div class="reminder-item">
        <div class="reminder-status pending"></div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${t.paciente}</div>
          <div style="font-size:11px;color:var(--text-muted)">Mañana ${t.hora} · Se enviará en ~2 hs</div>
        </div>
        <span style="font-size:16px">📱</span>
      </div>
    `).join('');
  }
  
  document.getElementById('hist-rec').innerHTML = state.pacientes.slice(0,6).map((p,i) => `
    <div class="reminder-item">
      <div class="reminder-status"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500">${p.nombre}</div>
        <div style="font-size:11px;color:var(--text-muted)">Enviado el ${new Date(Date.now()-i*86400000).toLocaleDateString('es-AR')} · Respondió ?</div>
      </div>
      <span class="badge badge-green">Enviado</span>
    </div>
  `).join('');
}

function guardarRecConfig() {
  alert('? Configuración guardada.\n\nLos recordatorios se enviarán automáticamente\n' + document.getElementById('rec-tiempo1').options[document.getElementById('rec-tiempo1').selectedIndex].text);
}

// ===== SERVICIOS =====
function renderServicios() {
  document.getElementById('servicios-grid').innerHTML = state.servicios.map(s => {
    const pacs = state.pacientes.filter(p => p.servicio === s.nombre).length;
    const turnos = state.turnos.filter(t => t.servicio === s.nombre).length;
    return `
      <div class="servicio-card" onclick="verServicio('${s.nombre.replace(/'/g,"\\'")}')">
        <div class="servicio-icon">${s.icono}</div>
        <h4>${s.nombre}</h4>
        <p>${s.desc}</p>
        <div style="display:flex;gap:12px;margin-top:12px;align-items:flex-end;justify-content:space-between">
          <div style="display:flex;gap:12px">
            <div><div class="servicio-count" style="color:var(--${s.color||'primary'})">${pacs}</div><div style="font-size:12px;color:var(--text-muted)">pacientes</div></div>
            <div><div class="servicio-count" style="color:var(--${s.color||'primary'})">${turnos}</div><div style="font-size:12px;color:var(--text-muted)">turnos totales</div></div>
          </div>
          <span style="font-size:12px;color:var(--primary);font-weight:600">Ver detalle ?</span>
        </div>
      </div>
    `;
  }).join('');

  // Tarifas
  const tarifasList = document.getElementById('tarifas-list');
  if(state.tarifas.length === 0) {
    tarifasList.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Sin tarifas cargadas.</p>';
  } else {
    const byServicio = {};
    state.tarifas.forEach(t => {
      if(!byServicio[t.servicio]) byServicio[t.servicio] = [];
      byServicio[t.servicio].push(t);
    });
    tarifasList.innerHTML = Object.entries(byServicio).map(([serv, items]) => `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">${serv}</div>
        ${items.map(t => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg);border-radius:6px;margin-bottom:4px">
            <span style="font-size:13px">${t.concepto}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:700;font-size:14px;color:var(--green)">$${t.monto.toLocaleString('es-AR')}</span>
              <button onclick="eliminarTarifa(${t.id})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;padding:2px">?</button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  // Obras sociales
  const osList = document.getElementById('obras-sociales-list');
  if(state.obrasSociales.length === 0) {
    osList.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Sin obras sociales cargadas.</p>';
  } else {
    osList.innerHTML = state.obrasSociales.map(os => `
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:10px;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--white)">
          <div>
            <div style="font-weight:700;font-size:14px">${os.nombre}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:1px">${os.servicios} · ${os.contacto}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge badge-blue">${os.cobertura}</span>
            <button onclick="eliminarObraSocial(${os.id})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;padding:2px">?</button>
          </div>
        </div>
        <div style="display:flex;gap:0;border-top:1px solid var(--border)">
          <div style="flex:1;padding:8px 14px;background:var(--green-light);text-align:center">
            <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--green);margin-bottom:2px">Reconoce x sesión</div>
            <div style="font-size:16px;font-weight:700;color:var(--green)">$${(os.montoPorSesion||0).toLocaleString('es-AR')}</div>
          </div>
          <div style="flex:1;padding:8px 14px;background:var(--primary-light);text-align:center;border-left:1px solid var(--border)">
            <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--primary);margin-bottom:2px">Adicional x10 sesiones</div>
            <div style="font-size:16px;font-weight:700;color:var(--primary)">$${(os.adicional10||0).toLocaleString('es-AR')}</div>
          </div>
        </div>
      </div>
    `).join('');
  }
}

function guardarTarifa() {
  const concepto = document.getElementById('tarifa-concepto').value.trim();
  if(!concepto) { alert('Ingresá el concepto'); return; }
  state.tarifas.push({
    id: Date.now(),
    servicio: document.getElementById('tarifa-serv').value,
    concepto,
    monto: parseInt(document.getElementById('tarifa-monto').value) || 0
  });
  document.getElementById('tarifa-concepto').value = '';
  document.getElementById('tarifa-monto').value = '';
  closeModal('modal-tarifa');
  renderServicios();
}

function eliminarTarifa(id) {
  state.tarifas = state.tarifas.filter(t => t.id !== id);
  renderServicios();
}

function guardarObraSocial() {
  const nombre = document.getElementById('os-nombre').value.trim();
  if(!nombre) { alert('Ingresá el nombre'); return; }
  state.obrasSociales.push({
    id: Date.now(),
    nombre,
    cobertura: document.getElementById('os-cobertura').value,
    montoPorSesion: parseInt(document.getElementById('os-monto-sesion').value) || 0,
    adicional10: parseInt(document.getElementById('os-adicional10').value) || 0,
    servicios: document.getElementById('os-servicios').value,
    contacto: document.getElementById('os-contacto').value
  });
  ['os-nombre','os-cobertura','os-servicios','os-contacto','os-monto-sesion','os-adicional10'].forEach(id => document.getElementById(id).value = '');
  closeModal('modal-obrasocial');
  renderServicios();
}

function eliminarObraSocial(id) {
  state.obrasSociales = state.obrasSociales.filter(o => o.id !== id);
  renderServicios();
}

function verServicio(nombreServicio) {
  const s = state.servicios.find(x => x.nombre === nombreServicio);
  const pacientes = state.pacientes.filter(p => p.servicio === nombreServicio);
  const turnosSrv = state.turnos.filter(t => t.servicio === nombreServicio);

  document.getElementById('servicio-modal-title').textContent = (s?.icono || '') + ' ' + nombreServicio;

  if(pacientes.length === 0) {
    document.getElementById('servicio-detail-content').innerHTML = `
      <p style="color:var(--text-muted);font-size:14px;text-align:center;padding:24px 0">No hay pacientes en este servicio aún.</p>
    `;
  } else {
    document.getElementById('servicio-detail-content').innerHTML = pacientes.map(p => {
      const turnsPac = turnosSrv.filter(t => t.paciente === p.nombre);
      const proximoTurno = turnsPac.filter(t => t.fecha >= new Date().toISOString().split('T')[0]).sort((a,b) => a.fecha.localeCompare(b.fecha))[0];
      return `
        <div class="servicio-pac-item" id="spac-${p.id}">
          <div class="servicio-pac-header" onclick="toggleServicioPac(${p.id})">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:38px;height:38px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">
                ${servicioEmoji(p.servicio)}
              </div>
              <div>
                <div style="font-weight:600;font-size:14px">${p.nombre}</div>
                <div style="font-size:12px;color:var(--text-muted)">${p.lesion || 'Sin lesión registrada'} · ${p.prof}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              ${proximoTurno ? `<span class="badge badge-blue">Próx: ${proximoTurno.fecha} ${proximoTurno.hora}</span>` : '<span class="badge badge-gray">Sin turnos</span>'}
              <span style="color:var(--text-muted);font-size:16px;transition:transform .2s" id="spac-arrow-${p.id}">?</span>
            </div>
          </div>
          <div class="servicio-pac-turnos" id="spac-turnos-${p.id}" style="display:none">
            ${turnsPac.length === 0
              ? '<p style="color:var(--text-muted);font-size:13px;padding:8px 0 4px">Sin turnos registrados en este servicio.</p>'
              : turnsPac.sort((a,b) => b.fecha.localeCompare(a.fecha)).map(t => `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                  <div style="text-align:center;background:var(--bg);border-radius:6px;padding:4px 8px;min-width:60px">
                    <div style="font-size:11px;font-weight:700;color:var(--primary)">${t.hora}</div>
                    <div style="font-size:10px;color:var(--text-muted)">${t.fecha.slice(5)}</div>
                  </div>
                  <div style="flex:1">
                    <div style="font-size:13px;font-weight:500">${t.prof} · ${t.duracion}min</div>
                    ${t.notas ? `<div style="font-size:11px;color:var(--text-muted)">${t.notas}</div>` : ''}
                  </div>
                  ${t.asistencia === 'asistio' ? '<span class="badge badge-green">? Asistió</span>'
                    : t.asistencia === 'ausente' ? '<span class="badge badge-red">? Ausente</span>'
                    : t.asistencia === 'reprog' ? '<span class="badge badge-orange">? Reprog.</span>'
                    : '<span class="badge badge-gray">Pendiente</span>'}
                </div>
              `).join('')
            }
            <div style="margin-top:10px;display:flex;gap:8px">
              <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();verPaciente(${p.id});closeModal('modal-servicio-detail')">Ver ficha completa</button>
              <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();document.getElementById('turno-paciente-pre','${p.id}');openModal('modal-turno')">+ Turno</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('modal-servicio-detail').classList.add('open');
}

function toggleServicioPac(id) {
  const el = document.getElementById(`spac-turnos-${id}`);
  const arrow = document.getElementById(`spac-arrow-${id}`);
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? '' : 'rotate(-90deg)';
}

// ===== TABS =====
function switchTab(section, tab) {
  document.querySelectorAll(`#tabs-${section} .tab`).forEach(t => t.classList.remove('active'));
  document.querySelectorAll(`[id^="tab-${section}-"]`).forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(`tab-${section}-${tab}`).classList.add('active');
}

function populatePacienteSelects() {
  const turnoOpts = '<option value="">— Seleccionar —</option>' + state.pacientes.map(p => {
    const agotado = p.sesionesAuth != null && state.turnos.filter(t => t.paciente === p.nombre).length >= p.sesionesAuth;
    return `<option value="${p.id}" ${agotado ? 'style="color:var(--red)"' : ''}>${p.nombre}${agotado ? ' 🚫 sin sesiones' : ''}</option>`;
  }).join('');
  document.getElementById('turno-paciente').innerHTML = turnoOpts;
  document.getElementById('pago-paciente').innerHTML = state.pacientes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  const osSelect = document.getElementById('pac-os-select');
  if(osSelect) {
    osSelect.innerHTML = '<option value="">— Seleccionar —</option>' + state.obrasSociales.map(os => `<option value="${os.id}">${os.nombre}</option>`).join('');
  }
}

function onCoberturaChange() {
  const val = document.getElementById('pac-cobertura').value;
  document.getElementById('pac-os-section').style.display = val === 'obra_social' ? 'block' : 'none';
  document.getElementById('pac-os-info').style.display = 'none';
}

function onObrasSocialChange() {
  const id = parseInt(document.getElementById('pac-os-select').value);
  const os = state.obrasSociales.find(x => x.id === id);
  const infoDiv = document.getElementById('pac-os-info');
  if(os) {
    document.getElementById('pac-os-monto').textContent = '$' + (os.montoPorSesion||0).toLocaleString('es-AR');
    document.getElementById('pac-os-adicional').textContent = '$' + (os.adicional10||0).toLocaleString('es-AR');
    document.getElementById('pac-os-cobertura').textContent = os.cobertura;
    infoDiv.style.display = 'block';
  } else {
    infoDiv.style.display = 'none';
  }
}

// ===== MODALES =====
function openModal(id) {
  populatePacienteSelects();
  document.getElementById(id).classList.add('open');
  // Pre-fill horas
  if(id === 'modal-turno') {
    const sel = document.getElementById('turno-hora');
    if(!sel.children.length) {
      for(let h=8;h<=19;h++) {
        ['00','15','30','45'].forEach(m => {
          const opt = document.createElement('option');
          opt.value = opt.textContent = `${String(h).padStart(2,'0')}:${m}`;
          sel.appendChild(opt);
        });
      }
    }
    if(!document.getElementById('turno-fecha').value) {
      document.getElementById('turno-fecha').value = new Date().toISOString().split('T')[0];
    }
  }
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if(e.target === m) m.classList.remove('open'); });
});

// ===== GUARDAR =====
function guardarTurno() {
  const pac = document.getElementById('turno-paciente');
  const pacId = pac.value;
  const nombre = pac.options[pac.selectedIndex]?.text;
  if(!pacId) { alert('Seleccioná un paciente'); return; }

  // Verificar sesiones autorizadas vs turnos agendados (usados + pendientes)
  const pacObj = state.pacientes.find(p => p.id === parseInt(pacId));
  if(pacObj && pacObj.sesionesAuth != null) {
    const turnosDelPac = state.turnos.filter(t => t.paciente === pacObj.nombre).length;
    const restantes = pacObj.sesionesAuth - turnosDelPac;
    if(restantes <= 0) {
      mostrarBloqueado(pacObj, turnosDelPac);
      return;
    }
    if(restantes === 1) {
      if(!confirm(`⚠️ ${pacObj.nombre} tiene solo 1 turno disponible de ${pacObj.sesionesAuth} autorizados.\n¿Querés agendar igual?`)) return;
    }
  }

  const serv = document.getElementById('turno-servicio').value;
  const servClassMap = { 'Rehabilitación':'rehab','Readaptación':'gym','Pilates':'pilates','Recovery':'recovery','Entrenamiento funcional':'gym' };
  state.turnos.push({
    id: state.turnos.length+1,
    paciente: nombre,
    fecha: document.getElementById('turno-fecha').value,
    hora: document.getElementById('turno-hora').value,
    duracion: parseInt(document.getElementById('turno-duracion').value),
    servicio: serv,
    servClass: servClassMap[serv]||'rehab',
    prof: document.getElementById('turno-prof').value,
    asistencia: null
  });
  closeModal('modal-turno');
  if(state.currentPage === 'agenda') renderAgenda();
  else if(state.currentPage === 'dashboard') renderDashboard();
}

function mostrarBloqueado(pac, turnosAgendados) {
  document.getElementById('bloqueado-nombre').textContent = pac.nombre;
  document.getElementById('bloqueado-auth').textContent = pac.sesionesAuth;
  const detalle = document.getElementById('bloqueado-detalle');
  if(detalle) detalle.textContent = `Ya tiene ${turnosAgendados} turno${turnosAgendados!==1?'s':''} agendado${turnosAgendados!==1?'s':''} de ${pac.sesionesAuth} autorizado${pac.sesionesAuth!==1?'s':''}.`;
  document.getElementById('modal-bloqueado').classList.add('open');
}

function previewFotoMedico(input) {
  const file = input.files[0];
  if(!file) return;
  document.getElementById('pac-foto-nombre').textContent = file.name;
  if(file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('pac-foto-img').src = e.target.result;
      document.getElementById('pac-foto-preview').style.display = 'block';
      document.getElementById('pac-foto-drop').style.display = 'none';
    };
    reader.readAsDataURL(file);
  } else {
    document.getElementById('pac-foto-img').src = '';
    document.getElementById('pac-foto-nombre').textContent = '📄 ' + file.name;
    document.getElementById('pac-foto-preview').style.display = 'block';
    document.getElementById('pac-foto-drop').style.display = 'none';
  }
}

function limpiarFotoMedico() {
  document.getElementById('pac-foto-input').value = '';
  document.getElementById('pac-foto-preview').style.display = 'none';
  document.getElementById('pac-foto-drop').style.display = 'block';
  document.getElementById('pac-foto-img').src = '';
}

function guardarPaciente() {
  const nombre = document.getElementById('pac-nombre').value.trim();
  if(!nombre) { alert('Ingresá el nombre del paciente'); return; }
  const tipoCobertura = document.getElementById('pac-cobertura').value;
  const obraSocialId = tipoCobertura === 'obra_social' ? parseInt(document.getElementById('pac-os-select').value) || null : null;
  const sesAuth = parseInt(document.getElementById('pac-sesiones-auth').value) || null;
  const sesReal = parseInt(document.getElementById('pac-sesiones-real').value) || 0;

  // Guardar foto como dataURL si existe
  const fotoImg = document.getElementById('pac-foto-img').src;
  const fotoNombre = document.getElementById('pac-foto-nombre').textContent;
  const fotoMedico = fotoImg && fotoImg !== window.location.href ? { src: fotoImg, nombre: fotoNombre } : null;

  state.pacientes.push({
    id: Date.now(),
    nombre,
    tel: document.getElementById('pac-tel').value,
    deporte: document.getElementById('pac-deporte').value,
    servicio: document.getElementById('pac-servicio').value,
    motivo: document.getElementById('pac-motivo').value,
    lesion: document.getElementById('pac-lesion').value,
    prof: document.getElementById('pac-prof').value,
    sesiones: sesReal,
    sesionesAuth: sesAuth,
    fotoMedico,
    deuda: 0, estado: 'pagado',
    tipoCobertura,
    obraSocialId
  });

  ['pac-nombre','pac-tel','pac-deporte','pac-motivo','pac-lesion'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pac-cobertura').value = 'particular';
  document.getElementById('pac-sesiones-auth').value = '';
  document.getElementById('pac-sesiones-real').value = '0';
  document.getElementById('pac-os-section').style.display = 'none';
  limpiarFotoMedico();
  closeModal('modal-paciente');
  renderPacientes();
}

function onCobroTipoChange() {
  const tipo = document.getElementById('cobro-tipo').value;
  if(tipo === 'Salda deuda') {
    const pacId = parseInt(document.getElementById('cobro-pac-id').value);
    const p = state.pacientes.find(x => x.id === pacId);
    if(p && p.deuda > 0) {
      document.getElementById('cobro-monto').value = p.deuda;
      document.getElementById('cobro-estado').value = 'Pagado';
    }
  }
}

function abrirCobro(pacId) {
  const p = state.pacientes.find(x => x.id === pacId);
  if(!p) return;

  document.getElementById('cobro-modal-titulo').textContent = p.nombre;
  document.getElementById('cobro-pac-id').value = pacId;
  document.getElementById('cobro-deuda-actual').textContent = p.deuda > 0
    ? `Deuda actual: $${p.deuda.toLocaleString('es-AR')}`
    : 'Sin deuda pendiente';
  document.getElementById('cobro-deuda-actual').style.color = p.deuda > 0 ? 'var(--red)' : 'var(--green)';
  document.getElementById('cobro-tipo').value = 'Por sesión';
  document.getElementById('cobro-monto').value = '';
  document.getElementById('cobro-estado').value = 'Pagado';
  document.getElementById('modal-cobro').classList.add('open');
}

function confirmarCobro() {
  const pacId = parseInt(document.getElementById('cobro-pac-id').value);
  const monto = parseInt(document.getElementById('cobro-monto').value) || 0;
  const tipo = document.getElementById('cobro-tipo').value;
  const estado = document.getElementById('cobro-estado').value;

  if(!monto) { alert('Ingresá el monto'); return; }

  const p = state.pacientes.find(x => x.id === pacId);
  if(p && estado === 'Pagado' && p.deuda > 0) {
    p.deuda = Math.max(0, p.deuda - monto);
    if(p.deuda === 0) p.estado = 'pagado';
  } else if(p && estado === 'Pendiente') {
    p.deuda += monto;
    p.estado = 'pendiente';
  }

  state.pagos.push({
    id: Date.now(),
    fecha: new Date().toISOString().split('T')[0],
    paciente: p?.nombre || '',
    concepto: tipo,
    monto,
    estado
  });

  document.getElementById('modal-cobro').classList.remove('open');
  renderPagos();
  if(state.currentPage === 'cobranzas') renderCobranzas();
}

function guardarPago() {
  const pac = document.getElementById('pago-paciente');
  const monto = parseInt(document.getElementById('pago-monto').value)||0;
  const estado = document.getElementById('pago-estado').value;
  const pacNombre = pac.options[pac.selectedIndex]?.text || '';

  state.pagos.push({
    id: Date.now(),
    fecha: new Date().toISOString().split('T')[0],
    paciente: pacNombre,
    concepto: document.getElementById('pago-tipo').value,
    monto,
    estado
  });

  // Actualizar deuda del paciente
  const p = state.pacientes.find(x => x.nombre === pacNombre);
  if(p) {
    if(estado === 'Pendiente') { p.deuda += monto; p.estado = 'pendiente'; }
    else if(estado === 'Pagado' && p.deuda > 0) { p.deuda = Math.max(0, p.deuda - monto); if(p.deuda===0) p.estado='pagado'; }
  }

  closeModal('modal-pago');
  renderPagos();
}

function guardarServicio() {
  const nombre = document.getElementById('serv-nombre').value.trim();
  if(!nombre) { alert('Ingresá el nombre'); return; }
  state.servicios.push({ nombre, desc: document.getElementById('serv-desc').value, icono: document.getElementById('serv-icono').value || '?' });
  closeModal('modal-servicio');
  renderServicios();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function obtenerPacienteInforme(id) {
  const pacienteId = id ?? currentInformePacienteId;
  if(!pacienteId) return null;
  const paciente = state.pacientes.find(x => x.id === pacienteId);
  if(!paciente) return null;
  currentInformePacienteId = pacienteId;
  return normalizarPaciente(paciente);
}

function generarInformePacienteTexto(p) {
  const turnos = state.turnos
    .filter(t => t.paciente === p.nombre)
    .sort((a, b) => (`${b.fecha} ${b.hora}`).localeCompare(`${a.fecha} ${a.hora}`));
  const ultimoTurno = turnos[0];
  const obraSocial = p.tipoCobertura === 'obra_social' && p.obraSocialId
    ? state.obrasSociales.find(x => x.id === p.obraSocialId)
    : null;
  const restantes = p.sesionesAuth != null ? Math.max(p.sesionesAuth - p.sesiones, 0) : 'Sin tope';

  return [
    'INFORME DE PLAN DE REHABILITACION Y PROGRESION',
    '',
    `Paciente: ${p.nombre}`,
    `Edad: ${p.edad || 'No informada'}`,
    `Profesional: ${p.prof || 'No asignado'}`,
    `Servicio: ${p.servicio || 'No definido'}`,
    `Etapa actual: ${p.etapaActual || deducirEtapaPaciente(p)}`,
    `Cobertura: ${obraSocial ? obraSocial.nombre : 'Particular'}`,
    '',
    `Motivo de consulta: ${p.motivo || 'Sin dato'}`,
    `Lesion / diagnostico: ${p.lesion || 'Sin dato'}`,
    `Antecedentes: ${p.antecedentes || 'Sin antecedentes cargados.'}`,
    `Evaluacion inicial: ${p.evaluacion || 'Sin evaluacion cargada.'}`,
    '',
    `Objetivo principal: ${p.objetivo || 'Sin objetivo definido.'}`,
    `Plan de rehabilitacion: ${p.planRehab || 'Sin plan cargado.'}`,
    `Progresion observada / prevista: ${p.progresion || 'Sin progresion registrada.'}`,
    `Observaciones: ${p.observaciones || 'Sin observaciones.'}`,
    '',
    `Sesiones realizadas: ${p.sesiones}`,
    `Sesiones restantes: ${restantes}${p.sesionesAuth != null ? ` de ${p.sesionesAuth}` : ''}`,
    `Ultimo turno: ${ultimoTurno ? `${ultimoTurno.fecha} ${ultimoTurno.hora}` : 'Sin turnos registrados'}`,
    '',
    'Este informe fue generado desde KineApp.'
  ].join('\n');
}

function abrirInformePaciente(id) {
  const paciente = obtenerPacienteInforme(id);
  if(!paciente) return;

  const informe = generarInformePacienteTexto(paciente);
  document.getElementById('informe-content').innerHTML = `
    <div class="report-meta">
      <div class="report-chip">${paciente.nombre}</div>
      <div class="report-chip">${paciente.servicio}</div>
      <div class="report-chip">${paciente.etapaActual || deducirEtapaPaciente(paciente)}</div>
    </div>
    <div class="report-preview">${escapeHtml(informe)}</div>
  `;
  openModal('modal-informe');
}

function copiarInformePaciente() {
  const paciente = obtenerPacienteInforme();
  if(!paciente) return;
  const texto = generarInformePacienteTexto(paciente);

  if(navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto)
      .then(() => alert('Informe copiado al portapapeles.'))
      .catch(() => alert('No se pudo copiar el informe.'));
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = texto;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  alert('Informe copiado al portapapeles.');
}

function compartirInformeWhatsApp(id) {
  const paciente = obtenerPacienteInforme(id);
  if(!paciente) return;
  if(!paciente.tel) {
    alert('Este paciente no tiene telÃ©fono cargado.');
    return;
  }

  const telefono = paciente.tel.replace(/\D/g, '');
  const texto = encodeURIComponent(generarInformePacienteTexto(paciente));
  window.open(`https://wa.me/${telefono}?text=${texto}`, '_blank');
}

function compartirInformeMail(id) {
  const paciente = obtenerPacienteInforme(id);
  if(!paciente) return;

  const asunto = encodeURIComponent(`Informe de rehabilitaciÃ³n - ${paciente.nombre}`);
  const cuerpo = encodeURIComponent(generarInformePacienteTexto(paciente));
  const destinatario = encodeURIComponent(paciente.email || '');
  window.location.href = `mailto:${destinatario}?subject=${asunto}&body=${cuerpo}`;
}

function guardarPaciente() {
  const nombre = document.getElementById('pac-nombre').value.trim();
  if(!nombre) { alert('IngresÃ¡ el nombre del paciente'); return; }

  const tipoCobertura = document.getElementById('pac-cobertura').value;
  const obraSocialId = tipoCobertura === 'obra_social' ? parseInt(document.getElementById('pac-os-select').value) || null : null;
  const sesAuth = parseInt(document.getElementById('pac-sesiones-auth').value) || null;
  const sesReal = parseInt(document.getElementById('pac-sesiones-real').value) || 0;
  const fotoImg = document.getElementById('pac-foto-img').src;
  const fotoNombre = document.getElementById('pac-foto-nombre').textContent;
  const fotoMedico = fotoImg && fotoImg !== window.location.href ? { src: fotoImg, nombre: fotoNombre } : null;

  state.pacientes.push(normalizarPaciente({
    id: Date.now(),
    nombre,
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
    sesiones: sesReal,
    sesionesAuth: sesAuth,
    fotoMedico,
    deuda: 0,
    estado: 'pagado',
    tipoCobertura,
    obraSocialId
  }));

  [
    'pac-nombre','pac-tel','pac-email','pac-edad','pac-deporte','pac-motivo','pac-lesion',
    'pac-antecedentes','pac-evaluacion','pac-objetivo','pac-plan','pac-progresion','pac-observaciones'
  ].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pac-servicio').selectedIndex = 0;
  document.getElementById('pac-etapa').selectedIndex = 0;
  document.getElementById('pac-prof').selectedIndex = 0;
  document.getElementById('pac-cobertura').value = 'particular';
  document.getElementById('pac-sesiones-auth').value = '';
  document.getElementById('pac-sesiones-real').value = '0';
  document.getElementById('pac-os-select').value = '';
  document.getElementById('pac-os-section').style.display = 'none';
  document.getElementById('pac-os-info').style.display = 'none';
  limpiarFotoMedico();
  closeModal('modal-paciente');
  renderPacientes();
}

function verPaciente(id) {
  const p = obtenerPacienteInforme(id);
  if(!p) return;

  const turnPac = state.turnos.filter(t => t.paciente === p.nombre);
  const asistidos = turnPac.filter(t => t.asistencia === 'asistio').length;
  const restantes = p.sesionesAuth != null ? Math.max(p.sesionesAuth - p.sesiones, 0) : null;
  const obraSocial = p.tipoCobertura === 'obra_social' && p.obraSocialId
    ? state.obrasSociales.find(x => x.id === p.obraSocialId)
    : null;

  document.getElementById('ficha-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border)">
      <div style="width:52px;height:52px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">
        ${servicioEmoji(p.servicio)}
      </div>
      <div>
        <div style="font-size:18px;font-weight:600">${p.nombre}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:2px">${p.prof} · <span class="badge badge-${servicioColor(p.servicio)}">${p.servicio}</span></div>
      </div>
    </div>
    <div class="ficha-actions">
      <button class="btn btn-primary" onclick="abrirInformePaciente(${p.id})">Ver informe</button>
      <button class="btn btn-success" onclick="compartirInformeWhatsApp(${p.id})">WhatsApp</button>
      <button class="btn btn-secondary" onclick="compartirInformeMail(${p.id})">Mail</button>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Ficha clínica individual</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-item-label">Teléfono</div><div class="detail-item-value">${p.tel || '—'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Email</div><div class="detail-item-value">${p.email || '—'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Edad</div><div class="detail-item-value">${p.edad || '—'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Deporte / Actividad</div><div class="detail-item-value">${p.deporte || '—'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Lesión / Diagnóstico</div><div class="detail-item-value">${p.lesion || '—'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Motivo de consulta</div><div class="detail-item-value">${p.motivo || '—'}</div></div>
      </div>
    </div>
    <div class="detail-section soft">
      <div class="detail-section-title">Cobertura y seguimiento</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-item-label">Tipo de cobertura</div><div class="detail-item-value">${obraSocial ? obraSocial.nombre : 'Paciente particular'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Etapa actual</div><div class="detail-item-value">${p.etapaActual || deducirEtapaPaciente(p)}</div></div>
        <div class="detail-item"><div class="detail-item-label">Sesiones realizadas</div><div class="detail-item-value">${p.sesiones}</div></div>
        <div class="detail-item"><div class="detail-item-label">Sesiones restantes</div><div class="detail-item-value">${restantes != null ? `${restantes} de ${p.sesionesAuth}` : 'Sin tope cargado'}</div></div>
      </div>
      ${obraSocial ? `<div style="margin-top:12px;padding:12px;border-radius:10px;background:var(--primary-light);border:1px solid var(--primary-soft);font-size:13px"><strong>${obraSocial.nombre}</strong> · Cobertura ${obraSocial.cobertura} · Reconoce $${(obraSocial.montoPorSesion || 0).toLocaleString('es-AR')} por sesión</div>` : ''}
    </div>
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <div style="flex:1;text-align:center;background:var(--primary-light);border-radius:var(--radius-sm);padding:12px"><div style="font-size:26px;font-weight:700;color:var(--primary)">${p.sesiones}</div><div style="font-size:12px;color:var(--text-muted)">realizadas</div></div>
      ${p.sesionesAuth != null ? (() => {
        const color = restantes === 0 ? 'var(--red)' : restantes === 1 ? 'var(--orange)' : 'var(--teal)';
        const bg = restantes === 0 ? 'var(--red-light)' : restantes === 1 ? 'var(--orange-light)' : 'var(--teal-light)';
        return `<div style="flex:1;text-align:center;background:${bg};border-radius:var(--radius-sm);padding:12px"><div style="font-size:26px;font-weight:700;color:${color}">${restantes}</div><div style="font-size:12px;color:var(--text-muted)">restantes de ${p.sesionesAuth}</div></div>`;
      })() : ''}
      <div style="flex:1;text-align:center;background:var(--green-light);border-radius:var(--radius-sm);padding:12px"><div style="font-size:26px;font-weight:700;color:var(--green)">${asistidos}</div><div style="font-size:12px;color:var(--text-muted)">asistencias</div></div>
      <div style="flex:1;text-align:center;background:${p.deuda>0?'var(--red-light)':'var(--green-light)'};border-radius:var(--radius-sm);padding:12px"><div style="font-size:26px;font-weight:700;color:${p.deuda>0?'var(--red)':'var(--green)'}">$${p.deuda.toLocaleString('es-AR')}</div><div style="font-size:12px;color:var(--text-muted)">deuda</div></div>
    </div>
    ${p.fotoMedico ? `<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px">Pedido médico</div><div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;background:var(--bg);padding:10px;text-align:center">${p.fotoMedico.src && p.fotoMedico.src.startsWith('data:image') ? `<img src="${p.fotoMedico.src}" style="max-width:100%;max-height:200px;border-radius:6px;cursor:pointer" onclick="window.open(this.src)">` : `<div style="font-size:13px;color:var(--text-muted)">${p.fotoMedico.nombre}</div>`}</div></div>` : ''}
    <div class="detail-section">
      <div class="detail-section-title">Evaluación y planificación</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-item-label">Antecedentes</div><div class="detail-item-value">${p.antecedentes || 'Sin antecedentes cargados.'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Evaluación inicial</div><div class="detail-item-value">${p.evaluacion || 'Sin evaluación cargada.'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Objetivo principal</div><div class="detail-item-value">${p.objetivo || 'Sin objetivo definido.'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Plan de rehabilitación</div><div class="detail-item-value">${p.planRehab || 'Sin plan cargado.'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Progresión</div><div class="detail-item-value">${p.progresion || 'Sin progresión registrada.'}</div></div>
        <div class="detail-item"><div class="detail-item-label">Observaciones</div><div class="detail-item-value">${p.observaciones || 'Sin observaciones.'}</div></div>
      </div>
    </div>
    <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Historial de turnos</div>
    ${turnPac.length === 0
      ? '<p style="color:var(--text-muted);font-size:13px">Sin turnos registrados</p>'
      : turnPac.slice(-5).reverse().map(t => `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:16px">${servicioEmoji(t.servicio)}</span>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500">${t.fecha} · ${t.hora}</div>
            <div style="font-size:12px;color:var(--text-muted)">${t.prof} · ${t.duracion}min</div>
          </div>
          ${t.asistencia === 'asistio' ? '<span class="badge badge-green">Asistió</span>'
            : t.asistencia === 'ausente' ? '<span class="badge badge-red">Ausente</span>'
            : t.asistencia === 'reprog' ? '<span class="badge badge-orange">Reprog.</span>'
            : '<span class="badge badge-gray">Pendiente</span>'}
        </div>
      `).join('')}
  `;
  openModal('modal-ficha');
}

// ===== UTILS =====
function servicioColor(serv) {
  const m = { 'Rehabilitación':'blue','Readaptación':'teal','Pilates':'purple','Recovery':'orange','Entrenamiento funcional':'green' };
  return m[serv] || 'gray';
}
function servicioEmoji(serv) {
  const m = { 'Rehabilitación':'🦴','Readaptación':'🏃','Pilates':'🧘','Recovery':'❄️','Entrenamiento funcional':'💪' };
  return m[serv] || '📋';
}

// ===== INIT =====
initTurnos();
renderDashboard();

// Re-render on resize (orientation change, window resize)
window.addEventListener('resize', () => {
  if(state.currentPage === 'agenda') renderAgenda();
  if(state.currentPage === 'pacientes') renderPacientes();
  if(state.currentPage === 'cobranzas') renderCobranzas();
});





