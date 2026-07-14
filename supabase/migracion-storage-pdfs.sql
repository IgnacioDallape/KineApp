-- =====================================================================
-- KineApp — Storage para compartir PDFs (informe / rutina) por link de WhatsApp
-- =====================================================================
-- Crea un bucket PRIVADO 'documentos' y deja que la app (rol anon) suba PDFs
-- y genere links firmados con vencimiento. Los archivos se guardan con nombre
-- aleatorio (uuid), así que no son adivinables ni se pueden listar.
--
-- Corré esto UNA sola vez en:  Supabase -> SQL Editor -> New query -> Run
-- =====================================================================

-- 1) Bucket privado
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- 2) Políticas sobre storage.objects (RLS ya viene activo en Supabase).
--    Permitimos SUBIR (insert) y LEER/FIRMAR (select) solo en el bucket 'documentos'.
--    NO damos permiso de listar (list), así nadie puede enumerar los archivos.
drop policy if exists "kine_docs_insert" on storage.objects;
create policy "kine_docs_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'documentos');

drop policy if exists "kine_docs_select" on storage.objects;
create policy "kine_docs_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'documentos');

-- Listo. La app ya puede compartir el informe/rutina como link directo al
-- número de WhatsApp del paciente. Los links vencen a los 60 días
-- (configurable en _PDF_LINK_EXPIRY dentro de assets/js/app.js).
