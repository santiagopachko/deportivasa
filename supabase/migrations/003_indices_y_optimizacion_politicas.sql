do $$
declare t text;
begin
  foreach t in array array['sedes','torneos','equipos','jugadores','fases','fechas','partidos','eventos','sanciones'] loop
    execute format('alter policy %1$s_escribir on public.%1$s using ((select privado.es_staff())) with check ((select privado.es_staff()))', t);
  end loop;
end $$;
alter policy equipos_privado_org on public.equipos_privado using ((select privado.es_organizador())) with check ((select privado.es_organizador()));
alter policy jugadores_privado_org on public.jugadores_privado using ((select privado.es_organizador())) with check ((select privado.es_organizador()));
alter policy solicitudes_org on public.solicitudes using ((select privado.es_organizador())) with check ((select privado.es_organizador()));
alter policy org_ver on public.organizadores using (email = lower(coalesce((select auth.jwt() ->> 'email'),'')) or (select privado.es_organizador()));
alter policy org_admin on public.organizadores using ((select privado.es_organizador())) with check ((select privado.es_organizador()));
create index if not exists eventos_equipo_idx on public.eventos (equipo_id);
create index if not exists fechas_fase_idx on public.fechas (fase_id);
create index if not exists jugadores_torneo_idx on public.jugadores (torneo_id);
create index if not exists partidos_ganador_idx on public.partidos (ganador_pasa_a);
create index if not exists partidos_perdedor_idx on public.partidos (perdedor_pasa_a);
create index if not exists partidos_local_idx on public.partidos (local_id);
create index if not exists partidos_visitante_idx on public.partidos (visitante_id);
create index if not exists sanciones_equipo_idx on public.sanciones (equipo_id);
create index if not exists sanciones_partido_idx on public.sanciones (partido_id);
create index if not exists sanciones_torneo_idx on public.sanciones (torneo_id);
create index if not exists solicitudes_equipo_idx on public.solicitudes (equipo_id);
create index if not exists solicitudes_jugador_idx on public.solicitudes (jugador_id);
create index if not exists solicitudes_torneo_idx on public.solicitudes (torneo_id);
create index if not exists torneos_sede_idx on public.torneos (sede_id);
