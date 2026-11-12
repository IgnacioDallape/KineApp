-- =====================================================================
-- Migración: CONTADORES ATÓMICOS (anti "lost update") — auditoría #4
-- =====================================================================
-- Crea 2 funciones que suman/restan `sesiones` y `deuda` de un paciente de
-- forma ATÓMICA en el servidor. Así, si dos dispositivos tocan al mismo
-- paciente casi a la vez (ej. vos marcás asistencia y la secretaria cobra),
-- NO se pisan el cambio: no se "pierde" un pago ni una sesión.
--
-- NO borra ni modifica NINGUNA fila de datos. Solo agrega funciones. Es
-- idempotente (create or replace) y reversible (DROP comentado al final).
--
-- La app funciona IGUAL antes y después de correr esto: si las funciones no
-- existen todavía, cae sola al modo anterior. Correrlo solo la mejora.
--
-- Cómo correrlo: SQL Editor → New query → pegá este archivo → Run.
-- =====================================================================

-- Suma p_delta a pacientes.sesiones (nunca baja de 0). Devuelve el valor nuevo.
create or replace function kine_ajustar_sesiones(p_id uuid, p_delta integer)
returns integer
language plpgsql
security invoker
as $$
declare v integer;
begin
  update pacientes
     set sesiones = greatest(0, coalesce(sesiones, 0) + p_delta)
   where id = p_id
   returning sesiones into v;
  return v;
end;
$$;

-- Suma p_delta a pacientes.deuda (nunca baja de 0) y deja el estado coherente
-- (pendiente si queda deuda, pagado si no). Devuelve la deuda nueva.
create or replace function kine_ajustar_deuda(p_id uuid, p_delta integer)
returns integer
language plpgsql
security invoker
as $$
declare v integer;
begin
  update pacientes
     set deuda  = greatest(0, coalesce(deuda, 0) + p_delta),
         estado = case when greatest(0, coalesce(deuda, 0) + p_delta) > 0
                       then 'pendiente' else 'pagado' end
   where id = p_id
   returning deuda into v;
  return v;
end;
$$;

-- Las llama el usuario logueado (rol authenticated). security invoker =>
-- la función respeta RLS (corre con los permisos de quien la llama).
grant execute on function kine_ajustar_sesiones(uuid, integer) to authenticated;
grant execute on function kine_ajustar_deuda(uuid, integer)    to authenticated;

-- Defensa en profundidad: Postgres otorga EXECUTE a public por defecto. Lo
-- quitamos para que SOLO authenticated pueda invocarlas (la RLS ya bloquea a
-- anon el UPDATE, pero así ni siquiera pueden llamarlas). authenticated conserva
-- el permiso por el grant explícito de arriba.
revoke execute on function kine_ajustar_sesiones(uuid, integer) from public;
revoke execute on function kine_ajustar_deuda(uuid, integer)    from public;

-- =====================================================================
-- ROLLBACK (si hiciera falta sacar las funciones; la app vuelve sola al
-- modo viejo). Descomentá y corré:
-- =====================================================================
-- drop function if exists kine_ajustar_sesiones(uuid, integer);
-- drop function if exists kine_ajustar_deuda(uuid, integer);
-- =====================================================================
