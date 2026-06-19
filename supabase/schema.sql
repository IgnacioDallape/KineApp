-- =====================================================================
-- KineApp — Schema Supabase (multi-usuario, escalable)
-- =====================================================================
-- Cómo usarlo:
--   1. Creá un proyecto en https://supabase.com
--   2. SQL Editor -> New query -> pegá TODO este archivo -> Run
--   3. Copiá Project URL y anon key (Settings -> API) a assets/js/config.js
--   4. Authentication -> Providers -> Email: activá "Email" (y si querés,
--      desactivá "Confirm email" para dar de alta staff sin verificación)
--   5. Authentication -> Users -> Add user: creá el/los usuarios del staff
--
-- Modelo: una sola clínica con varios usuarios de staff. Todos los usuarios
-- autenticados ven y editan los mismos datos (datos compartidos del centro).
-- Para multi-clínica (varios centros aislados) ver la nota al final.
-- =====================================================================

-- Búsqueda por texto rápida sobre nombres (ilike '%term%') a escala.
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- TABLAS
-- ---------------------------------------------------------------------

create table if not exists obras_sociales (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  cobertura        text,
  servicios        text,
  contacto         text,
  monto_por_sesion integer default 0,
  adicional10      integer default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table if not exists servicios (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  icono       text,
  color       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists pacientes (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  dni             text,
  tel             text,
  email           text,
  edad            text,
  deporte         text,
  servicio        text,
  motivo          text,
  lesion          text,
  prof            text,
  antecedentes    text,
  evaluacion      text,
  objetivo        text,
  etapa_actual    text,
  plan_rehab      text,
  progresion      text,
  observaciones   text,
  sesiones        integer default 0,
  sesiones_auth   integer,                 -- null = sin tope
  foto_medico     jsonb,                   -- { src, nombre } (ver nota Storage)
  eval_clinica    jsonb,                   -- evaluación física/kinesiológica (dolor, obs, etc.)
  total_pagar     integer default 0,       -- total que debe pagar (al alta -> deuda)
  deuda           integer default 0,
  estado          text default 'pagado',
  tipo_cobertura  text default 'particular',
  obra_social_id  uuid references obras_sociales(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists turnos (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid references pacientes(id) on delete cascade,
  paciente    text,                        -- nombre denormalizado (display rápido)
  fecha       date not null,
  hora        text not null,
  duracion    integer default 45,
  servicio    text,
  serv_class  text,
  prof        text,
  notas       text,
  asistencia  text,                        -- null | 'asistio' | 'ausente' | 'reprog'
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists pagos (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid references pacientes(id) on delete set null,
  paciente    text,
  fecha       date not null default current_date,
  concepto    text,
  monto       integer default 0,
  estado      text default 'Pagado',       -- 'Pagado' | 'Pendiente'
  created_at  timestamptz default now()
);

create table if not exists gastos (
  id          uuid primary key default gen_random_uuid(),
  concepto    text not null,
  categoria   text,
  monto       integer default 0,
  vencimiento date,
  pagado      boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists tarifas (
  id         uuid primary key default gen_random_uuid(),
  servicio   text,
  concepto   text,
  monto      integer default 0,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- ÍNDICES (claves para escalar a miles de filas)
-- ---------------------------------------------------------------------
create index if not exists idx_turnos_paciente   on turnos(paciente_id);
create index if not exists idx_turnos_fecha       on turnos(fecha);
create index if not exists idx_pagos_paciente     on pagos(paciente_id);
create index if not exists idx_gastos_pagado      on gastos(pagado);
create index if not exists idx_pacientes_servicio on pacientes(servicio);
create index if not exists idx_pacientes_dni       on pacientes(dni);
create index if not exists idx_pacientes_deuda    on pacientes(deuda);
-- Búsqueda por nombre/lesión sin escanear toda la tabla:
create index if not exists idx_pacientes_nombre_trgm on pacientes using gin (nombre gin_trgm_ops);
create index if not exists idx_pacientes_lesion_trgm on pacientes using gin (lesion gin_trgm_ops);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['obras_sociales','servicios','pacientes','turnos','gastos'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on %1$s;
       create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- RLS — acceso con la anon key (el login real lo controla la app: usuario +
-- contraseña con roles). Datos compartidos del centro.
--   ⚠️ La anon key es pública (va en el frontend). Esto significa que quien
--   tenga la key puede leer/escribir vía la API REST de Supabase. Es aceptable
--   para una herramienta interna/MVP, NO para datos sensibles a gran escala.
--   Para seguridad fuerte: migrar a Supabase Auth (un usuario por kinesiólogo)
--   y cambiar 'to anon, authenticated' por 'to authenticated'. Ver SETUP.md.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['obras_sociales','servicios','pacientes','turnos','pagos','gastos','tarifas'] loop
    execute format('alter table %s enable row level security;', t);
    execute format('drop policy if exists "staff_all" on %s;', t);
    execute format(
      'create policy "staff_all" on %s
         for all to anon, authenticated
         using (true) with check (true);', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- REALTIME — para que los cambios de un usuario lleguen a los demás
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['obras_sociales','servicios','pacientes','turnos','pagos','gastos','tarifas'] loop
    begin
      execute format('alter publication supabase_realtime add table %s;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- SEED — datos de ejemplo (corré una sola vez; borralos cuando vayas a prod)
-- ---------------------------------------------------------------------
insert into obras_sociales (id, nombre, cobertura, servicios, contacto, monto_por_sesion, adicional10) values
  ('00000000-0000-0000-0000-0000000000a1','OSDE','80%','Rehabilitación, Pilates','0800-555-6733',4000,8000),
  ('00000000-0000-0000-0000-0000000000a2','Swiss Medical','70%','Rehabilitación','0810-888-7946',3500,6000),
  ('00000000-0000-0000-0000-0000000000a3','Medifé','75%','Rehabilitación, Readaptación','0810-555-6334',3800,7000),
  ('00000000-0000-0000-0000-0000000000a4','Galeno','65%','Rehabilitación','0800-222-6200',3200,5000)
on conflict (id) do nothing;

insert into servicios (nombre, descripcion, icono, color) values
  ('Rehabilitación','Tratamiento kinesiológico de lesiones','🦴','blue'),
  ('Readaptación','Vuelta al deporte post-lesión','🏃','teal'),
  ('Entrenamiento funcional','Acondicionamiento físico especializado','💪','green'),
  ('Pilates','Pilates clínico y terapéutico','🧘','purple'),
  ('Recovery','Presoterapia, crioterapia y más','❄️','orange')
on conflict do nothing;

insert into pacientes (id, nombre, tel, deporte, servicio, motivo, lesion, prof, sesiones, sesiones_auth, deuda, estado, tipo_cobertura, obra_social_id) values
  ('00000000-0000-0000-0000-0000000000b1','Martina López','261-555-1234','Running','Rehabilitación','Dolor rodilla','Condromalacia rotuliana','Lic. García',12,15,0,'pagado','obra_social','00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2','Carlos Herrera','261-555-5678','Fútbol','Readaptación','Post-cirugía','Rotura LCA','Lic. Romero',8,20,15000,'pendiente','particular',null),
  ('00000000-0000-0000-0000-0000000000b3','Sofía Mendez','261-555-9012','Pilates','Pilates','Fortalecimiento','Lumbalgia crónica','Lic. Paz',20,null,0,'pagado','obra_social','00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000b4','Diego Ramos','261-555-3456','Natación','Recovery','Recuperación','Tendinitis hombro','Lic. García',5,10,8000,'pendiente','particular',null),
  ('00000000-0000-0000-0000-0000000000b5','Ana Torres','261-555-7890','Vóley','Rehabilitación','Dolor tobillo','Esguince grado II','Lic. Romero',3,10,0,'pagado','obra_social','00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000b6','Lucas Gómez','261-555-2345','Ciclismo','Entrenamiento funcional','Rendimiento','—','Lic. Paz',15,null,0,'pagado','particular',null)
on conflict (id) do nothing;

insert into tarifas (servicio, concepto, monto) values
  ('Rehabilitación','Sesión individual',5000),
  ('Rehabilitación','Pack 10 sesiones',45000),
  ('Pilates','Sesión individual',4000),
  ('Pilates','Pack mensual (8 sesiones)',28000),
  ('Recovery','Presoterapia (30 min)',6000),
  ('Readaptación','Sesión individual',5500),
  ('Entrenamiento funcional','Sesión individual',4500)
on conflict do nothing;

insert into gastos (concepto, categoria, monto, vencimiento, pagado) values
  ('Alquiler local','Infraestructura',180000, current_date + 5, true),
  ('Luz','Servicios',28000, current_date + 10, true),
  ('Internet','Servicios',12000, current_date + 15, false),
  ('Sueldo Lic. García','Sueldos',250000, current_date + 12, false),
  ('Sueldo Lic. Romero','Sueldos',230000, current_date + 12, false),
  ('Sueldo Lic. Paz','Sueldos',220000, current_date + 12, false),
  ('Insumos y materiales','Insumos',35000, current_date + 8, true),
  ('Seguro del local','Infraestructura',18000, current_date + 3, true)
on conflict do nothing;

-- =====================================================================
-- NOTAS
-- ---------------------------------------------------------------------
-- • Fotos del pedido médico: hoy se guardan como base64 en pacientes.foto_medico
--   (jsonb). Funciona, pero a escala conviene Supabase Storage (bucket privado)
--   y guardar sólo la ruta. Ver SETUP.md.
-- • Multi-clínica: agregá una columna clinic_id uuid a cada tabla y cambiá las
--   policies a (clinic_id = (select clinic_id from miembros where user_id = auth.uid())).
-- =====================================================================
