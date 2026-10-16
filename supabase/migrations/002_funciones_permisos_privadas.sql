-- Las funciones de permisos se mueven a un esquema que no se expone en la API pública
create schema if not exists privado;
grant usage on schema privado to anon, authenticated;
alter function public.es_organizador() set schema privado;
alter function public.es_staff() set schema privado;
revoke all on function privado.es_organizador() from public;
revoke all on function privado.es_staff() from public;
grant execute on function privado.es_organizador() to anon, authenticated;
grant execute on function privado.es_staff() to anon, authenticated;
