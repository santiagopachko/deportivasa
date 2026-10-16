-- El código del delegado usa la palabra más larga del nombre (ej. PIBES-1234 y no LOS-1234)
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
    v_codigo := upper(left((select w from unnest(string_to_array(v_base, '-')) w order by length(w) desc limit 1), 8))
                || '-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from public.equipos_privado where codigo = v_codigo);
  end loop;
  insert into public.equipos_privado (equipo_id, codigo) values (v_id, v_codigo);
  return v_id;
end $$;

