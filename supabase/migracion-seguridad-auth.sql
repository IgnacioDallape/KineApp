-- =====================================================================
-- Migración: SEGURIDAD — cerrar la base a usuarios autenticados
-- =====================================================================
-- ⚠️ CORRER SOLO DESPUÉS de confirmar que el login nuevo (Supabase Auth)
--    funciona en producción: que Marcos y kinesico entran y ven sus datos.
--    Si lo corrés antes, la app se queda SIN acceso (los datos NO se pierden,
--    pero no se ven hasta revertir).
--
-- Qué hace: cambia las políticas RLS de 'anon, authenticated' a solo
-- 'authenticated'. Después de esto, la anon key SOLA (la que va en el
-- frontend) ya NO puede leer/escribir nada: hay que estar logueado con
-- Supabase Auth. Eso cierra el agujero crítico (cualquiera con la URL podía
-- leer/escribir/borrar los pacientes).
--
-- NO borra ni modifica NINGUNA fila de datos. Solo cambia quién puede entrar.
-- Es reversible: al final está el bloque de ROLLBACK.
--
-- Cómo correrlo: SQL Editor → New query → pegá este archivo → Run.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'obras_sociales','servicios','pacientes','turnos','pagos',
    'gastos','tarifas','profesionales','papelera'
  ] loop
    execute format('alter table %s enable row level security;', t);
    execute format('drop policy if exists "staff_all" on %s;', t);
    execute format(
      'create policy "staff_all" on %s
         for all to authenticated
         using (true) with check (true);', t);
  end loop;
end $$;

-- Verificación rápida (opcional): debería listar las 9 tablas con roles = {authenticated}
-- select tablename, policyname, roles from pg_policies
--   where schemaname = 'public' and policyname = 'staff_all' order by tablename;

-- =====================================================================
-- ROLLBACK — si algo se rompe, descomentá TODO este bloque y corrélo.
-- Vuelve a abrir el acceso con la anon key (estado anterior). Sin pérdida de datos.
-- =====================================================================
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'obras_sociales','servicios','pacientes','turnos','pagos',
--     'gastos','tarifas','profesionales','papelera'
--   ] loop
--     execute format('drop policy if exists "staff_all" on %s;', t);
--     execute format(
--       'create policy "staff_all" on %s
--          for all to anon, authenticated
--          using (true) with check (true);', t);
--   end loop;
-- end $$;
-- =====================================================================
