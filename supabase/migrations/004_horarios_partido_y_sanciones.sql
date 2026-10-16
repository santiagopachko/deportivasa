-- Hora de inicio y fin del partido se completan solas
create or replace function public.tg_partido_horarios()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.estado = 'en_vivo' and new.inicio is null then new.inicio := now(); end if;
  if new.estado = 'finalizado' then
    if new.inicio is null then new.inicio := now(); end if;
    if new.fin is null then new.fin := now(); end if;
  end if;
  if new.estado in ('programado','en_vivo') then new.fin := null; end if;
  return new;
end $$;
create trigger partidos_horarios before insert or update of estado on public.partidos
for each row execute function public.tg_partido_horarios();

-- Cumplimiento de sanciones: cuenta todo partido del equipo que empezó después de la sanción
create or replace function public.tg_cumplir_sanciones()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.estado = 'finalizado' and old.estado is distinct from 'finalizado' then
    update public.sanciones s set fechas_cumplidas = s.fechas_cumplidas + 1
    where s.equipo_id in (new.local_id, new.visitante_id)
      and s.fechas_cumplidas < s.fechas
      and s.partido_id is distinct from new.id
      and s.creado <= new.inicio;
  elsif old.estado = 'finalizado' and new.estado <> 'finalizado' then
    update public.sanciones s set fechas_cumplidas = greatest(s.fechas_cumplidas - 1, 0)
    where s.equipo_id in (new.local_id, new.visitante_id)
      and s.partido_id is distinct from new.id
      and s.creado <= coalesce(old.inicio, now())
      and s.fechas_cumplidas > 0;
  end if;
  return new;
end $$;
