-- Solo los mails cargados en public.organizadores pueden crear una cuenta
-- (con contraseña o con Google). Cualquier otro registro se rechaza.
create or replace function privado.solo_organizadores_registran()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.organizadores o
                 where lower(o.email) = lower(new.email) and o.activo) then
    raise exception 'Este mail no está habilitado como organizador de Deportivasa';
  end if;
  return new;
end $$;

drop trigger if exists solo_organizadores_registran on auth.users;
create trigger solo_organizadores_registran
  before insert on auth.users
  for each row execute function privado.solo_organizadores_registran();
