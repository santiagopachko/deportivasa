/* Deportivasa – Sector organizadores
   Pantallas: ingreso · inicio · solicitudes · equipos (y plantel) · torneo */
(() => {
  'use strict';
  const CFG = window.DEPORTIVASA;
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.__sb = sb; // útil para soporte

  const $app = document.getElementById('app');
  const $hoja = document.getElementById('hoja');
  const $aviso = document.getElementById('aviso');

  const estado = {
    sesion: null, organizador: null,
    torneos: [], torneoId: null,
    equipos: [], codigos: {}, jugadores: [], privados: {}, solicitudes: [],
    filtroSolicitudes: 'pendiente', busqueda: '', recuperando: false
  };

  /* ---------- utilidades ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (i < vals.length ? vals[i] : ''), '');
  const fechaCorta = (iso) => iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' +
    new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
  const dniLindo = (d) => d ? String(d).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  const torneo = () => estado.torneos.find((t) => t.id === estado.torneoId);
  const equipo = (id) => estado.equipos.find((e) => e.id === id);
  const activos = (equipoId) => estado.jugadores.filter((j) => j.equipo_id === equipoId && j.activo)
    .sort((a, b) => (a.apellido + a.nombre).localeCompare(b.apellido + b.nombre, 'es'));
  const pendientes = () => estado.solicitudes.filter((s) => s.estado === 'pendiente');
  const linkDelegado = (codigo) => `${location.origin}/inscribir/?c=${encodeURIComponent(codigo)}`;

  const ERRORES = {
    sin_permiso: 'Tu usuario no tiene permiso para hacer esto.',
    datos_incompletos: 'Completá nombre y apellido.',
    dni_invalido: 'El DNI tiene que tener 7 u 8 números.',
    dni_ya_inscripto: 'Ese DNI ya está inscripto en este torneo.',
    cupo_completo: 'El equipo ya llegó al cupo de jugadores.',
    solicitud_ya_resuelta: 'Esa solicitud ya fue resuelta por otro organizador.',
    equipo_inexistente: 'No se encontró el equipo.',
    jugador_inexistente: 'No se encontró el jugador.'
  };
  const textoError = (e) => {
    const m = (e && (e.message || e.error_description || e.msg)) || String(e);
    const clave = Object.keys(ERRORES).find((k) => m.includes(k));
    if (clave) return ERRORES[clave];
    if (/Invalid login credentials/i.test(m)) return 'Mail o contraseña incorrectos.';
    if (/Email not confirmed/i.test(m)) return 'Todavía no confirmaste tu mail. Revisá tu casilla (y el spam).';
    if (/User already registered/i.test(m)) return 'Ese mail ya tiene contraseña. Usá "Olvidé mi contraseña" si no la recordás.';
    if (/Password should be/i.test(m)) return 'La contraseña tiene que tener al menos 6 caracteres.';
    if (/rate limit/i.test(m)) return 'Se pidieron demasiados mails seguidos. Esperá unos minutos y probá de nuevo.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión. Revisá internet y probá de nuevo.';
    return m;
  };

  let avisoTimer;
  function aviso(texto, tipo) {
    $aviso.textContent = texto;
    $aviso.className = 'aviso' + (tipo === 'error' ? ' error' : '');
    $aviso.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { $aviso.hidden = true; }, tipo === 'error' ? 5000 : 2600);
  }

  function abrirHoja(html, alMontar) {
    $hoja.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`;
    $hoja.hidden = false;
    const primero = $hoja.querySelector('input, select, textarea, button');
    if (primero) setTimeout(() => primero.focus(), 50);
    if (alMontar) alMontar($hoja.querySelector('.panel'));
  }
  function cerrarHoja() { $hoja.hidden = true; $hoja.innerHTML = ''; }
  $hoja.addEventListener('click', (e) => { if (e.target === $hoja || e.target.closest('[data-cerrar]')) cerrarHoja(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$hoja.hidden) cerrarHoja(); });

  async function accion(boton, fn) {
    if (boton) boton.disabled = true;
    try { return await fn(); }
    catch (e) { aviso(textoError(e), 'error'); throw e; }
    finally { if (boton) boton.disabled = false; }
  }

  const ICONOS = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    solicitudes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
    equipos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/></svg>',
    torneo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
    google: '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>'
  };

  /* ---------- ingreso ---------- */
  function pantallaIngreso(modo = 'entrar', mensaje = '', tipoMensaje = '') {
    const titulos = { entrar: 'Ingreso organizadores', crear: 'Crear mi contraseña', olvide: 'Recuperar contraseña', nueva: 'Elegí tu contraseña nueva' };
    let form = '';
    if (modo === 'entrar') {
      form = h`
        <button class="btn btn-google btn-bloque" id="google" type="button">${ICONOS.google} Entrar con Google</button>
        <div class="separador">o con tu mail</div>
        <form id="f-ingreso" novalidate>
          <label class="campo"><span>Mail</span><input class="input" name="email" type="email" autocomplete="email" required></label>
          <label class="campo"><span>Contraseña</span><input class="input" name="clave" type="password" autocomplete="current-password" required></label>
          <button class="btn btn-bloque" type="submit">Entrar</button>
        </form>
        <div class="enlaces"><button type="button" data-modo="crear">Es mi primera vez</button><button type="button" data-modo="olvide">Olvidé mi contraseña</button></div>`;
    } else if (modo === 'crear') {
      form = h`
        <p class="muted chico">Usá el mail con el que figurás como organizador. Te va a llegar un mail para confirmarlo.</p>
        <form id="f-crear" novalidate>
          <label class="campo"><span>Mail</span><input class="input" name="email" type="email" autocomplete="email" required></label>
          <label class="campo"><span>Contraseña nueva (mínimo 6 caracteres)</span><input class="input" name="clave" type="password" autocomplete="new-password" minlength="6" required></label>
          <button class="btn btn-bloque" type="submit">Crear contraseña</button>
        </form>
        <div class="enlaces"><button type="button" data-modo="entrar">Volver al ingreso</button></div>`;
    } else if (modo === 'olvide') {
      form = h`
        <p class="muted chico">Te mandamos un mail con un enlace para elegir una contraseña nueva.</p>
        <form id="f-olvide" novalidate>
          <label class="campo"><span>Mail</span><input class="input" name="email" type="email" autocomplete="email" required></label>
          <button class="btn btn-bloque" type="submit">Enviar enlace</button>
        </form>
        <div class="enlaces"><button type="button" data-modo="entrar">Volver al ingreso</button></div>`;
    } else if (modo === 'nueva') {
      form = h`
        <form id="f-nueva" novalidate>
          <label class="campo"><span>Contraseña nueva (mínimo 6 caracteres)</span><input class="input" name="clave" type="password" autocomplete="new-password" minlength="6" required></label>
          <button class="btn btn-bloque" type="submit">Guardar contraseña</button>
        </form>`;
    }
    $app.innerHTML = h`
      <main class="ingreso"><div class="tarjeta">
        <img src="/assets/escudo-480.png" alt="Escudo de Deportivasa">
        <h1>${titulos[modo]}</h1>
        <p class="lema">Donde el deporte se vive</p>
        ${form}
        ${mensaje ? `<div class="mensaje ${tipoMensaje}">${esc(mensaje)}</div>` : ''}
      </div></main>`;

    $app.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => pantallaIngreso(b.dataset.modo)));
    const g = $app.querySelector('#google');
    if (g) g.addEventListener('click', async () => {
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/org/' } });
      if (error) pantallaIngreso('entrar', textoError(error), 'error');
    });
    const bind = (id, fn) => { const f = $app.querySelector(id); if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault(); const b = f.querySelector('button[type=submit]'); b.disabled = true;
      try { await fn(new FormData(f)); } catch (err) { pantallaIngreso(modo, textoError(err), 'error'); } finally { b.disabled = false; }
    }); };
    bind('#f-ingreso', async (d) => {
      const { error } = await sb.auth.signInWithPassword({ email: String(d.get('email')).trim(), password: String(d.get('clave')) });
      if (error) throw error;
    });
    bind('#f-crear', async (d) => {
      const email = String(d.get('email')).trim().toLowerCase();
      const { error } = await sb.auth.signUp({ email, password: String(d.get('clave')), options: { emailRedirectTo: location.origin + '/org/' } });
      if (error) throw error;
      pantallaIngreso('entrar', `Listo. Te mandamos un mail a ${email} para confirmarlo. Después entrás con tu mail y contraseña.`);
    });
    bind('#f-olvide', async (d) => {
      const email = String(d.get('email')).trim().toLowerCase();
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/org/' });
      if (error) throw error;
      pantallaIngreso('entrar', `Si ${email} tiene cuenta, te llega un mail con el enlace para cambiar la contraseña.`);
    });
    bind('#f-nueva', async (d) => {
      const { error } = await sb.auth.updateUser({ password: String(d.get('clave')) });
      if (error) throw error;
      estado.recuperando = false;
      aviso('Contraseña guardada');
      arrancar();
    });
  }

  function pantallaSinAcceso(email) {
    $app.innerHTML = h`
      <main class="ingreso"><div class="tarjeta">
        <img src="/assets/escudo-480.png" alt="Escudo de Deportivasa">
        <h1>Sin acceso</h1>
        <p class="lema">${esc(email)} no figura como organizador de Deportivasa.</p>
        <button class="btn btn-fantasma btn-bloque" id="salir">Entrar con otra cuenta</button>
        <p class="muted chico" style="text-align:center;margin-top:16px">Si sos organizador, pedí que agreguen tu mail a la lista.</p>
      </div></main>`;
    $app.querySelector('#salir').addEventListener('click', () => sb.auth.signOut());
  }

  /* ---------- datos ---------- */
  async function cargarTorneos() {
    const { data, error } = await sb.from('torneos').select('*, sede:sedes(nombre, direccion, localidad)').order('orden');
    if (error) throw error;
    estado.torneos = data;
    const guardado = (() => { try { return localStorage.getItem('da_torneo'); } catch { return null; } })();
    const porDefecto = data.find((t) => t.slug === CFG.torneoPorDefecto);
    estado.torneoId = (data.find((t) => t.id === guardado) || porDefecto || data[0] || {}).id || null;
  }

  async function cargarTorneo() {
    const id = estado.torneoId; if (!id) return;
    const [eq, jug, sol] = await Promise.all([
      sb.from('equipos').select('*, privado:equipos_privado(codigo)').eq('torneo_id', id).order('orden'),
      sb.from('jugadores').select('*, privado:jugadores_privado(dni, nacimiento, origen)').eq('torneo_id', id),
      sb.from('solicitudes').select('*').eq('torneo_id', id).order('creada', { ascending: false })
    ]);
    for (const r of [eq, jug, sol]) if (r.error) throw r.error;
    estado.equipos = eq.data.map((e) => ({ ...e, codigo: (Array.isArray(e.privado) ? e.privado[0] : e.privado)?.codigo || '' }));
    estado.jugadores = jug.data.map((j) => { const p = Array.isArray(j.privado) ? j.privado[0] : j.privado; return { ...j, dni: p?.dni || null, nacimiento: p?.nacimiento || null, origen: p?.origen || '' }; });
    estado.solicitudes = sol.data;
  }

  let canal;
  function escucharSolicitudes() {
    if (canal) sb.removeChannel(canal);
    // Las solicitudes nuevas se recargan solas cada 30 segundos (y al volver a la pestaña)
    clearInterval(escucharSolicitudes.t);
    escucharSolicitudes.t = setInterval(refrescarSilencioso, 30000);
  }
  async function refrescarSilencioso() {
    if (!estado.organizador || document.hidden || !$hoja.hidden) return;
    if (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const antes = pendientes().length;
    try { await cargarTorneo(); } catch { return; }
    if (pendientes().length > antes) aviso(`Llegó una solicitud nueva`);
    render();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescarSilencioso(); });

  /* ---------- armazón ---------- */
  function ruta() { const r = location.hash.replace(/^#\/?/, '').split('/'); return { pag: r[0] || 'inicio', id: r[1] }; }

  function armazon(contenido) {
    const r = ruta();
    const t = torneo();
    const n = pendientes().length;
    const tab = (pag, txt) => `<a href="#/${pag}" ${r.pag === pag || (pag === 'equipos' && r.pag === 'equipo') ? 'aria-current="page"' : ''}>${ICONOS[pag]}<span>${txt}</span>${pag === 'solicitudes' && n ? `<b class="burbuja">${n}</b>` : ''}</a>`;
    const ini = (estado.organizador?.nombre || '?').split(' ').map((p) => p[0]).slice(0, 2).join('');
    return h`
      <header class="barra">
        <img src="/assets/escudo-64.png" alt="">
        <div class="torneo-sel">
          <label class="sr" for="sel-torneo">Torneo</label>
          <select id="sel-torneo">${estado.torneos.map((x) => `<option value="${x.id}" ${x.id === estado.torneoId ? 'selected' : ''}>${esc(x.nombre)} · ${esc(x.sede?.nombre || '')}${x.visible ? '' : ' (oculto)'}</option>`).join('')}</select>
          <small>${t ? esc(`${t.dia || ''} ${t.horario || ''}`) : ''}</small>
        </div>
        <button class="yo" id="yo" aria-label="Mi cuenta">${esc(ini)}</button>
      </header>
      <main class="marco">${contenido}</main>
      <nav class="solapas" aria-label="Secciones">${tab('inicio', 'Inicio')}${tab('solicitudes', 'Solicitudes')}${tab('equipos', 'Equipos')}${tab('torneo', 'Torneo')}</nav>`;
  }

  function render() {
    if (!estado.organizador) return;
    const r = ruta();
    const vistas = { inicio: vistaInicio, solicitudes: vistaSolicitudes, equipos: vistaEquipos, equipo: vistaEquipo, torneo: vistaTorneo };
    const v = (vistas[r.pag] || vistaInicio)(r.id);
    $app.innerHTML = armazon(v.html);
    $app.querySelector('#sel-torneo').addEventListener('change', async (e) => {
      estado.torneoId = e.target.value;
      try { localStorage.setItem('da_torneo', estado.torneoId); } catch {}
      $app.querySelector('.marco').innerHTML = '<div class="cargando">Cargando…</div>';
      try { await cargarTorneo(); } catch (err) { aviso(textoError(err), 'error'); }
      if (ruta().pag === 'equipo') location.hash = '#/equipos'; else render();
    });
    $app.querySelector('#yo').addEventListener('click', hojaCuenta);
    if (v.montar) v.montar($app.querySelector('.marco'));
  }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  function hojaCuenta() {
    abrirHoja(h`
      <h2>${esc(estado.organizador.nombre)}</h2>
      <p class="muted">${esc(estado.organizador.email)}</p>
      <div class="pie">
        <button class="btn btn-fantasma" id="cambiar">Cambiar mi contraseña</button>
        <button class="btn btn-rojo" id="salir">Cerrar sesión</button>
        <button class="btn btn-fantasma" data-cerrar>Volver</button>
      </div>`, (p) => {
      p.querySelector('#salir').addEventListener('click', async () => { cerrarHoja(); await sb.auth.signOut(); });
      p.querySelector('#cambiar').addEventListener('click', () => { cerrarHoja(); estado.recuperando = true; pantallaIngreso('nueva'); });
    });
  }

  /* ---------- inicio ---------- */
  function vistaInicio() {
    const t = torneo();
    if (!t) return { html: '<div class="vacio"><b>No hay torneos cargados</b></div>' };
    const totalJug = estado.jugadores.filter((j) => j.activo).length;
    const sinDni = estado.jugadores.filter((j) => j.activo && !j.dni).length;
    const n = pendientes().length;
    const carteles = (t.carteles || []).map(cartelHtml).join(' ');
    return {
      html: h`
        <div class="cabeza"><div><h1>${esc(t.nombre)}</h1><p>${esc(t.sede?.nombre || '')} · ${esc(t.dia || '')} ${esc(t.horario || '')}</p></div></div>
        <div style="margin:-4px 0 16px;display:flex;flex-wrap:wrap;gap:6px">${carteles}</div>
        <section class="marcador" aria-label="Resumen del torneo">
          <div><b>${estado.equipos.filter((e) => e.activo).length}</b><span>equipos</span></div>
          <div><b>${totalJug}</b><span>jugadores</span></div>
          <div class="${n ? 'alerta' : ''}"><b>${n}</b><span>${n === 1 ? 'solicitud' : 'solicitudes'}</span></div>
        </section>

        <h2 class="sub">Inscripción de jugadores</h2>
        <div class="caja fila">
          <div class="crece"><b>${t.inscripcion_abierta ? 'Abierta' : 'Cerrada'}</b>
            <div class="muted chico">${t.inscripcion_abierta ? 'Los delegados pueden mandar jugadores.' : 'Los delegados no pueden mandar jugadores.'} Cupo: ${t.cupo_por_equipo} por equipo.</div></div>
          <label class="switch"><span class="sr">Inscripción abierta</span><input type="checkbox" id="sw-insc" ${t.inscripcion_abierta ? 'checked' : ''}><span></span></label>
        </div>

        ${n ? h`<h2 class="sub">Para resolver</h2>
          <a class="caja fila" href="#/solicitudes" style="text-decoration:none;color:inherit">
            <div class="crece"><b>${n} ${n === 1 ? 'jugador espera' : 'jugadores esperan'} aprobación</b><div class="muted chico">Tocá para revisarlos.</div></div>
            <span class="cartel rojo">Pendiente</span></a>` : ''}
        ${sinDni ? h`<div class="caja fila" style="margin-top:10px"><div class="crece"><b>${sinDni} ${sinDni === 1 ? 'jugador sin DNI' : 'jugadores sin DNI'}</b><div class="muted chico">Aparecen marcados en rojo en su equipo.</div></div></div>` : ''}

        <h2 class="sub">Accesos rápidos</h2>
        <div class="botonera">
          <a class="btn btn-fantasma" href="#/equipos">Ver equipos</a>
          <a class="btn btn-fantasma" href="#/torneo">Planilla de partido</a>
        </div>`,
      montar(m) {
        m.querySelector('#sw-insc').addEventListener('change', async (e) => {
          const valor = e.target.checked;
          try {
            await accion(null, async () => { const { error } = await sb.from('torneos').update({ inscripcion_abierta: valor }).eq('id', t.id); if (error) throw error; });
            t.inscripcion_abierta = valor; aviso(valor ? 'Inscripción abierta' : 'Inscripción cerrada'); render();
          } catch { e.target.checked = !valor; }
        });
      }
    };
  }

  const NOMBRES_CARTEL = { en_proceso: ['EN PROCESO', 'verde'], por_finalizar: ['POR FINALIZAR', 'rojo'], inscripciones_abiertas: ['INSCRIPCIONES ABIERTAS', 'rojo'], cupos_abiertos: ['CUPOS ABIERTOS', 'rojo'], finalizado: ['FINALIZADO', 'gris'], proximamente: ['PRÓXIMAMENTE', 'gris'] };
  const cartelHtml = (c) => { const [t, k] = NOMBRES_CARTEL[c] || [c, 'gris']; return `<span class="cartel ${k}">${esc(t)}</span>`; };

  /* ---------- solicitudes ---------- */
  function vistaSolicitudes() {
    const f = estado.filtroSolicitudes;
    const lista = estado.solicitudes.filter((s) => f === 'pendiente' ? s.estado === 'pendiente' : s.estado !== 'pendiente');
    const dniActivos = new Set(estado.jugadores.filter((j) => j.activo && j.dni).map((j) => j.dni));
    const tarjetas = lista.map((s) => {
      const eq = equipo(s.equipo_id);
      const lleno = eq && activos(eq.id).length >= (torneo()?.cupo_por_equipo || 24);
      const avisos = [];
      if (s.estado === 'pendiente' && dniActivos.has(s.dni)) avisos.push('Ese DNI ya está inscripto en el torneo.');
      if (s.estado === 'pendiente' && lleno) avisos.push('El equipo ya tiene el cupo completo.');
      return h`
        <article class="caja solicitud">
          <div class="fila"><div class="crece"><h3>${esc(s.apellido)}, ${esc(s.nombre)}</h3><div class="muted chico">${esc(eq?.nombre || 'Equipo')}</div></div>
            ${s.estado === 'aprobada' ? '<span class="cartel verde">Aprobada</span>' : s.estado === 'rechazada' ? '<span class="cartel rojo">Rechazada</span>' : ''}</div>
          <div class="datos"><span>DNI <b>${esc(dniLindo(s.dni))}</b></span>${s.nacimiento ? `<span>Nació <b>${esc(new Date(s.nacimiento + 'T12:00').toLocaleDateString('es-AR'))}</b></span>` : ''}<span>Enviada <b>${esc(fechaCorta(s.creada))}</b></span></div>
          ${s.estado !== 'pendiente' ? `<div class="muted chico">${s.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'} ${esc(fechaCorta(s.resuelta))}${s.resuelta_por ? ' por ' + esc(s.resuelta_por) : ''}${s.motivo ? ' · Motivo: ' + esc(s.motivo) : ''}</div>` : ''}
          ${avisos.map((a) => `<div class="advertencia">${esc(a)}</div>`).join('')}
          ${s.estado === 'pendiente' ? h`<div class="acciones">
            <button class="btn btn-fantasma" data-rechazar="${s.id}">Rechazar</button>
            <button class="btn btn-verde" data-aprobar="${s.id}" ${avisos.length ? 'disabled' : ''}>Aprobar</button></div>` : ''}
        </article>`;
    }).join('');
    return {
      html: h`
        <div class="cabeza"><div><h1>Solicitudes</h1><p>Jugadores que mandaron los delegados.</p></div></div>
        <div class="segmentos" role="group" aria-label="Filtro">
          <button data-f="pendiente" aria-pressed="${f === 'pendiente'}">Pendientes (${pendientes().length})</button>
          <button data-f="resuelta" aria-pressed="${f !== 'pendiente'}">Resueltas</button>
        </div>
        ${tarjetas || (f === 'pendiente'
          ? '<div class="vacio"><b>No hay solicitudes pendientes</b>Cuando un delegado mande un jugador, aparece acá.</div>'
          : '<div class="vacio"><b>Todavía no hay solicitudes resueltas</b></div>')}`,
      montar(m) {
        m.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { estado.filtroSolicitudes = b.dataset.f; render(); }));
        m.querySelectorAll('[data-aprobar]').forEach((b) => b.addEventListener('click', async () => {
          await accion(b, async () => { const { error } = await sb.rpc('org_aprobar_solicitud', { p_solicitud: b.dataset.aprobar }); if (error) throw error; });
          await cargarTorneo(); aviso('Jugador aprobado y sumado al plantel'); render();
        }));
        m.querySelectorAll('[data-rechazar]').forEach((b) => b.addEventListener('click', () => hojaRechazar(b.dataset.rechazar)));
      }
    };
  }

  function hojaRechazar(id) {
    const s = estado.solicitudes.find((x) => x.id === id);
    abrirHoja(h`
      <h2>Rechazar a ${esc(s.nombre)} ${esc(s.apellido)}</h2>
      <form id="f-rech">
        <label class="campo"><span>Motivo (opcional, queda guardado)</span><input class="input" name="motivo" placeholder="Ej.: DNI mal cargado, ya juega en otro equipo"></label>
        <div class="pie"><button class="btn btn-rojo" type="submit">Rechazar solicitud</button><button class="btn btn-fantasma" type="button" data-cerrar>Cancelar</button></div>
      </form>`, (p) => p.querySelector('#f-rech').addEventListener('submit', async (e) => {
        e.preventDefault();
        const b = e.target.querySelector('[type=submit]');
        await accion(b, async () => { const { error } = await sb.rpc('org_rechazar_solicitud', { p_solicitud: id, p_motivo: new FormData(e.target).get('motivo') }); if (error) throw error; });
        cerrarHoja(); await cargarTorneo(); aviso('Solicitud rechazada'); render();
      }));
  }

  /* ---------- equipos ---------- */
  function vistaEquipos() {
    const cupo = torneo()?.cupo_por_equipo || 24;
    const lista = estado.equipos.filter((e) => e.activo);
    const inactivos = estado.equipos.filter((e) => !e.activo);
    return {
      html: h`
        <div class="cabeza"><div><h1>Equipos</h1><p>${lista.length} ${lista.length === 1 ? 'equipo' : 'equipos'} en el torneo.</p></div>
          <button class="btn btn-chico" id="nuevo-eq">Agregar equipo</button></div>
        <div class="equipos">${lista.map((e) => {
          const n = activos(e.id).length; const p = Math.min(100, Math.round(n / cupo * 100));
          return h`<a class="caja equipo-tarjeta" href="#/equipo/${e.id}">
            <span class="inicial" style="${e.color_primario ? `background:${esc(e.color_primario)}` : ''}">${esc(e.nombre.replace(/^(dep\.?|club|cd|ca)\s+/i, '').trim()[0] || '?')}</span>
            <div class="crece"><h3>${esc(e.nombre)}</h3>
              <div class="cupo ${n >= cupo ? 'lleno' : ''}" style="--p:${p}%"><i></i><small>${n} de ${cupo} jugadores</small></div></div></a>`;
        }).join('') || '<div class="vacio"><b>Este torneo todavía no tiene equipos</b>Agregá el primero con el botón de arriba.</div>'}</div>
        ${inactivos.length ? h`<details class="bajas" style="margin-top:16px"><summary>Equipos dados de baja (${inactivos.length})</summary>
          <ul class="lista">${inactivos.map((e) => `<li><span class="nom"><b>${esc(e.nombre)}</b></span><button class="mini" data-reactivar="${e.id}">Volver a sumar</button></li>`).join('')}</ul></details>` : ''}`,
      montar(m) {
        m.querySelector('#nuevo-eq').addEventListener('click', hojaNuevoEquipo);
        m.querySelectorAll('[data-reactivar]').forEach((b) => b.addEventListener('click', async () => {
          await accion(b, async () => { const { error } = await sb.from('equipos').update({ activo: true }).eq('id', b.dataset.reactivar); if (error) throw error; });
          await cargarTorneo(); aviso('Equipo sumado de nuevo'); render();
        }));
      }
    };
  }

  function hojaNuevoEquipo() {
    abrirHoja(h`
      <h2>Agregar equipo</h2>
      <form id="f-eq">
        <label class="campo"><span>Nombre del equipo</span><input class="input" name="nombre" required placeholder="Ej.: Los Pibes FC"></label>
        <p class="muted chico">Se crea con su código para el link del delegado.</p>
        <div class="pie"><button class="btn" type="submit">Agregar equipo</button><button class="btn btn-fantasma" type="button" data-cerrar>Cancelar</button></div>
      </form>`, (p) => p.querySelector('#f-eq').addEventListener('submit', async (e) => {
        e.preventDefault();
        const b = e.target.querySelector('[type=submit]');
        const id = await accion(b, async () => { const { data, error } = await sb.rpc('org_crear_equipo', { p_torneo: estado.torneoId, p_nombre: new FormData(e.target).get('nombre') }); if (error) throw error; return data; });
        cerrarHoja(); await cargarTorneo(); aviso('Equipo agregado'); location.hash = `#/equipo/${id}`;
      }));
  }

  function vistaEquipo(id) {
    const e = equipo(id);
    if (!e) return { html: '<div class="vacio"><b>No se encontró el equipo</b><a href="#/equipos">Volver a equipos</a></div>' };
    const cupo = torneo()?.cupo_por_equipo || 24;
    const q = estado.busqueda.trim().toLowerCase();
    const lista = activos(e.id);
    const filtrada = q ? lista.filter((j) => `${j.nombre} ${j.apellido} ${j.dni || ''}`.toLowerCase().includes(q)) : lista;
    const bajas = estado.jugadores.filter((j) => j.equipo_id === e.id && !j.activo);
    const link = e.codigo ? linkDelegado(e.codigo) : '';
    const msjWa = `Hola! Este es el link para inscribir jugadores de ${e.nombre} en Deportivasa: ${link}`;
    return {
      html: h`
        <div class="cabeza"><div><a href="#/equipos" class="muted chico" style="text-decoration:none">‹ Equipos</a><h1>${esc(e.nombre)}</h1>
          <p>${lista.length} de ${cupo} jugadores</p></div>
          <button class="btn btn-chico btn-fantasma" id="editar-eq">Editar</button></div>

        <div class="caja">
          <div class="muted chico">Código del delegado</div>
          <div class="codigo">${esc(e.codigo || '—')}</div>
          <div class="botonera">
            <button class="btn btn-chico" id="copiar">Copiar link de inscripción</button>
            <a class="btn btn-chico btn-fantasma" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msjWa)}">Mandar por WhatsApp</a>
            <button class="btn btn-chico btn-fantasma" id="pdf-plantel">Plantel en PDF</button>
          </div>
        </div>

        <div class="fila" style="margin-top:18px">
          <input class="input crece" id="buscar" type="search" placeholder="Buscar por nombre o DNI" value="${esc(estado.busqueda)}" aria-label="Buscar jugador">
          <button class="btn" id="agregar" ${lista.length >= cupo ? 'disabled' : ''}>Agregar jugador</button>
        </div>
        <ul class="lista caja" style="padding:0 12px;margin-top:10px">${filtrada.map((j, i) => h`
          <li><span class="num">${lista.indexOf(j) + 1}</span>
            <span class="nom"><b>${esc(j.apellido)}, ${esc(j.nombre)}</b><small class="${j.dni ? '' : 'sin-dni'}">${j.dni ? 'DNI ' + esc(dniLindo(j.dni)) : 'Sin DNI cargado'}</small></span>
            <button class="mini" data-editar="${j.id}">Editar</button></li>`).join('') || `<li class="muted" style="justify-content:center">${q ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay jugadores.'}</li>`}</ul>

        ${bajas.length ? h`<details class="bajas"><summary>Dados de baja (${bajas.length})</summary>
          <ul class="lista">${bajas.map((j) => `<li><span class="nom"><b>${esc(j.apellido)}, ${esc(j.nombre)}</b><small>${j.dni ? 'DNI ' + esc(dniLindo(j.dni)) : ''}</small></span><button class="mini" data-devolver="${j.id}">Devolver</button></li>`).join('')}</ul></details>` : ''}`,
      montar(m) {
        const buscar = m.querySelector('#buscar');
        buscar.addEventListener('input', () => { estado.busqueda = buscar.value; const pos = buscar.selectionStart; render(); const nb = $app.querySelector('#buscar'); nb.focus(); nb.setSelectionRange(pos, pos); });
        m.querySelector('#copiar').addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(link); aviso('Link copiado'); } catch { prompt('Copiá el link:', link); }
        });
        m.querySelector('#pdf-plantel').addEventListener('click', () => window.PDF.plantel(torneo(), e, lista));
        m.querySelector('#agregar').addEventListener('click', () => hojaJugador(null, e.id));
        m.querySelector('#editar-eq').addEventListener('click', () => hojaEditarEquipo(e));
        m.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => hojaJugador(b.dataset.editar, e.id)));
        m.querySelectorAll('[data-devolver]').forEach((b) => b.addEventListener('click', async () => {
          await accion(b, async () => { const { error } = await sb.rpc('org_baja_jugador', { p_jugador: b.dataset.devolver, p_activo: true }); if (error) throw error; });
          await cargarTorneo(); aviso('Jugador devuelto al plantel'); render();
        }));
      }
    };
  }

  function hojaJugador(jugadorId, equipoId) {
    const j = jugadorId ? estado.jugadores.find((x) => x.id === jugadorId) : null;
    const opciones = estado.equipos.filter((e) => e.activo).map((e) => `<option value="${e.id}" ${e.id === (j?.equipo_id || equipoId) ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('');
    abrirHoja(h`
      <h2>${j ? 'Editar jugador' : 'Agregar jugador'}</h2>
      <form id="f-jug" novalidate>
        <label class="campo"><span>Nombre</span><input class="input" name="nombre" required value="${esc(j?.nombre || '')}" autocomplete="off"></label>
        <label class="campo"><span>Apellido</span><input class="input" name="apellido" required value="${esc(j?.apellido || '')}" autocomplete="off"></label>
        <label class="campo"><span>DNI</span><input class="input" name="dni" inputmode="numeric" value="${esc(j?.dni || '')}" placeholder="Solo números" autocomplete="off"></label>
        <label class="campo"><span>Fecha de nacimiento (opcional)</span><input class="input" name="nacimiento" type="date" value="${esc(j?.nacimiento || '')}"></label>
        ${j ? `<label class="campo"><span>Equipo</span><select class="input" name="equipo">${opciones}</select></label>` : ''}
        <div class="pie">
          <button class="btn" type="submit">${j ? 'Guardar cambios' : 'Agregar al plantel'}</button>
          ${j ? '<button class="btn btn-fantasma" type="button" id="baja" style="color:#ff8a92">Quitar del plantel</button>' : ''}
          <button class="btn btn-fantasma" type="button" data-cerrar>Cancelar</button>
        </div>
      </form>`, (p) => {
      const f = p.querySelector('#f-jug');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = new FormData(f); const b = f.querySelector('[type=submit]');
        await accion(b, async () => {
          const args = { p_nombre: d.get('nombre'), p_apellido: d.get('apellido'), p_dni: d.get('dni'), p_nacimiento: d.get('nacimiento') || null };
          const { error } = j
            ? await sb.rpc('org_editar_jugador', { p_jugador: j.id, ...args, p_equipo: d.get('equipo') })
            : await sb.rpc('org_agregar_jugador', { p_equipo: equipoId, ...args, p_origen: 'organización' });
          if (error) throw error;
        });
        cerrarHoja(); await cargarTorneo(); aviso(j ? 'Cambios guardados' : 'Jugador agregado'); render();
      });
      const baja = p.querySelector('#baja');
      if (baja) baja.addEventListener('click', async () => {
        if (baja.dataset.ok !== '1') { baja.dataset.ok = '1'; baja.textContent = 'Tocá de nuevo para confirmar'; return; }
        await accion(baja, async () => { const { error } = await sb.rpc('org_baja_jugador', { p_jugador: j.id, p_activo: false }); if (error) throw error; });
        cerrarHoja(); await cargarTorneo(); aviso('Jugador quitado. Queda en "Dados de baja" por si hay que devolverlo.'); render();
      });
    });
  }

  function hojaEditarEquipo(e) {
    abrirHoja(h`
      <h2>Editar equipo</h2>
      <form id="f-ed">
        <label class="campo"><span>Nombre</span><input class="input" name="nombre" required value="${esc(e.nombre)}"></label>
        <div class="fila">
          <label class="campo crece"><span>Color principal</span><input class="input" name="c1" type="color" value="${esc(e.color_primario || '#1d3a94')}" style="padding:4px"></label>
          <label class="campo crece"><span>Color secundario</span><input class="input" name="c2" type="color" value="${esc(e.color_secundario || '#f2f5fb')}" style="padding:4px"></label>
        </div>
        <p class="muted chico">Los colores se usan en la página del equipo y en sus gráficos.</p>
        <div class="pie">
          <button class="btn" type="submit">Guardar cambios</button>
          <button class="btn btn-fantasma" type="button" id="baja-eq" style="color:#ff8a92">Dar de baja el equipo</button>
          <button class="btn btn-fantasma" type="button" data-cerrar>Cancelar</button>
        </div>
      </form>`, (p) => {
      p.querySelector('#f-ed').addEventListener('submit', async (ev) => {
        ev.preventDefault(); const d = new FormData(ev.target); const b = ev.target.querySelector('[type=submit]');
        await accion(b, async () => { const { error } = await sb.from('equipos').update({ nombre: String(d.get('nombre')).trim(), color_primario: d.get('c1'), color_secundario: d.get('c2') }).eq('id', e.id); if (error) throw error; });
        cerrarHoja(); await cargarTorneo(); aviso('Equipo actualizado'); render();
      });
      const baja = p.querySelector('#baja-eq');
      baja.addEventListener('click', async () => {
        if (baja.dataset.ok !== '1') { baja.dataset.ok = '1'; baja.textContent = 'Tocá de nuevo para confirmar la baja'; return; }
        await accion(baja, async () => { const { error } = await sb.from('equipos').update({ activo: false }).eq('id', e.id); if (error) throw error; });
        cerrarHoja(); await cargarTorneo(); aviso('Equipo dado de baja'); location.hash = '#/equipos';
      });
    });
  }

  /* ---------- torneo ---------- */
  function vistaTorneo() {
    const t = torneo();
    if (!t) return { html: '<div class="vacio"><b>No hay torneos</b></div>' };
    const eqs = estado.equipos.filter((e) => e.activo);
    const opc = eqs.map((e) => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('');
    const chk = (k) => (t.carteles || []).includes(k) ? 'checked' : '';
    const prueba = estado.torneos.filter((x) => !x.visible);
    return {
      html: h`
        <div class="cabeza"><div><h1>Torneo</h1><p>Datos, carteles y planillas.</p></div></div>

        <h2 class="sub">Planilla de partido</h2>
        <form class="caja" id="f-planilla">
          <div class="fila">
            <label class="campo crece"><span>Local</span><select class="input" name="local">${opc}</select></label>
            <label class="campo crece"><span>Visitante</span><select class="input" name="visit">${opc}</select></label>
          </div>
          <div class="fila">
            <label class="campo crece"><span>Fecha n.º</span><input class="input" name="num" inputmode="numeric" placeholder="Ej.: 5"></label>
            <label class="campo crece"><span>Día</span><input class="input" name="dia" type="date"></label>
          </div>
          <label class="campo"><span>Cancha / horario (opcional)</span><input class="input" name="extra" placeholder="Ej.: Cancha 2 · 20:00"></label>
          <button class="btn btn-bloque" type="submit" ${eqs.length < 2 ? 'disabled' : ''}>Descargar planilla en PDF</button>
          <p class="muted chico" style="margin:10px 0 0">Lleva el plantel de los dos equipos con DNI, para firmar y anotar goles y tarjetas.</p>
        </form>

        <h2 class="sub">Datos del torneo</h2>
        <form class="caja" id="f-torneo">
          <label class="campo"><span>Nombre</span><input class="input" name="nombre" value="${esc(t.nombre)}"></label>
          <div class="fila">
            <label class="campo crece"><span>Día</span><input class="input" name="dia" value="${esc(t.dia || '')}"></label>
            <label class="campo crece"><span>Horario</span><input class="input" name="horario" value="${esc(t.horario || '')}"></label>
          </div>
          <label class="campo"><span>Cupo de jugadores por equipo</span><input class="input" name="cupo" type="number" min="1" max="60" value="${t.cupo_por_equipo}"></label>
          <div class="campo"><span>Carteles que se ven en la web</span>
            <div class="chips">${Object.entries(NOMBRES_CARTEL).map(([k, [txt]]) => `<label><input type="checkbox" name="cartel" value="${k}" ${chk(k)}><span>${esc(txt)}</span></label>`).join('')}</div></div>
          <div class="fila" style="margin:6px 0 14px"><div class="crece"><b>Visible en la web</b><div class="muted chico">Si lo apagás, el torneo no aparece para el público.</div></div>
            <label class="switch"><span class="sr">Visible</span><input type="checkbox" name="visible" ${t.visible ? 'checked' : ''}><span></span></label></div>
          <button class="btn btn-bloque" type="submit">Guardar datos del torneo</button>
        </form>

        ${prueba.length ? h`<h2 class="sub">Torneos ocultos</h2>
          ${prueba.map((x) => h`<div class="caja fila"><div class="crece"><b>${esc(x.nombre)}</b><div class="muted chico">No se ve en la web.</div></div>
            <button class="btn btn-chico btn-rojo" data-borrar-torneo="${x.id}">Eliminar</button></div>`).join('')}` : ''}`,
      montar(m) {
        const fp = m.querySelector('#f-planilla');
        if (eqs.length > 1) fp.visit.selectedIndex = 1;
        fp.addEventListener('submit', (e) => {
          e.preventDefault(); const d = new FormData(fp);
          const L = equipo(d.get('local')), V = equipo(d.get('visit'));
          if (L.id === V.id) { aviso('Elegí dos equipos distintos', 'error'); return; }
          window.PDF.planilla(t, L, activos(L.id), V, activos(V.id), { num: d.get('num'), dia: d.get('dia'), extra: d.get('extra') }, suspendidosDe);
        });
        m.querySelector('#f-torneo').addEventListener('submit', async (e) => {
          e.preventDefault(); const d = new FormData(e.target); const b = e.target.querySelector('[type=submit]');
          const cambios = { nombre: String(d.get('nombre')).trim(), dia: String(d.get('dia')).trim(), horario: String(d.get('horario')).trim(),
            cupo_por_equipo: Math.max(1, parseInt(d.get('cupo'), 10) || 24), carteles: d.getAll('cartel'), visible: d.get('visible') === 'on' };
          await accion(b, async () => { const { error } = await sb.from('torneos').update(cambios).eq('id', t.id); if (error) throw error; });
          Object.assign(t, cambios); aviso('Datos guardados'); render();
        });
        m.querySelectorAll('[data-borrar-torneo]').forEach((b) => b.addEventListener('click', () => hojaBorrarTorneo(b.dataset.borrarTorneo)));
      }
    };
  }

  // Suspendidos para marcar en la planilla (se completa cuando esté la carga de partidos)
  let suspendidosCache = [];
  const suspendidosDe = (jugadorId) => suspendidosCache.find((s) => s.jugador_id === jugadorId);
  async function cargarSuspendidos() {
    const { data } = await sb.from('v_suspendidos').select('*').eq('torneo_id', estado.torneoId);
    suspendidosCache = data || [];
  }

  function hojaBorrarTorneo(id) {
    const x = estado.torneos.find((t) => t.id === id);
    abrirHoja(h`
      <h2>Eliminar "${esc(x.nombre)}"</h2>
      <p class="muted">Se borran para siempre el torneo, sus equipos, jugadores, partidos y solicitudes. No se puede deshacer.</p>
      <form id="f-borrar">
        <label class="campo"><span>Escribí <b>${esc(x.nombre)}</b> para confirmar</span><input class="input" name="conf" autocomplete="off"></label>
        <div class="pie"><button class="btn btn-rojo" type="submit">Eliminar para siempre</button><button class="btn btn-fantasma" type="button" data-cerrar>Cancelar</button></div>
      </form>`, (p) => p.querySelector('#f-borrar').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (String(new FormData(e.target).get('conf')).trim() !== x.nombre) { aviso('El nombre no coincide', 'error'); return; }
        const b = e.target.querySelector('[type=submit]');
        await accion(b, async () => {
          for (const tabla of ['partidos', 'sanciones', 'solicitudes', 'jugadores', 'equipos']) {
            const { error } = await sb.from(tabla).delete().eq('torneo_id', id); if (error) throw error;
          }
          const { error } = await sb.from('torneos').delete().eq('id', id); if (error) throw error;
        });
        cerrarHoja(); await cargarTorneos(); await cargarTorneo(); aviso('Torneo eliminado'); render();
      }));
  }

  /* ---------- arranque ---------- */
  let arrancando = null;
  function arrancar() {
    if (!arrancando) arrancando = arrancarReal().finally(() => { arrancando = null; });
    return arrancando;
  }
  async function arrancarReal() {
    const { data: { session } } = await sb.auth.getSession();
    estado.sesion = session;
    if (estado.recuperando) return pantallaIngreso('nueva');
    if (!session) { estado.organizador = null; return pantallaIngreso('entrar'); }
    $app.innerHTML = '<div class="cargando">Cargando…</div>';
    const email = (session.user.email || '').toLowerCase();
    const { data: org, error } = await sb.from('organizadores').select('*').eq('email', email).eq('activo', true).maybeSingle();
    if (error || !org) { estado.organizador = null; return pantallaSinAcceso(email); }
    estado.organizador = org;
    try { await cargarTorneos(); await cargarTorneo(); await cargarSuspendidos(); }
    catch (e) { $app.innerHTML = `<div class="vacio"><b>No se pudieron cargar los datos</b>${esc(textoError(e))}</div>`; return; }
    escucharSolicitudes();
    render();
  }

  sb.auth.onAuthStateChange((evento) => {
    if (evento === 'PASSWORD_RECOVERY') { estado.recuperando = true; pantallaIngreso('nueva'); return; }
    if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') arrancar();
  });
  arrancar();
})();
