/* Deportivasa – PDFs (plantel y planilla de partido). Usa jsPDF + autotable. */
(() => {
  'use strict';
  const AZUL = [12, 31, 74], AZUL_2 = [29, 58, 148], GRIS = [110, 122, 150];
  let escudo = null;

  async function cargarEscudo() {
    if (escudo) return escudo;
    try {
      const r = await fetch('../assets/escudo-192.png');
      const b = await r.blob();
      escudo = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); });
    } catch { escudo = null; }
    return escudo;
  }
  const dni = (d) => d ? String(d).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—';
  const fechaLarga = (iso) => iso ? new Date(iso + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const nombreArchivo = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

  function encabezado(doc, titulo, subtitulo, img) {
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(...AZUL); doc.rect(0, 0, W, 30, 'F');
    if (img) doc.addImage(img, 'PNG', 10, 3.5, 20, 23);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(titulo, 35, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(subtitulo, 35, 21);
    doc.setTextColor(0, 0, 0);
  }
  function pie(doc) {
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
      doc.setFontSize(8); doc.setTextColor(...GRIS);
      doc.text('Torneos Deportivasa · Donde el deporte se vive', 10, H - 6);
      doc.text(`Página ${i} de ${n}`, W - 10, H - 6, { align: 'right' });
    }
  }

  async function plantel(torneo, equipo, jugadores) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const img = await cargarEscudo();
    encabezado(doc, equipo.nombre.toUpperCase(), `${torneo.nombre} · ${torneo.sede?.nombre || ''} · Plantel (${jugadores.length} jugadores)`, img);
    doc.autoTable({
      startY: 38,
      head: [['N.º', 'Apellido y nombre', 'DNI']],
      body: jugadores.map((j, i) => [i + 1, `${j.apellido}, ${j.nombre}`, dni(j.dni)]),
      theme: 'striped',
      headStyles: { fillColor: AZUL_2, fontStyle: 'bold' },
      styles: { fontSize: 10.5, cellPadding: 2.4 },
      columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 2: { cellWidth: 36 } }
    });
    doc.setFontSize(9); doc.setTextColor(...GRIS);
    doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, 10, doc.lastAutoTable.finalY + 8);
    pie(doc);
    doc.save(`plantel-${nombreArchivo(equipo.nombre)}.pdf`);
  }

  async function planilla(torneo, local, jugL, visit, jugV, datos, suspendido) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const img = await cargarEscudo();
    const W = doc.internal.pageSize.getWidth();
    const linea2 = [datos.num ? `Fecha ${datos.num}` : '', fechaLarga(datos.dia), datos.extra].filter(Boolean).join(' · ');
    encabezado(doc, 'PLANILLA DE PARTIDO', `${torneo.nombre} · ${torneo.sede?.nombre || ''}${linea2 ? ' · ' + linea2 : ''}`, img);

    // Marcador
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...AZUL);
    doc.text(local.nombre.toUpperCase(), W / 2 - 22, 42, { align: 'right' });
    doc.text(visit.nombre.toUpperCase(), W / 2 + 22, 42);
    doc.setDrawColor(...AZUL); doc.setLineWidth(.5);
    doc.rect(W / 2 - 18, 35, 14, 11); doc.rect(W / 2 + 4, 35, 14, 11);
    doc.setFontSize(12); doc.text('—', W / 2, 42.5, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    const tabla = (equipo, jugadores, y) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...AZUL_2);
      doc.text(equipo.nombre, 10, y); doc.setTextColor(0, 0, 0);
      const filas = jugadores.map((j, i) => {
        const s = suspendido && suspendido(j.id);
        return [i + 1, `${j.apellido}, ${j.nombre}${s ? '  (SUSPENDIDO)' : ''}`, dni(j.dni), '', '', '', ''];
      });
      for (let k = 0; k < 3; k++) filas.push(['', '', '', '', '', '', '']); // renglones libres para agregados
      doc.autoTable({
        startY: y + 3,
        head: [['N.º', 'Apellido y nombre', 'DNI', 'Camiseta', 'Goles', 'A', 'R']],
        body: filas,
        theme: 'grid',
        headStyles: { fillColor: AZUL_2, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 9.5, cellPadding: 1.8, lineColor: [200, 206, 220] },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 26 }, 3: { cellWidth: 20 }, 4: { cellWidth: 16 }, 5: { cellWidth: 10 }, 6: { cellWidth: 10 } },
        didParseCell: (d) => { if (d.section === 'body' && String(d.row.raw[1]).includes('SUSPENDIDO')) d.cell.styles.textColor = [200, 30, 40]; }
      });
      return doc.lastAutoTable.finalY;
    };

    let y = tabla(local, jugL, 56);
    if (y > 200) { doc.addPage(); y = 20; }
    y = tabla(visit, jugV, y + 12);

    if (y > 245) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const firmas = ['Árbitro', `Capitán ${local.nombre}`, `Capitán ${visit.nombre}`];
    const ancho = (W - 20) / 3;
    firmas.forEach((f, i) => {
      const x = 10 + i * ancho;
      doc.line(x + 4, y + 22, x + ancho - 4, y + 22);
      doc.text(f, x + ancho / 2, y + 27, { align: 'center', maxWidth: ancho - 6 });
    });
    doc.text('Observaciones:', 10, y + 38);
    doc.line(10, y + 46, W - 10, y + 46); doc.line(10, y + 54, W - 10, y + 54);

    pie(doc);
    doc.save(`planilla-${nombreArchivo(local.nombre)}-vs-${nombreArchivo(visit.nombre)}${datos.num ? '-fecha-' + datos.num : ''}.pdf`);
  }

  window.PDF = { plantel, planilla };
})();
