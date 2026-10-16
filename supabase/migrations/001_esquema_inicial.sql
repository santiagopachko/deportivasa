-- =====================================================================
-- Deportivasa – Esquema inicial (16/10/2026)
-- Tablas públicas (lectura libre) y privadas (solo organizadores).
-- Los DNI, nacimientos, códigos de equipo y solicitudes NUNCA son públicos.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ORGANIZADORES (lista de mails con acceso al sector organizadores)
-- ---------------------------------------------------------------------
create table public.organizadores (
  email       text primary key check (email = lower(email)),
  nombre      text not null,
  rol         text not null default 'organizador' check (rol in ('organizador','colaborador')),
  activo      boolean not null default true,
  creado      timestamptz not null default now()
);

create or replace function public.es_organizador()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizadores o
    where o.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and o.activo
      and o.rol = 'organizador'
  );
$$;

create or replace function public.es_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizadores o
    where o.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and o.activo
  );
$$;

-- ---------------------------------------------------------------------
-- CONFIGURACIÓN DEL TORNEO (público)
-- ---------------------------------------------------------------------
create table public.sedes (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nombre      text not null,
  direccion   text,
  localidad   text,
  lat         double precision,
  lng         double precision,
  maps_url    text,
  foto_url    text,
  creado      timestamptz not null default now()
);

create table public.torneos (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  nombre              text not null,                 -- ej. "SÁBADOS F8"
  modalidad           text not null default 'F8',    -- F7, F8, ...
  dia                 text,                          -- ej. "Sábados", "Semanal"
  horario             text,                          -- ej. "19:00 a 22:00" o "A confirmar"
  sede_id             uuid references public.sedes(id) on delete set null,
  carteles            text[] not null default '{}',  -- ej. {en_proceso} {por_finalizar,inscripciones_abiertas}
  premios             jsonb not null default '[]',   -- [{puesto, premio}]
  descripcion         text,
  foto_url            text,
  inscripcion_abierta boolean not null default false,
  cupo_por_equipo     int not null default 24 check (cupo_por_equipo > 0),
  visible             boolean not null default true,
  orden               int not null default 0,
  creado              timestamptz not null default now()
);

create table public.equipos (
  id                uuid primary key default gen_random_uuid(),
  torneo_id         uuid not null references public.torneos(id) on delete restrict,
  slug              text not null,
  nombre            text not null,
  escudo_url        text,
  color_primario    text,
  color_secundario  text,
  orden             int not null default 0,
  activo            boolean not null default true,
  creado            timestamptz not null default now(),
  unique (torneo_id, slug)
);

-- 🔒 Código del equipo para el link del delegado
create table public.equipos_privado (
  equipo_id   uuid primary key references public.equipos(id) on delete cascade,
  codigo      text not null unique check (codigo = upper(codigo))
);

-- ---------------------------------------------------------------------
-- JUGADORES
-- jugadores = datos públicos (nombre y apellido)
-- jugadores_privado = 🔒 DNI y nacimiento
-- ---------------------------------------------------------------------
create table public.jugadores (
  id          uuid primary key default gen_random_uuid(),
  equipo_id   uuid not null references public.equipos(id) on delete restrict,
  torneo_id   uuid not null references public.torneos(id) on delete restrict,
  nombre      text not null,
  apellido    text not null,
  activo      boolean not null default true,
  alta        timestamptz not null default now(),
  baja        timestamptz,
  creado      timestamptz not null default now()
);
create index on public.jugadores (equipo_id) where activo;

create table public.jugadores_privado (
  jugador_id  uuid primary key references public.jugadores(id) on delete cascade,
  torneo_id   uuid not null references public.torneos(id) on delete restrict,
  dni         text not null check (dni ~ '^[0-9]{7,8}$'),
  nacimiento  date,
  origen      text not null default 'organización'
              check (origen in ('carga inicial','delegado','organización')),
  cambios     jsonb not null default '[]',
  legacy      jsonb,                                   -- datos originales del panel viejo
  unique (torneo_id, dni)                              -- DNI único en todo el torneo
);

-- El torneo del jugador siempre es el de su equipo
create or replace function public.tg_jugador_torneo()
returns trigger language plpgsql set search_path = '' as $$
begin
  select e.torneo_id into new.torneo_id from public.equipos e where e.id = new.equipo_id;
  return new;
end $$;
create trigger jugador_torneo before insert or update of equipo_id on public.jugadores
for each row execute function public.tg_jugador_torneo();

-- 🔒 Solicitudes de los delegados
create table public.solicitudes (
  id          uuid primary key default gen_random_uuid(),
  torneo_id   uuid not null references public.torneos(id) on delete cascade,
  equipo_id   uuid not null references public.equipos(id) on delete cascade,
  nombre      text not null,
  apellido    text not null,
  dni         text not null check (dni ~ '^[0-9]{7,8}$'),
  nacimiento  date,
  estado      text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  motivo      text,
  origen      text not null default 'formulario web',
  creada      timestamptz not null default now(),
  resuelta    timestamptz,
  resuelta_por text,
  jugador_id  uuid references public.jugadores(id) on delete set null,
  legacy_id   text unique
);
create index on public.solicitudes (estado, torneo_id);

-- ---------------------------------------------------------------------
-- COMPETENCIA (público)
-- ---------------------------------------------------------------------
create table public.fases (
  id          uuid primary key default gen_random_uuid(),
  torneo_id   uuid not null references public.torneos(id) on delete cascade,
  tipo        text not null check (tipo in ('liguilla','copa_oro','copa_plata')),
  nombre      text not null,
  orden       int not null default 0,
  unique (torneo_id, tipo)
);

create table public.fechas (
  id          uuid primary key default gen_random_uuid(),
  torneo_id   uuid not null references public.torneos(id) on delete cascade,
  fase_id     uuid not null references public.fases(id) on delete cascade,
  numero      int not null,
  nombre      text not null,          -- "Fecha 5", "Cuartos de final", "Semifinal", "Final"
  dia         date,
  orden       int not null default 0
);
create index on public.fechas (torneo_id, orden);

create table public.partidos (
  id                  uuid primary key default gen_random_uuid(),
  torneo_id           uuid not null references public.torneos(id) on delete cascade,
  fecha_id            uuid not null references public.fechas(id) on delete cascade,
  local_id            uuid references public.equipos(id) on delete restrict,
  visitante_id        uuid references public.equipos(id) on delete restrict,
  hora                time,
  cancha              text,
  estado              text not null default 'programado'
                      check (estado in ('programado','en_vivo','finalizado','suspendido')),
  goles_local         int not null default 0,
  goles_visitante     int not null default 0,
  penales_local       int,
  penales_visitante   int,
  inicio              timestamptz,
  fin                 timestamptz,
  ganador_pasa_a      uuid references public.partidos(id) on delete set null,
  ganador_pasa_como   text check (ganador_pasa_como in ('local','visitante')),
  perdedor_pasa_a     uuid references public.partidos(id) on delete set null,
  perdedor_pasa_como  text check (perdedor_pasa_como in ('local','visitante')),
  veo_url             text,
  youtube_url         text,
  creado              timestamptz not null default now(),
  check (local_id is null or visitante_id is null or local_id <> visitante_id)
);
create index on public.partidos (torneo_id, estado);
create index on public.partidos (fecha_id);

create table public.eventos (
  id          uuid primary key default gen_random_uuid(),
  partido_id  uuid not null references public.partidos(id) on delete cascade,
  equipo_id   uuid not null references public.equipos(id) on delete restrict,  -- equipo al que le cuenta (gol) o del jugador (tarjeta)
  jugador_id  uuid references public.jugadores(id) on delete set null,
  tipo        text not null check (tipo in ('gol','gol_en_contra','amarilla','doble_amarilla','roja')),
  minuto      int check (minuto is null or minuto between 0 and 200),
  clip_url    text,
  creado      timestamptz not null default now(),
  creado_por  text
);
create index on public.eventos (partido_id);
create index on public.eventos (jugador_id);

create table public.sanciones (
  id                uuid primary key default gen_random_uuid(),
  torneo_id         uuid not null references public.torneos(id) on delete cascade,
  jugador_id        uuid not null references public.jugadores(id) on delete cascade,
  equipo_id         uuid not null references public.equipos(id) on delete cascade,
  partido_id        uuid references public.partidos(id) on delete cascade,
  evento_id         uuid unique references public.eventos(id) on delete cascade,
  motivo            text not null check (motivo in ('roja_directa','doble_amarilla','otra')),
  fechas            int not null check (fechas >= 0),          -- editable por los organizadores
  fechas_cumplidas  int not null default 0 check (fechas_cumplidas >= 0),
  observaciones     text,
  creado            timestamptz not null default now()
);
create index on public.sanciones (jugador_id);

-- ---------------------------------------------------------------------
-- AUTOMATISMOS
-- ---------------------------------------------------------------------

-- 1) El marcador del partido se recalcula con cada gol cargado o borrado
create or replace function public.tg_recalcular_marcador()
returns trigger language plpgsql set search_path = '' as $$
declare pid uuid := coalesce(new.partido_id, old.partido_id);
begin
  update public.partidos p set
    goles_local = (select count(*) from public.eventos e
                   where e.partido_id = pid and e.tipo in ('gol','gol_en_contra') and e.equipo_id = p.local_id),
    goles_visitante = (select count(*) from public.eventos e
                   where e.partido_id = pid and e.tipo in ('gol','gol_en_contra') and e.equipo_id = p.visitante_id)
  where p.id = pid;
  return null;
end $$;
create trigger eventos_marcador after insert or update or delete on public.eventos
for each row execute function public.tg_recalcular_marcador();

-- 2) Roja directa (2 fechas) y doble amarilla (1 fecha) crean la sanción sola
create or replace function public.tg_sancion_automatica()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.jugador_id is not null and new.tipo in ('roja','doble_amarilla') then
    insert into public.sanciones (torneo_id, jugador_id, equipo_id, partido_id, evento_id, motivo, fechas)
    select p.torneo_id, new.jugador_id, new.equipo_id, new.partido_id, new.id,
           case when new.tipo = 'roja' then 'roja_directa' else 'doble_amarilla' end,
           case when new.tipo = 'roja' then 2 else 1 end
    from public.partidos p where p.id = new.partido_id
    on conflict (evento_id) do nothing;
  end if;
  return null;
end $$;
create trigger eventos_sancion after insert on public.eventos
for each row execute function public.tg_sancion_automatica();

-- 3) Al finalizar un partido: se descuenta una fecha a los suspendidos de ambos equipos
--    (sanciones de partidos anteriores). Si se reabre el partido, se devuelve.
create or replace function public.tg_cumplir_sanciones()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.estado = 'finalizado' and old.estado is distinct from 'finalizado' then
    update public.sanciones s set fechas_cumplidas = s.fechas_cumplidas + 1
    where s.equipo_id in (new.local_id, new.visitante_id)
      and s.fechas_cumplidas < s.fechas
      and s.partido_id is distinct from new.id
      and s.creado < coalesce(new.inicio, now());
  elsif old.estado = 'finalizado' and new.estado <> 'finalizado' then
    update public.sanciones s set fechas_cumplidas = greatest(s.fechas_cumplidas - 1, 0)
    where s.equipo_id in (new.local_id, new.visitante_id)
      and s.partido_id is distinct from new.id
      and s.creado < coalesce(new.inicio, now())
      and s.fechas_cumplidas > 0;
  end if;
  return new;
end $$;
create trigger partidos_sanciones after update of estado on public.partidos
for each row execute function public.tg_cumplir_sanciones();

-- 4) Copas: al finalizar, el ganador (y opcionalmente el perdedor) pasa al siguiente partido
create or replace function public.tg_avanzar_cuadro()
returns trigger language plpgsql set search_path = '' as $$
declare ganador uuid; perdedor uuid;
begin
  if new.estado = 'finalizado' and old.estado is distinct from 'finalizado'
     and (new.ganador_pasa_a is not null or new.perdedor_pasa_a is not null) then
    if new.goles_local > new.goles_visitante
       or (new.goles_local = new.goles_visitante and coalesce(new.penales_local,0) > coalesce(new.penales_visitante,0)) then
      ganador := new.local_id; perdedor := new.visitante_id;
    elsif new.goles_visitante > new.goles_local
       or (new.goles_local = new.goles_visitante and coalesce(new.penales_visitante,0) > coalesce(new.penales_local,0)) then
      ganador := new.visitante_id; perdedor := new.local_id;
    end if;
    if ganador is not null and new.ganador_pasa_a is not null then
      if new.ganador_pasa_como = 'local' then
        update public.partidos set local_id = ganador where id = new.ganador_pasa_a;
      else
        update public.partidos set visitante_id = ganador where id = new.ganador_pasa_a;
      end if;
    end if;
    if perdedor is not null and new.perdedor_pasa_a is not null then
      if new.perdedor_pasa_como = 'local' then
        update public.partidos set local_id = perdedor where id = new.perdedor_pasa_a;
      else
        update public.partidos set visitante_id = perdedor where id = new.perdedor_pasa_a;
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger partidos_cuadro after update of estado on public.partidos
for each row execute function public.tg_avanzar_cuadro();

-- ---------------------------------------------------------------------
-- LO QUE SE CALCULA SOLO (vistas públicas, sin datos sensibles)
-- ---------------------------------------------------------------------

-- Tabla de posiciones de la liguilla: 3/1/0; desempate DG, GF, GC (menos es mejor)
create or replace view public.v_tabla with (security_invoker = true) as
with res as (
  select p.torneo_id, p.local_id as equipo_id, p.goles_local as gf, p.goles_visitante as gc
  from public.partidos p join public.fechas f on f.id = p.fecha_id join public.fases fa on fa.id = f.fase_id
  where p.estado = 'finalizado' and fa.tipo = 'liguilla'
  union all
  select p.torneo_id, p.visitante_id, p.goles_visitante, p.goles_local
  from public.partidos p join public.fechas f on f.id = p.fecha_id join public.fases fa on fa.id = f.fase_id
  where p.estado = 'finalizado' and fa.tipo = 'liguilla'
),
agg as (
  select e.torneo_id, e.id as equipo_id, e.nombre, e.slug, e.escudo_url, e.color_primario,
         count(r.equipo_id)                                  as pj,
         count(r.equipo_id) filter (where r.gf > r.gc)       as pg,
         count(r.equipo_id) filter (where r.gf = r.gc)       as pe,
         count(r.equipo_id) filter (where r.gf < r.gc)       as pp,
         coalesce(sum(r.gf),0)                               as gf,
         coalesce(sum(r.gc),0)                               as gc
  from public.equipos e left join res r on r.equipo_id = e.id
  where e.activo
  group by e.id
)
select *, gf - gc as dg, pg*3 + pe as pts,
       rank() over (partition by torneo_id order by pg*3+pe desc, gf-gc desc, gf desc, gc asc) as posicion
from agg;

-- Goleadores (todas las fases)
create or replace view public.v_goleadores with (security_invoker = true) as
select p.torneo_id, j.id as jugador_id, j.nombre, j.apellido, eq.id as equipo_id, eq.nombre as equipo,
       eq.escudo_url, count(*) as goles
from public.eventos ev
join public.partidos p on p.id = ev.partido_id
join public.jugadores j on j.id = ev.jugador_id
join public.equipos eq on eq.id = j.equipo_id
where ev.tipo = 'gol' and p.estado in ('en_vivo','finalizado')
group by p.torneo_id, j.id, eq.id;

-- Tarjetas por jugador
create or replace view public.v_tarjetas with (security_invoker = true) as
select p.torneo_id, j.id as jugador_id, j.nombre, j.apellido, eq.id as equipo_id, eq.nombre as equipo,
       count(*) filter (where ev.tipo = 'amarilla')       as amarillas,
       count(*) filter (where ev.tipo = 'doble_amarilla') as dobles_amarillas,
       count(*) filter (where ev.tipo = 'roja')           as rojas
from public.eventos ev
join public.partidos p on p.id = ev.partido_id
join public.jugadores j on j.id = ev.jugador_id
join public.equipos eq on eq.id = j.equipo_id
where ev.tipo in ('amarilla','doble_amarilla','roja') and p.estado in ('en_vivo','finalizado')
group by p.torneo_id, j.id, eq.id;

-- Suspendidos (les quedan fechas por cumplir)
create or replace view public.v_suspendidos with (security_invoker = true) as
select s.torneo_id, s.id as sancion_id, j.id as jugador_id, j.nombre, j.apellido,
       eq.id as equipo_id, eq.nombre as equipo, s.motivo, s.fechas, s.fechas_cumplidas,
       s.fechas - s.fechas_cumplidas as fechas_restantes
from public.sanciones s
join public.jugadores j on j.id = s.jugador_id
join public.equipos eq on eq.id = s.equipo_id
where s.fechas_cumplidas < s.fechas;

-- Planteles públicos: SOLO nombre y apellido
create or replace view public.v_planteles with (security_invoker = true) as
select j.torneo_id, eq.id as equipo_id, eq.nombre as equipo, j.id as jugador_id, j.nombre, j.apellido
from public.jugadores j join public.equipos eq on eq.id = j.equipo_id
where j.activo and eq.activo;

-- ---------------------------------------------------------------------
-- FORMULARIO DE DELEGADOS (sin cuenta, a través de funciones controladas)
-- ---------------------------------------------------------------------

-- Datos del equipo a partir del código del link (nada sensible)
create or replace function public.equipo_por_codigo(p_codigo text)
returns table (equipo text, torneo text, inscripcion_abierta boolean, cupo int, inscriptos int, pendientes int)
language sql stable security definer
set search_path = ''
as $$
  select e.nombre, t.nombre, t.inscripcion_abierta, t.cupo_por_equipo,
         (select count(*)::int from public.jugadores j where j.equipo_id = e.id and j.activo),
         (select count(*)::int from public.solicitudes s where s.equipo_id = e.id and s.estado = 'pendiente')
  from public.equipos_privado ep
  join public.equipos e on e.id = ep.equipo_id
  join public.torneos t on t.id = e.torneo_id
  where ep.codigo = upper(trim(p_codigo)) and e.activo;
$$;

-- Enviar un jugador: valida todo y deja la solicitud pendiente
create or replace function public.enviar_solicitud(
  p_codigo text, p_nombre text, p_apellido text, p_dni text, p_nacimiento date default null)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_equipo uuid; v_torneo uuid; v_abierta boolean; v_cupo int; v_ocupados int;
  v_dni text := regexp_replace(coalesce(p_dni,''), '[^0-9]', '', 'g');
  v_nombre text := initcap(trim(coalesce(p_nombre,'')));
  v_apellido text := initcap(trim(coalesce(p_apellido,'')));
begin
  select e.id, e.torneo_id, t.inscripcion_abierta, t.cupo_por_equipo
    into v_equipo, v_torneo, v_abierta, v_cupo
  from public.equipos_privado ep
  join public.equipos e on e.id = ep.equipo_id
  join public.torneos t on t.id = e.torneo_id
  where ep.codigo = upper(trim(p_codigo)) and e.activo;

  if v_equipo is null then return 'codigo_invalido'; end if;
  if not v_abierta then return 'inscripcion_cerrada'; end if;
  if length(v_nombre) < 2 or length(v_apellido) < 2 then return 'datos_incompletos'; end if;
  if v_dni !~ '^[0-9]{7,8}$' then return 'dni_invalido'; end if;
  if p_nacimiento is not null and (p_nacimiento > current_date or p_nacimiento < date '1930-01-01') then
    return 'nacimiento_invalido';
  end if;

  if exists (select 1 from public.jugadores_privado jp join public.jugadores j on j.id = jp.jugador_id
             where jp.torneo_id = v_torneo and jp.dni = v_dni and j.activo) then
    return 'dni_ya_inscripto';
  end if;
  if exists (select 1 from public.solicitudes s
             where s.torneo_id = v_torneo and s.dni = v_dni and s.estado = 'pendiente') then
    return 'dni_ya_pendiente';
  end if;

  select (select count(*) from public.jugadores j where j.equipo_id = v_equipo and j.activo)
       + (select count(*) from public.solicitudes s where s.equipo_id = v_equipo and s.estado = 'pendiente')
    into v_ocupados;
  if v_ocupados >= v_cupo then return 'cupo_completo'; end if;

  insert into public.solicitudes (torneo_id, equipo_id, nombre, apellido, dni, nacimiento)
  values (v_torneo, v_equipo, v_nombre, v_apellido, v_dni, p_nacimiento);
  return 'ok';
end $$;

revoke all on function public.enviar_solicitud(text,text,text,text,date) from public;
revoke all on function public.equipo_por_codigo(text) from public;
grant execute on function public.enviar_solicitud(text,text,text,text,date) to anon, authenticated;
grant execute on function public.equipo_por_codigo(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- SEGURIDAD POR FILA
-- ---------------------------------------------------------------------
alter table public.organizadores     enable row level security;
alter table public.sedes             enable row level security;
alter table public.torneos           enable row level security;
alter table public.equipos           enable row level security;
alter table public.equipos_privado   enable row level security;
alter table public.jugadores         enable row level security;
alter table public.jugadores_privado enable row level security;
alter table public.solicitudes       enable row level security;
alter table public.fases             enable row level security;
alter table public.fechas            enable row level security;
alter table public.partidos          enable row level security;
alter table public.eventos           enable row level security;
alter table public.sanciones         enable row level security;

-- Organizadores: cada uno ve su propia fila; solo organizadores administran la lista
create policy org_ver on public.organizadores for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email','')) or public.es_organizador());
create policy org_admin on public.organizadores for all to authenticated
  using (public.es_organizador()) with check (public.es_organizador());

-- Tablas públicas: cualquiera lee; solo staff escribe
do $$
declare t text;
begin
  foreach t in array array['sedes','torneos','equipos','jugadores','fases','fechas','partidos','eventos','sanciones'] loop
    execute format('create policy %1$s_leer on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('create policy %1$s_escribir on public.%1$s for all to authenticated using (public.es_staff()) with check (public.es_staff())', t);
  end loop;
end $$;

-- 🔒 Tablas privadas: solo organizadores
create policy equipos_privado_org on public.equipos_privado for all to authenticated
  using (public.es_organizador()) with check (public.es_organizador());
create policy jugadores_privado_org on public.jugadores_privado for all to authenticated
  using (public.es_organizador()) with check (public.es_organizador());
create policy solicitudes_org on public.solicitudes for all to authenticated
  using (public.es_organizador()) with check (public.es_organizador());

-- Nadie anónimo puede tocar las privadas
revoke all on public.equipos_privado, public.jugadores_privado, public.solicitudes, public.organizadores from anon;

-- ---------------------------------------------------------------------
-- TIEMPO REAL (marcador en vivo)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.partidos, public.eventos;
