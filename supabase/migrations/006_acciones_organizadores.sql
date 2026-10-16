-- =====================================================================
-- Acciones del sector organizadores (todo en una sola operación segura)
-- Solo las puede ejecutar un organizador.
-- =====================================================================

create or replace function privado.exigir_organizador()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_organizador() then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
end $$;
grant execute on function privado.exigir_organizador() to authenticated;

create or replace function privado.mail_sesion()
returns text language sql stable set search_path = '' as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
grant execute on function privado.mail_sesion() to authenticated;

-- Agregar un jugador directo (o al aprobar una solicitud)
create or replace function public.org_agregar_jugador(
  p_equipo uuid, p_nombre text, p_apellido text, p_dni text,
  p_nacimiento date default null, p_origen text default 'organización')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_torneo uuid; v_cupo int; v_activos int; v_id uuid; v_existente uuid; v_activo boolean;
  v_dni text := nullif(regexp_replace(coalesce(p_dni,''), '[^0-9]', '', 'g'), '');
  v_nombre text := initcap(trim(coalesce(p_nombre,'')));
  v_apellido text := initcap(trim(coalesce(p_apellido,'')));
begin
  perform privado.exigir_organizador();
  if length(v_nombre) < 2 or length(v_apellido) < 2 then raise exception 'datos_incompletos'; end if;
  if v_dni is not null and v_dni !~ '^[0-9]{7,8}$' then raise exception 'dni_invalido'; end if;

  select e.torneo_id, t.cupo_por_equipo into v_torneo, v_cupo
  from public.equipos e join public.torneos t on t.id = e.torneo_id where e.id = p_equipo;
  if v_torneo is null then raise exception 'equipo_inexistente'; end if;

  select count(*) into v_activos from public.jugadores where equipo_id = p_equipo and activo;
  if v_activos >= v_cupo then raise exception 'cupo_completo'; end if;

  if v_dni is not null then
    select jp.jugador_id, j.activo into v_existente, v_activo
    from public.jugadores_privado jp join public.jugadores j on j.id = jp.jugador_id
    where jp.torneo_id = v_torneo and jp.dni = v_dni;
    if v_existente is not null and v_activo then raise exception 'dni_ya_inscripto'; end if;
    if v_existente is not null then
      -- Estaba dado de baja: se reactiva en el equipo nuevo
      update public.jugadores set equipo_id = p_equipo, nombre = v_nombre, apellido = v_apellido,
             activo = true, baja = null, alta = now() where id = v_existente;
      update public.jugadores_privado set nacimiento = coalesce(p_nacimiento, nacimiento),
             cambios = cambios || jsonb_build_object('cuando', now(), 'quien', privado.mail_sesion(), 'que', 'reactivado')
      where jugador_id = v_existente;
      return v_existente;
    end if;
  end if;

  insert into public.jugadores (equipo_id, torneo_id, nombre, apellido)
  values (p_equipo, v_torneo, v_nombre, v_apellido) returning id into v_id;
  insert into public.jugadores_privado (jugador_id, torneo_id, dni, nacimiento, origen, cambios)
  values (v_id, v_torneo, v_dni, p_nacimiento, p_origen,
          jsonb_build_array(jsonb_build_object('cuando', now(), 'quien', privado.mail_sesion(), 'que', 'alta')));
  return v_id;
end $$;

-- Editar datos de un jugador (nombre, apellido, DNI, nacimiento, equipo)
create or replace function public.org_editar_jugador(
  p_jugador uuid, p_nombre text, p_apellido text, p_dni text, p_nacimiento date default null, p_equipo uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_torneo uuid; v_otro uuid;
  v_dni text := nullif(regexp_replace(coalesce(p_dni,''), '[^0-9]', '', 'g'), '');
  v_nombre text := initcap(trim(coalesce(p_nombre,'')));
  v_apellido text := initcap(trim(coalesce(p_apellido,'')));
  v_antes jsonb;
begin
  perform privado.exigir_organizador();
  if length(v_nombre) < 2 or length(v_apellido) < 2 then raise exception 'datos_incompletos'; end if;
  if v_dni is not null and v_dni !~ '^[0-9]{7,8}$' then raise exception 'dni_invalido'; end if;
  select j.torneo_id, jsonb_build_object('nombre', j.nombre, 'apellido', j.apellido, 'dni', jp.dni,
         'nacimiento', jp.nacimiento, 'equipo', j.equipo_id)
    into v_torneo, v_antes
  from public.jugadores j left join public.jugadores_privado jp on jp.jugador_id = j.id where j.id = p_jugador;
  if v_torneo is null then raise exception 'jugador_inexistente'; end if;
  if v_dni is not null then
    select jugador_id into v_otro from public.jugadores_privado
    where torneo_id = v_torneo and dni = v_dni and jugador_id <> p_jugador;
    if v_otro is not null then raise exception 'dni_ya_inscripto'; end if;
  end if;
  update public.jugadores set nombre = v_nombre, apellido = v_apellido,
         equipo_id = coalesce(p_equipo, equipo_id) where id = p_jugador;
  insert into public.jugadores_privado (jugador_id, torneo_id, dni, nacimiento)
  values (p_jugador, v_torneo, v_dni, p_nacimiento)
  on conflict (jugador_id) do update set dni = excluded.dni, nacimiento = excluded.nacimiento,
     cambios = public.jugadores_privado.cambios || jsonb_build_object('cuando', now(), 'quien', privado.mail_sesion(),
               'que', 'edición', 'antes', v_antes);
end $$;

-- Quitar (dar de baja) o devolver a un jugador. No se borra: queda el historial.
create or replace function public.org_baja_jugador(p_jugador uuid, p_activo boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_organizador();
  update public.jugadores set activo = p_activo, baja = case when p_activo then null else now() end where id = p_jugador;
  update public.jugadores_privado set cambios = cambios || jsonb_build_object('cuando', now(), 'quien', privado.mail_sesion(),
         'que', case when p_activo then 'reactivado' else 'baja' end)
  where jugador_id = p_jugador;
end $$;

-- Aprobar una solicitud de delegado
create or replace function public.org_aprobar_solicitud(p_solicitud uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare s record; v_id uuid;
begin
  perform privado.exigir_organizador();
  select * into s from public.solicitudes where id = p_solicitud for update;
  if s.id is null then raise exception 'solicitud_inexistente'; end if;
  if s.estado <> 'pendiente' then raise exception 'solicitud_ya_resuelta'; end if;
  v_id := public.org_agregar_jugador(s.equipo_id, s.nombre, s.apellido, s.dni, s.nacimiento, 'delegado');
  update public.solicitudes set estado = 'aprobada', resuelta = now(), resuelta_por = privado.mail_sesion(),
         jugador_id = v_id where id = p_solicitud;
  return v_id;
end $$;

-- Rechazar una solicitud con motivo
create or replace function public.org_rechazar_solicitud(p_solicitud uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_organizador();
  update public.solicitudes set estado = 'rechazada', motivo = nullif(trim(coalesce(p_motivo,'')), ''),
         resuelta = now(), resuelta_por = privado.mail_sesion()
  where id = p_solicitud and estado = 'pendiente';
  if not found then raise exception 'solicitud_ya_resuelta'; end if;
end $$;

-- Crear equipo con código de delegado generado
create or replace function public.org_crear_equipo(p_torneo uuid, p_nombre text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_nombre text := trim(coalesce(p_nombre,''));
  v_slug text; v_base text; v_codigo text; n int := 0;
begin
  perform privado.exigir_organizador();
  if length(v_nombre) < 2 then raise exception 'datos_incompletos'; end if;
  v_slug := trim(both '-' from regexp_replace(lower(translate(v_nombre,'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')), '[^a-z0-9]+', '-', 'g'));
  v_base := v_slug;
  while exists (select 1 from public.equipos where torneo_id = p_torneo and slug = v_slug) loop
    n := n + 1; v_slug := v_base || '-' || n;
  end loop;
  insert into public.equipos (torneo_id, slug, nombre, orden)
  values (p_torneo, v_slug, v_nombre, coalesce((select max(orden) from public.equipos where torneo_id = p_torneo), 0) + 1)
  returning id into v_id;
  loop
    v_codigo := upper(left(regexp_replace(split_part(v_base, '-', 1), '[^a-z0-9]', '', 'g'), 8))
                || '-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from public.equipos_privado where codigo = v_codigo);
  end loop;
  insert into public.equipos_privado (equipo_id, codigo) values (v_id, v_codigo);
  return v_id;
end $$;

revoke all on function public.org_agregar_jugador(uuid,text,text,text,date,text) from public, anon;
revoke all on function public.org_editar_jugador(uuid,text,text,text,date,uuid) from public, anon;
revoke all on function public.org_baja_jugador(uuid,boolean) from public, anon;
revoke all on function public.org_aprobar_solicitud(uuid) from public, anon;
revoke all on function public.org_rechazar_solicitud(uuid,text) from public, anon;
revoke all on function public.org_crear_equipo(uuid,text) from public, anon;
grant execute on function public.org_agregar_jugador(uuid,text,text,text,date,text) to authenticated;
grant execute on function public.org_editar_jugador(uuid,text,text,text,date,uuid) to authenticated;
grant execute on function public.org_baja_jugador(uuid,boolean) to authenticated;
grant execute on function public.org_aprobar_solicitud(uuid) to authenticated;
grant execute on function public.org_rechazar_solicitud(uuid,text) to authenticated;
grant execute on function public.org_crear_equipo(uuid,text) to authenticated;
