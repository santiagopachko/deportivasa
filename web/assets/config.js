// Conexión pública a la base de Deportivasa y datos de contacto.
// La clave es "publicable": está pensada para ir en la web. Los datos privados
// (DNI, solicitudes, códigos) están protegidos por las reglas de la base, no por esta clave.
window.DEPORTIVASA = {
  supabaseUrl: 'https://nahlizxwlxudfvnsxsrn.supabase.co',
  supabaseKey: 'sb_publishable_Wt3LNpL2Ny82jwAEwCyl8A_G91edsCz',
  torneoPorDefecto: 'sabados-f8-lugano',

  whatsapp: {
    mateo: '5491138444369',     // principal
    santiago: '5491134600793'   // alternativo
  },

  // Mensaje precargado del botón de WhatsApp (texto definido por Santiago).
  // Las líneas de torneos se arman solas con los torneos visibles.
  mensajeWhatsapp(torneos) {
    const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    const lineas = torneos.map((t, i) => `${nums[i] || (i + 1) + '.'} ${(t.dia || '').toUpperCase()} Fútbol ${String(t.modalidad || '').replace(/^F/, '')} – ${t.sede?.nombre || ''}${t.sede?.localidad ? ' - ' + t.sede.localidad : ''}`);
    return [
      '¡Hola Torneos Deportivasa! ⚽ Quiero información para participar.',
      '',
      '🏆 *Torneo que me interesa* (dejá el número que elijas):',
      ...lineas,
      'Elijo el: ',
      '',
      '📋 *Consulto por* (equipo / sponsor / otra): ',
      '👥 *Nombre del equipo o marca:* ',
      '🙋 *Mi nombre:*'
    ].join('\n');
  },

  redes: [
    { red: 'instagram', nombre: 'Instagram', usuario: '@_deportivasa', url: 'https://instagram.com/_deportivasa' },
    { red: 'tiktok', nombre: 'TikTok', usuario: '@torneos.deportivasa', url: 'https://www.tiktok.com/@torneos.deportivasa' },
    { red: 'facebook', nombre: 'Facebook', usuario: 'Torneos Deportivasa', url: 'https://www.facebook.com/share/17fDrSvvAd/' },
    { red: 'canal', nombre: 'Canal de WhatsApp', usuario: 'TORNEOS DEPORTIVASA', url: 'https://whatsapp.com/channel/0029VbCxgs2545uzwQP2vY1l' },
    { red: 'youtube', nombre: 'YouTube', usuario: 'Próximamente', url: null }
  ],

  // Página de fotos de las fechas (la que ya existe)
  fotosUrl: 'https://santiagopachko.github.io/deportivasa/'
};
