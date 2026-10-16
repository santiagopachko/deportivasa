-- Migración del panel (16/10/2026)
alter table public.jugadores_privado alter column dni drop not null;
