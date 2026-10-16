-- Borra el torneo de prueba "PRUEBA" (datos inventados). No toca nada real.
do $$
declare t uuid;
begin
  select id into t from public.torneos where slug = 'prueba-test';
  if t is null then raise notice 'No hay torneo de prueba'; return; end if;
  delete from public.partidos    where torneo_id = t;
  delete from public.sanciones   where torneo_id = t;
  delete from public.solicitudes where torneo_id = t;
  delete from public.jugadores   where torneo_id = t;
  delete from public.equipos     where torneo_id = t;
  delete from public.torneos     where id = t;
end $$;
select count(*) as torneos_que_quedan from public.torneos;
