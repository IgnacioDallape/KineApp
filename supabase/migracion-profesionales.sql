-- =====================================================================
-- Migración: tabla "profesionales" (gestionar profesionales desde la app)
-- =====================================================================
-- Corré SOLO este archivo en Supabase (SQL Editor → New query → Run).
-- NO vuelvas a correr schema.sql entero: re-insertaría los datos de ejemplo.
-- Es idempotente: si ya lo corriste, no rompe nada.
-- =====================================================================

create table if not exists profesionales (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  created_at timestamptz default now()
);

-- RLS (igual que el resto de las tablas: acceso con la anon key)
alter table profesionales enable row level security;
drop policy if exists "staff_all" on profesionales;
create policy "staff_all" on profesionales
  for all to anon, authenticated
  using (true) with check (true);

-- Realtime (para que un alta/baja de profesional se vea en los demás dispositivos)
do $$
begin
  alter publication supabase_realtime add table profesionales;
exception when duplicate_object then null;
end $$;
