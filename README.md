# Deportivasa – Web del torneo

Rama `web`: la web unificada de Torneos Deportivasa (sector clientes + sector organizadores).
La rama `main` sigue siendo la página de links a fotos y no se toca desde acá.

- `web/` — el sitio (lo que publica Cloudflare Pages). Sin paso de compilación.
  - `web/index.html` — portada pública (provisoria).
  - `web/org/` — sector organizadores (ingreso con Google o mail y contraseña).
  - `web/inscribir/?c=CODIGO` — formulario de delegados (sin cuenta).
- `supabase/migrations/` — estructura de la base de datos (Supabase, proyecto `nahlizxwlxudfvnsxsrn`).

Nunca se suben datos de jugadores (DNI, nacimientos) a este repositorio: viven solo en la base, protegidos.
