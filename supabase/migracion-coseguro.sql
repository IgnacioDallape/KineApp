-- =====================================================================
-- KineApp — Marca de "coseguro abonado" por turno
-- =====================================================================
-- Agrega una columna para registrar si el paciente abonó el coseguro de
-- cada turno. Es ADITIVO: NO borra ni cambia ningún dato existente.
-- Corré esto una sola vez en:  Supabase -> SQL Editor -> New query -> Run
-- =====================================================================

alter table turnos add column if not exists coseguro_pagado boolean default false;
