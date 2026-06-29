-- =====================================================================
-- Migración: PAPELERA (borrado recuperable)
-- =====================================================================
-- Corré SOLO este archivo en Supabase (SQL Editor → New query → Run).
-- NO vuelvas a correr schema.sql entero.
-- Es idempotente: si ya lo corriste, no rompe nada.
--
-- Con esto, borrar un paciente/turno/etc. NO lo elimina: lo manda a la papelera,
-- desde donde se puede Restaurar o Eliminar definitivamente.
-- =====================================================================

create table if not exists papelera (
  id          uuid primary key default gen_random_uuid(),
  tabla       text not null,        -- 'pacientes' | 'turnos' | 'gastos' | ...
  registro_id uuid,                 -- id original de la fila borrada
  datos       jsonb not null,       -- la fila completa (para poder restaurarla)
  nombre      text,                 -- etiqueta para mostrar en la papelera
  deleted_at  timestamptz default now()
);

create index if not exists idx_papelera_deleted on papelera(deleted_at desc);

-- RLS (igual que el resto: acceso con la anon key)
alter table papelera enable row level security;
drop policy if exists "staff_all" on papelera;
create policy "staff_all" on papelera
  for all to anon, authenticated
  using (true) with check (true);

-- Realtime (opcional; la papelera se consulta al abrirla, no hace falta suscribir)
do $$
begin
  alter publication supabase_realtime add table papelera;
exception when duplicate_object then null;
end $$;
