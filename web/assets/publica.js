/* Deportivasa – web pública (5 solapas). Solo lee datos públicos: nunca DNI. */
(() => {
  'use strict';
  const CFG = window.DEPORTIVASA;
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: false } });
  const $ = (s, el = document) => el.querySelector(s);
  const vista = $('#vista');
  const waBtn = $('#wa-flotante'), waMenu = $('#wa-menu');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CARTELES = {
    en_proceso: ['En proceso', 'verde'], por_finalizar: ['Por finalizar', 'rojo latido'],
    inscripciones_abiertas: ['Inscripciones abiertas', 'rojo latido'], cupos_abiertos: ['Cupos abiertos', 'rojo'],
    finalizado: ['Finalizado', 'gris'], proximamente: ['Próximamente', 'gris']
  };
  const cartel = (k) => CARTELES[k] ? `<span class="cartel ${CARTELES[k][1]}">${CARTELES[k][0]}</span>` : '';
  const modalidad = (t) => 'Fútbol ' + String(t.modalidad || '').replace(/^F/i, '');
  const direccion = (s) => s ? [s.direccion, s.localidad].filter(Boolean).join(', ') : '';
  const mapsUrl = (s) => s?.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s?.nombre + ' ' + direccion(s))}`;
  const wazeUrl = (s) => `https://waze.com/ul?q=${encodeURIComponent(direccion(s))}&navigate=yes`;

  // ---------- íconos ----------
  const ICO = {
    instagram: '<svg viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 4.8a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zm5.2-9.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.8 5.8 0 1 0 4.9 5.7V9.1a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15V9l5.8 3z"/></svg>',
    canal: '<svg viewBox="0 0 32 32"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm5.8 15.7c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8 1 3.8.8.6-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5-.3-.2-.6-.4z"/></svg>'
  };
  const PELOTA = '<svg viewBox="0 0 100 100" fill="none" stroke="#fff" stroke-width="3"><circle cx="50" cy="50" r="46"/><path d="M50 26l16 12-6 19H40l-6-19z"/><path d="M50 26V6M66 38l18-8M60 57l12 16M40 57L28 73M34 38l-18-8"/></svg>';
  const copa = (color) => `<svg viewBox="0 0 64 64" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"><path d="M20 8h24v14a12 12 0 0 1-24 0z" fill="${color}" fill-opacity=".22"/><path d="M44 12h8v4a8 8 0 0 1-8 8M20 12h-8v4a8 8 0 0 0 8 8M32 34v12M22 56h20l-2-10H24z"/></svg>`;

  const waLink = (quien, extra) => {
    let msg = CFG.mensajeWhatsapp(estado.torneos);
    if (extra) msg = msg.replace('(equipo / sponsor / otra): ', '(equipo / sponsor / otra): ' + extra);
    return `https://wa.me/${CFG.whatsapp[quien]}?text=${encodeURIComponent(msg)}`;
  };

  // ---------- datos ----------
  const estado = { torneos: [], cache: {} };
  const cargarTorneos = sb.from('torneos').select('*, sede:sedes(*)').eq('visible', true).order('orden')
    .then(({ data }) => { estado.torneos = data || []; actualizarWhatsapp(); return estado.torneos; })
    .catch(() => []);
  async function leer(clave, consulta) {
    if (!estado.cache[clave]) estado.cache[clave] = consulta().then(({ data }) => data || []).catch(() => []);
    return estado.cache[clave];
  }

  // ---------- piezas comunes ----------
  function tarjetaTorneo(t) {
    const s = t.sede || {};
    const img = t.foto_url ? `<div class="imagen" style="background-image:url('${esc(t.foto_url)}')"></div>` : `<div class="imagen grafica">${PELOTA}</div>`;
    return `<a class="torneo-tarjeta" href="#/torneo/${esc(t.slug)}">
      ${img}
      <div class="carteles">${(t.carteles || []).map(cartel).join('')}</div>
      <h3>${esc(t.nombre)}</h3>
      <div class="sede">📍 ${esc(s.nombre || 'Sede a confirmar')}${s.localidad ? ' · ' + esc(s.localidad) : ''}</div>
      <div class="cuando">${esc(t.dia || '')} · ${esc(t.horario || 'Horario a confirmar')} · ${modalidad(t)}</div>
      <div class="franja-premios">🏆 Premios para 1.º, 2.º y 3.º puesto</div>
      <div class="pie-tarjeta"><span class="btn btn-claro btn-chico">Ver torneo</span></div>
    </a>`;
  }
  const redesHtml = () => `<div class="redes">${CFG.redes.map((r) => r.url
    ? `<a class="red" href="${r.url}" target="_blank" rel="noopener"><span class="icono">${ICO[r.red]}</span><span><b>${r.nombre}</b><span>${esc(r.usuario)}</span></span></a>`
    : `<div class="red apagada"><span class="icono">${ICO[r.red]}</span><span><b>${r.nombre}</b><span>${esc(r.usuario)}</span></span></div>`).join('')}</div>`;
  const iconosRedes = () => `<div class="iconos-redes">${CFG.redes.map((r) => r.url
    ? `<a href="${r.url}" target="_blank" rel="noopener" aria-label="${r.nombre}">${ICO[r.red]}</a>`
    : `<a aria-disabled="true" aria-label="${r.nombre} (próximamente)">${ICO[r.red]}</a>`).join('')}</div>`;
  const llamado = (titulo = '¿Tenés equipo? Inscribilo') => `<section class="llamado">
      <h2>${titulo}</h2><p>Escribinos por WhatsApp y te contamos todo: días, sedes, cupos y premios.</p>
      <a class="btn btn-claro" href="#/inscribite">Inscribí tu equipo</a></section>`;
  const premiosBloque = () => `<section class="premios-bloque">
      <h2>Jugá por premios</h2>
      <p class="bajada" style="margin:6px 0 0;color:var(--tiza-2)">Cada torneo arranca en liguilla y se define en copas: nadie se queda afuera.</p>
      <div class="copas">
        <div class="copa oro">${copa('#e6c26e')}<b>Copa de Oro</b><span>Los mejores de la liguilla</span></div>
        <div class="copa plata">${copa('#d6dce6')}<b>Copa de Plata</b><span>Revancha para el resto</span></div>
      </div>
      <ul class="lista-premios">
        <li><b>🥇 Campeón</b><span>Premio mayor · detalle muy pronto</span></li>
        <li><b>🥈 Subcampeón</b><span>Premio · detalle muy pronto</span></li>
        <li><b>🥉 Tercer puesto</b><span>Premio · detalle muy pronto</span></li>
      </ul>
      <a class="btn btn-claro" href="#/inscribite">Quiero jugar</a>
    </section>`;

  // ---------- solapas ----------
  async function inicio() {
    vista.innerHTML = `
      <section class="portada">
        <div class="fondo" aria-hidden="true"><svg viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice"><g class="lineas">
          <rect x="30" y="40" width="340" height="620" rx="4"/><line x1="30" y1="350" x2="370" y2="350"/><circle cx="200" cy="350" r="62"/>
          <rect x="110" y="40" width="180" height="90"/><rect x="110" y="570" width="180" height="90"/></g></svg></div>
        <div class="contenido">
          <img class="escudo-grande brilla" src="assets/escudo-480.png" alt="Escudo de Deportivasa">
          <h1 class="lema">Donde el deporte se vive</h1>
          <p class="bajada">Armamos torneos para los que viven el fútbol en serio. Fixture, tablas, goleadores y cada partido filmado, todo en un solo lugar. Elegí tu día, tu cancha y sumate con tu equipo.</p>
          <div class="acciones"><a class="btn btn-claro" href="#/inscribite">Inscribí tu equipo</a><a class="btn btn-fantasma" href="#/torneos">Ver torneos</a></div>
        </div>
      </section>
      <section class="seccion"><div class="envoltura">
        <h2>Esta semana</h2>
        <div class="semana">
          <div class="ficha"><small>Jugada del día</small><h3>Muy pronto</h3><p>Cada día, el mejor gol de la fecha filmado por Veo.</p></div>
          <div class="ficha"><small>Próxima fecha</small><h3>Fixture en camino</h3><p>Días, horarios y canchas de cada partido, acá mismo.</p></div>
          <div class="ficha"><small>Goleador</small><h3>¿Quién la rompe?</h3><p>La tabla de goleadores se actualiza al final de cada partido.</p></div>
        </div>
      </div></section>
      <section class="seccion"><div class="envoltura">
        <h2>Nuestros torneos</h2><p class="bajada">Elegí el día y la sede que te queden mejor.</p>
        <div class="torneos" id="lista-torneos"><p class="vacio-p">Cargando torneos…</p></div>
      </div></section>
      <section class="seccion"><div class="envoltura">${premiosBloque()}</div></section>
      <section class="seccion"><div class="envoltura">
        <h2>Sponsors</h2><p class="bajada">Las marcas que bancan el fútbol de barrio.</p>
        ${cinta()}
        <p style="margin-top:14px"><a class="btn btn-fantasma btn-chico" href="#/sponsors">Sumá tu marca</a></p>
      </div></section>
      <section class="seccion"><div class="envoltura">
        <h2>Seguinos</h2><p class="bajada">Goles, resultados y novedades todos los días.</p>
        <a class="canal" href="${CFG.redes.find((r) => r.red === 'canal').url}" target="_blank" rel="noopener"><span class="icono" style="width:46px;height:46px;display:grid;place-items:center;border-radius:50%;background:#25d366;flex:none"><svg viewBox="0 0 32 32" width="26" height="26" fill="#fff">${ICO.canal.replace(/<\/?svg[^>]*>/g, '')}</svg></span><span><b>Canal de WhatsApp</b><span>Enterate primero de fixture, resultados y cupos.</span></span></a>
        <div style="margin-top:12px">${redesHtml()}</div>
        ${llamado()}
      </div></section>`;
    const ts = await cargarTorneos;
    $('#lista-torneos').innerHTML = ts.length ? ts.map(tarjetaTorneo).join('') : '<p class="vacio-p">Pronto vas a ver acá los torneos.</p>';
  }

  async function torneos() {
    vista.innerHTML = `<div class="envoltura">
      <div class="titulo-pagina"><h1>Torneos</h1><p>Todos nuestros torneos, con sus sedes y cómo llegar.</p></div>
      <div class="torneos" id="lista-torneos"><p class="vacio-p">Cargando torneos…</p></div>
      <section class="seccion"><h2 style="font-size:clamp(1.8rem,6vw,2.4rem);font-style:italic;text-transform:uppercase">Nuestras sedes</h2>
        <div class="redes" id="sedes" style="margin-top:12px"></div></section>
      ${llamado()}</div>`;
    const ts = await cargarTorneos;
    $('#lista-torneos').innerHTML = ts.length ? ts.map(tarjetaTorneo).join('') : '<p class="vacio-p">Pronto vas a ver acá los torneos.</p>';
    const sedes = [...new Map(ts.filter((t) => t.sede).map((t) => [t.sede.id || t.sede.nombre, t.sede])).values()];
    $('#sedes').innerHTML = sedes.map((s) => `<a class="red" href="${mapsUrl(s)}" target="_blank" rel="noopener">
        <span class="icono" style="font-size:1.3rem">📍</span><span><b>${esc(s.nombre)}</b><span>${esc(direccion(s))}</span></span></a>`).join('');
  }

  async function torneo(slug, pestana = 'info') {
    const ts = await cargarTorneos;
    const t = ts.find((x) => x.slug === slug);
    if (!t) { vista.innerHTML = `<div class="envoltura"><div class="vacio-p"><b>No encontramos ese torneo</b><a class="btn btn-claro" style="margin-top:14px" href="#/torneos">Ver torneos</a></div></div>`; return; }
    const s = t.sede || {};
    const pest = [['info', 'Info'], ['tabla', 'Tabla'], ['fixture', 'Fixture'], ['goleadores', 'Goleadores'], ['equipos', 'Equipos']];
    vista.innerHTML = `
      <header class="torneo-cabecera">
        <div class="imagen ${t.foto_url ? '' : 'grafica'}" ${t.foto_url ? `style="background-image:url('${esc(t.foto_url)}')"` : ''}></div>
        <div class="envoltura">
          <a class="volver" href="#/torneos">← Todos los torneos</a>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px">${(t.carteles || []).map(cartel).join('')}</div>
          <h1>${esc(t.nombre)}</h1>
          <p>📍 ${esc(s.nombre || 'Sede a confirmar')}${s.localidad ? ' · ' + esc(s.localidad) : ''} · ${esc(t.dia || '')} ${esc(t.horario || '')}</p>
        </div>
      </header>
      <nav class="pestanas" role="tablist">${pest.map(([k, n]) => `<button role="tab" data-p="${k}" aria-selected="${k === pestana}">${n}</button>`).join('')}</nav>
      <div class="envoltura" style="padding-top:16px"><div id="pestana"></div>${llamado('Inscribí tu equipo en este torneo')}</div>`;
    vista.querySelectorAll('.pestanas button').forEach((b) => b.addEventListener('click', () => {
      history.replaceState(null, '', `#/torneo/${slug}/${b.dataset.p}`);
      vista.querySelectorAll('.pestanas button').forEach((x) => x.setAttribute('aria-selected', x === b));
      pintarPestana(t, b.dataset.p);
    }));
    pintarPestana(t, pestana);
  }

  async function pintarPestana(t, p) {
    const caja = $('#pestana'); const s = t.sede || {};
    const vacio = (titulo, texto) => `<div class="caja-p vacio-p"><b>${titulo}</b>${texto}</div>`;
    if (p === 'info') {
      caja.innerHTML = `
        <div class="caja-p">
          <div class="dato"><span>Día y horario</span><b>${esc(t.dia || '')} · ${esc(t.horario || 'A confirmar')}</b></div>
          <div class="dato"><span>Modalidad</span><b>${modalidad(t)}</b></div>
          <div class="dato"><span>Formato</span><b>Liguilla y después Copa de Oro y Copa de Plata</b></div>
          ${t.descripcion ? `<div class="dato"><span>Más</span><span style="color:var(--tiza)">${esc(t.descripcion)}</span></div>` : ''}
        </div>
        <div class="caja-p">
          <h3 style="font-size:1.5rem;font-style:italic;text-transform:uppercase">Cómo llegar</h3>
          <p style="margin:4px 0 12px;color:var(--tiza-2)">${esc(s.nombre || '')}${direccion(s) ? ' · ' + esc(direccion(s)) : ''}</p>
          ${direccion(s) ? `<iframe class="mapa" loading="lazy" title="Mapa de ${esc(s.nombre)}" src="https://www.google.com/maps?q=${encodeURIComponent(direccion(s))}&output=embed"></iframe>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><a class="btn btn-claro btn-chico" href="${mapsUrl(s)}" target="_blank" rel="noopener">Google Maps</a><a class="btn btn-fantasma btn-chico" href="${wazeUrl(s)}" target="_blank" rel="noopener">Waze</a></div>` : ''}
        </div>
        <div style="margin-top:12px">${premiosBloque()}</div>`;
    } else if (p === 'tabla') {
      caja.innerHTML = '<p class="vacio-p">Cargando…</p>';
      const filas = await leer('tabla-' + t.id, () => sb.from('v_tabla').select('*').eq('torneo_id', t.id).order('posicion'));
      if (!filas.length || filas.every((f) => !f.pj)) { caja.innerHTML = vacio('La tabla arranca pronto', 'Se completa sola al final de cada partido.'); return; }
      caja.innerHTML = `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>#</th><th style="text-align:left">Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th class="ext">GF</th><th class="ext">GC</th><th>DG</th><th>Pts</th></tr></thead><tbody>
        ${filas.map((f) => `<tr><td class="pos">${f.posicion}</td><td class="eq">${esc(f.nombre)}</td><td>${f.pj}</td><td>${f.pg}</td><td>${f.pe}</td><td>${f.pp}</td><td class="ext">${f.gf}</td><td class="ext">${f.gc}</td><td>${f.dg > 0 ? '+' : ''}${f.dg}</td><td class="pts">${f.pts}</td></tr>`).join('')}
        </tbody></table></div>`;
    } else if (p === 'fixture') {
      caja.innerHTML = '<p class="vacio-p">Cargando…</p>';
      const fechas = await leer('fechas-' + t.id, () => sb.from('fechas').select('*, partidos(*, local:equipos!partidos_local_id_fkey(nombre), visitante:equipos!partidos_visitante_id_fkey(nombre))').eq('torneo_id', t.id).order('orden'));
      if (!fechas.length) { caja.innerHTML = vacio('Fixture en camino', 'Acá vas a ver cada fecha con sus horarios y canchas.'); return; }
      caja.innerHTML = fechas.map((f) => `<div class="caja-p"><h3 style="font-size:1.4rem;font-style:italic;text-transform:uppercase">${esc(f.nombre)}</h3>
        ${(f.partidos || []).map((pa) => `<div class="dato"><span>${pa.hora ? pa.hora.slice(0, 5) : ''}</span><b>${esc(pa.local?.nombre || 'A definir')} ${pa.estado === 'finalizado' || pa.estado === 'en_vivo' ? `${pa.goles_local} - ${pa.goles_visitante}` : 'vs'} ${esc(pa.visitante?.nombre || 'A definir')}</b></div>`).join('') || '<p style="color:var(--tiza-2)">Partidos a confirmar.</p>'}</div>`).join('');
    } else if (p === 'goleadores') {
      caja.innerHTML = '<p class="vacio-p">Cargando…</p>';
      const g = await leer('gol-' + t.id, () => sb.from('v_goleadores').select('*').eq('torneo_id', t.id).order('goles', { ascending: false }));
      if (!g.length) { caja.innerHTML = vacio('Todavía no hay goles cargados', 'Cada gol suma acá apenas termina el partido.'); return; }
      caja.innerHTML = `<div class="tabla-wrap"><table class="tabla" style="min-width:0"><thead><tr><th>#</th><th style="text-align:left">Jugador</th><th style="text-align:left">Equipo</th><th>Goles</th></tr></thead><tbody>
        ${g.slice(0, 20).map((x, i) => `<tr><td class="pos">${i + 1}</td><td class="eq">${esc(x.nombre)} ${esc(x.apellido)}</td><td style="text-align:left;color:var(--tiza-2)">${esc(x.equipo)}</td><td class="pts">${x.goles}</td></tr>`).join('')}</tbody></table></div>`;
    } else if (p === 'equipos') {
      caja.innerHTML = '<p class="vacio-p">Cargando…</p>';
      const filas = await leer('plantel-' + t.id, () => sb.from('v_planteles').select('equipo_id, equipo, nombre, apellido').eq('torneo_id', t.id));
      if (!filas.length) { caja.innerHTML = vacio('Equipos por confirmar', 'Cuando se cierren las inscripciones vas a ver acá cada plantel.'); return; }
      const eqs = new Map();
      filas.forEach((f) => { if (!eqs.has(f.equipo_id)) eqs.set(f.equipo_id, { nombre: f.equipo, jug: [] }); eqs.get(f.equipo_id).jug.push(f); });
      caja.innerHTML = `<div class="planteles">${[...eqs.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((e) => `
        <details class="caja-p plantel"><summary style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:10px"><h3>${esc(e.nombre)}</h3><span class="cartel gris">${e.jug.length} jugadores</span></summary>
        <ol>${e.jug.sort((a, b) => a.apellido.localeCompare(b.apellido)).map((j) => `<li>${esc(j.apellido)}, ${esc(j.nombre)}</li>`).join('')}</ol></details>`).join('')}</div>`;
    }
  }

  function videos() {
    vista.innerHTML = `<div class="envoltura">
      <div class="titulo-pagina"><h1>Videos y fotos</h1><p>Cada partido se filma. Muy pronto vas a ver acá los goles, los resúmenes y la jugada del día.</p></div>
      <div class="mosaico">
        ${['Gol de la fecha', 'Resumen del partido', 'Jugada del día'].map((n, i) => `<div class="video-falso"><span class="play">▶</span><div><div class="marcador-grande">${['1 – 0', '3 – 2', '⚡'][i]}</div><small>${n} · Próximamente en YouTube</small></div></div>`).join('')}
      </div>
      <section class="seccion"><div class="caja-p" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:space-between">
        <div><h3 style="font-size:1.6rem;font-style:italic;text-transform:uppercase">Fotos de cada fecha</h3><p style="margin:4px 0 0;color:var(--tiza-2)">Buscá tu foto y descargala.</p></div>
        <a class="btn btn-claro" href="${CFG.fotosUrl}" target="_blank" rel="noopener">Ver fotos</a></div></section>
      <section class="seccion">${redesHtml()}</section>
      ${llamado()}</div>`;
  }

  function cinta() {
    const lugares = Array.from({ length: 8 }, () => '<div class="lugar">Tu marca acá</div>').join('');
    return `<div class="cinta" aria-hidden="true"><div class="pista">${lugares}${lugares}</div></div>`;
  }

  function sponsors() {
    vista.innerHTML = `<div class="envoltura" style="padding-top:20px">
      <section class="sponsors-hero">
        <h2>Tu marca, en la cancha</h2>
        <p>Cada fin de semana cientos de jugadores, familias y seguidores viven Deportivasa en la cancha y en las redes. Poné tu marca donde se vive el fútbol.</p>
        <a class="btn btn-claro" href="${waLink('mateo', 'sponsor')}" target="_blank" rel="noopener">Quiero ser sponsor</a>
      </section>
      <div class="beneficios">
        <div class="beneficio"><b>En cada video</b><span>Tu logo en goles, resúmenes y la jugada del día.</span></div>
        <div class="beneficio"><b>En la web</b><span>Presencia en tablas, fixture y página de cada torneo.</span></div>
        <div class="beneficio"><b>En las redes</b><span>Historias y publicaciones en Instagram, TikTok y Facebook.</span></div>
        <div class="beneficio"><b>En la cancha</b><span>Premios con tu nombre y acciones con los equipos.</span></div>
      </div>
      <section class="seccion"><h2 style="font-size:clamp(1.8rem,6vw,2.4rem);font-style:italic;text-transform:uppercase">Nos acompañan</h2>
        <p class="bajada" style="color:var(--tiza-2)">Este lugar está esperando a tu marca.</p>${cinta()}</section>
      ${llamado()}</div>`;
  }

  async function inscribite() {
    vista.innerHTML = `<div class="envoltura">
      <div class="titulo-pagina"><h1>Inscribite</h1><p>Sumá a tu equipo en tres pasos. Te respondemos por WhatsApp.</p></div>
      <div class="contactos">
        <a class="contacto principal" data-wa="mateo" href="${waLink('mateo')}" target="_blank" rel="noopener"><span class="icono">${ICO.canal.replace('<svg', '<svg fill="#fff"')}</span><span><b>Mateo</b><span>Contacto principal · WhatsApp</span></span></a>
        <a class="contacto" data-wa="santiago" href="${waLink('santiago')}" target="_blank" rel="noopener"><span class="icono">${ICO.canal.replace('<svg', '<svg fill="#fff"')}</span><span><b>Santiago</b><span>Alternativo · WhatsApp</span></span></a>
      </div>
      <section class="seccion"><h2 style="font-size:clamp(1.8rem,6vw,2.4rem);font-style:italic;text-transform:uppercase">Cómo funciona</h2>
        <ol class="pasos" style="margin-top:12px">
          <li><span><b>Escribinos</b><br><span style="color:var(--tiza-2)">El mensaje ya va armado: solo elegí el torneo y completá tus datos.</span></span></li>
          <li><span><b>Te confirmamos el cupo</b><br><span style="color:var(--tiza-2)">Te contamos día, sede, horarios y premios.</span></span></li>
          <li><span><b>Cargás tu plantel</b><br><span style="color:var(--tiza-2)">Te pasamos un link para que tus jugadores se anoten solos.</span></span></li>
        </ol></section>
      <section class="seccion"><h2 style="font-size:clamp(1.8rem,6vw,2.4rem);font-style:italic;text-transform:uppercase">Elegí tu torneo</h2>
        <div class="torneos" id="lista-torneos" style="margin-top:12px"></div></section>
      <section class="seccion">${redesHtml()}</section></div>`;
    const ts = await cargarTorneos;
    $('#lista-torneos').innerHTML = ts.map(tarjetaTorneo).join('');
    vista.querySelectorAll('.contacto[data-wa]').forEach((a) => { a.href = waLink(a.dataset.wa); });
  }

  // ---------- pie, WhatsApp y ruteo ----------
  $('#pie').innerHTML = `<img src="assets/escudo-192.png" alt="">${iconosRedes()}
    <p>Torneos Deportivasa · Donde el deporte se vive</p><p><a class="org" href="org/">Ingreso organizadores</a></p>`;

  function actualizarWhatsapp() { waMenu.querySelectorAll('[data-wa]').forEach((a) => { a.href = waLink(a.dataset.wa); }); }
  actualizarWhatsapp();
  waBtn.addEventListener('click', (e) => { e.stopPropagation(); waMenu.hidden = !waMenu.hidden; waBtn.setAttribute('aria-expanded', !waMenu.hidden); });
  document.addEventListener('click', (e) => { if (!waMenu.hidden && !waMenu.contains(e.target)) { waMenu.hidden = true; waBtn.setAttribute('aria-expanded', 'false'); } });

  function rutear() {
    const partes = (location.hash.replace(/^#\/?/, '') || '').split('/');
    const r = partes[0] || 'inicio';
    const solapa = r === 'torneo' ? 'torneos' : r;
    document.querySelectorAll('.barra-solapas a').forEach((a) => {
      if (a.dataset.solapa === solapa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('#tope-inscribi').hidden = r === 'inscribite';
    waMenu.hidden = true;
    ({ inicio, torneos, videos, sponsors, inscribite }[r] || (r === 'torneo' ? () => torneo(partes[1], partes[2]) : inicio))();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', rutear);
  rutear();
})();
