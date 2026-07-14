// =====================================================================
// KineApp — Generador de PDF del informe del paciente (jsPDF)
// =====================================================================
// window.generarInformePDF(paciente, ctx) -> descarga un PDF presentable
//   ctx = { etapa, obraSocial, restantes, ultimoTurno }
// =====================================================================

(function () {
  'use strict';

  const C = {
    accent: [37, 99, 235],
    teal:   [13, 148, 136],
    purple: [124, 58, 237],
    green:  [22, 163, 74],
    text:   [26, 35, 50],
    muted:  [100, 116, 139],
    soft:   [241, 245, 249],
    white:  [255, 255, 255],
    line:   [226, 232, 240],
  };

  // Cabecera oscura con logo "kS" (igual que el ícono del PWA). Devuelve la Y donde sigue el contenido.
  function drawHeader(doc, W, M, first) {
    const hh = first ? 112 : 58;
    doc.setFillColor(11, 11, 13); doc.rect(0, 0, W, hh, 'F');   // fondo oscuro (#0b0b0d, igual que el ícono del PWA)
    const cy = first ? 48 : 30;
    const bs = first ? 34 : 26;
    const bx = M, by = cy - bs / 2;
    doc.setFillColor(24, 24, 28); doc.roundedRect(bx, by, bs, bs, 7, 7, 'F');
    doc.setDrawColor(55, 60, 72); doc.setLineWidth(0.8); doc.roundedRect(bx, by, bs, bs, 7, 7, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(first ? 18 : 14);
    const kW2 = doc.getTextWidth('k'), sW2 = doc.getTextWidth('S');
    const startX = bx + bs / 2 - (kW2 + sW2) / 2;
    const kSy = cy + (first ? 6 : 4.5);
    doc.setTextColor(255, 255, 255); doc.text('k', startX, kSy);
    doc.setTextColor(59, 130, 246); doc.text('S', startX + kW2, kSy);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(first ? 22 : 16);
    const lx = bx + bs + 12, ly = cy + (first ? 2 : 1);
    doc.setTextColor(255, 255, 255); doc.text('kinesico', lx, ly);
    const kw = doc.getTextWidth('kinesico');
    doc.setTextColor(59, 130, 246); doc.text('SPORT', lx + kw + 4, ly);
    if (first) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.setTextColor(148, 158, 175);
      doc.text('CENTRO KINESIOLÓGICO', lx + 1, cy + 18);
    }
    return first ? 140 : 84;
  }

  function generarInformePDF(p, ctx) {
    ctx = ctx || {};
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 42;
    let y = 0;

    const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

    // ---- cabecera con logo ----
    function header(first) { y = drawHeader(doc, W, M, first); }

    function ensure(needed) {
      if (y + needed > H - 56) { doc.addPage(); header(false); }
    }

    header(true);

    // ---- título + paciente ----
    doc.setTextColor(...C.text);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('Informe de plan de rehabilitación y progresión', M, y); y += 24;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(21); doc.setTextColor(...C.accent);
    doc.text(p.nombre || 'Paciente', M, y); y += 16;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...C.muted);
    doc.text(`${ctx.etapa || ''} · ${p.servicio || '—'} · ${p.prof || 'Sin profesional'}`, M, y); y += 14;
    doc.text(`Emitido: ${fecha}`, M, y); y += 22;

    // ---- stat boxes ----
    const stats = [
      ['SESIONES REALIZADAS', String(p.sesiones != null ? p.sesiones : 0)],
      ['SESIONES RESTANTES', ctx.restantes != null ? String(ctx.restantes) + (p.sesionesAuth != null ? ` / ${p.sesionesAuth}` : '') : 'Sin tope'],
      ['COBERTURA', ctx.obraSocial ? ctx.obraSocial.nombre : 'Particular'],
    ];
    const gap = 10, bw = (W - 2 * M - 2 * gap) / 3;
    stats.forEach((s, i) => {
      const bx = M + i * (bw + gap);
      doc.setFillColor(...C.soft); doc.roundedRect(bx, y, bw, 48, 7, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...C.accent);
      doc.text(String(s[1]), bx + 12, y + 24, { maxWidth: bw - 20 });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.muted);
      doc.text(s[0], bx + 12, y + 39);
    });
    y += 66;

    // ---- secciones ----
    const sections = [
      { title: 'Datos del paciente', color: C.accent, rows: [
        ['DNI', p.dni || 'No informado'],
        ['Edad', p.edad || 'No informada'],
        ['Teléfono', p.tel || '—'],
        ['Email', p.email || '—'],
        ['Deporte / actividad', p.deporte || '—'],
        ['Profesional', p.prof || 'No asignado'],
        ['Cobertura', ctx.obraSocial ? `${ctx.obraSocial.nombre} (${ctx.obraSocial.cobertura || ''})` : 'Particular'],
      ]},
      { title: 'Evaluación clínica', color: C.teal, rows: [
        ['Motivo de consulta', p.motivo || 'Sin dato'],
        ['Lesión / diagnóstico', p.lesion || 'Sin dato'],
        ['Antecedentes', p.antecedentes || 'Sin antecedentes cargados.'],
        ['Evaluación inicial', p.evaluacion || 'Sin evaluación cargada.'],
      ]},
      { title: 'Plan de rehabilitación', color: C.purple, rows: [
        ['Etapa actual', ctx.etapa || '—'],
        ['Objetivo principal', p.objetivo || 'Sin objetivo definido.'],
        ['Plan', p.planRehab || 'Sin plan cargado.'],
        ['Progresión', p.progresion || 'Sin progresión registrada.'],
        ['Observaciones', p.observaciones || 'Sin observaciones.'],
      ]},
      { title: 'Seguimiento', color: C.green, rows: [
        ['Sesiones realizadas', String(p.sesiones != null ? p.sesiones : 0)],
        ['Sesiones restantes', ctx.restantes != null ? `${ctx.restantes}${p.sesionesAuth != null ? ` de ${p.sesionesAuth}` : ''}` : 'Sin tope'],
        ['Último turno', ctx.ultimoTurno ? `${ctx.ultimoTurno.fecha} ${ctx.ultimoTurno.hora}` : 'Sin turnos registrados'],
      ]},
    ];

    const labelW = 130, valX = M + labelW, valW = W - 2 * M - labelW;
    sections.forEach(sec => {
      ensure(40);
      doc.setFillColor(...sec.color); doc.rect(M, y - 9, 4, 15, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...sec.color);
      doc.text(sec.title.toUpperCase(), M + 12, y + 2); y += 22;

      doc.setFontSize(10);
      sec.rows.forEach(([label, value]) => {
        const lines = doc.splitTextToSize(String(value), valW);
        const rowH = Math.max(17, lines.length * 13 + 5);
        ensure(rowH);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted);
        doc.text(label, M, y + 9, { maxWidth: labelW - 8 });
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text);
        doc.text(lines, valX, y + 9);
        // separador suave
        doc.setDrawColor(...C.line); doc.setLineWidth(0.5);
        doc.line(M, y + rowH - 4, W - M, y + rowH - 4);
        y += rowH;
      });
      y += 14;
    });

    // ---- pie de página en todas las hojas ----
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 160, 172);
      doc.text('Informe generado desde KineApp', M, H - 26);
      doc.text(`Página ${i} de ${total}`, W - M, H - 26, { align: 'right' });
    }

    const safe = (p.nombre || 'paciente').replace(/[^\wáéíóúñ ]/gi, '').trim();
    const filename = `Informe - ${safe}.pdf`;
    // ctx.output === 'blob' -> devolvemos el PDF como Blob (para compartirlo como archivo por WhatsApp/etc.)
    if (ctx.output === 'blob') return { blob: doc.output('blob'), filename };
    doc.save(filename);
  }

  // =====================================================================
  // PDF de la rutina de ejercicios (misma cabecera oscura + logo kS).
  //   ctx = { bloques: [{ semanaLabel, dias: [{ diaLabel, texto }] }],
  //           scopeLabel, output }
  // =====================================================================
  function generarRutinaPDF(p, ctx) {
    ctx = ctx || {};
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 42;
    let y = drawHeader(doc, W, M, true);
    const ensure = (needed) => { if (y + needed > H - 56) { doc.addPage(); y = drawHeader(doc, W, M, false); } };
    const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

    // ---- título + paciente ----
    doc.setTextColor(...C.text); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('Rutina de ejercicios', M, y); y += 24;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(21); doc.setTextColor(...C.accent);
    doc.text(p.nombre || 'Paciente', M, y); y += 16;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...C.muted);
    const sub = [ctx.scopeLabel, p.servicio, p.prof].filter(Boolean).join(' · ');
    if (sub) { doc.text(sub, M, y); y += 14; }
    doc.text(`Emitida: ${fecha}`, M, y); y += 24;

    // ---- bloques (semanas / días) ----
    const bloques = Array.isArray(ctx.bloques) ? ctx.bloques : [];
    const textW = W - 2 * M;
    let algo = false;
    bloques.forEach(bloque => {
      const dias = (bloque.dias || []).filter(d => (d.texto || '').trim());
      if (!dias.length) return;
      algo = true;
      if (bloque.semanaLabel) {
        ensure(30);
        doc.setFillColor(...C.accent); doc.rect(M, y - 10, 4, 16, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...C.accent);
        doc.text(String(bloque.semanaLabel).toUpperCase(), M + 12, y + 2); y += 20;
      }
      dias.forEach(d => {
        const lines = doc.splitTextToSize((d.texto || '').trim(), textW - 8);
        ensure((d.diaLabel ? 18 : 0) + lines.length * 14 + 14);
        if (d.diaLabel) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...C.text);
          doc.text(String(d.diaLabel), M + 4, y + 4); y += 15;
        }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...C.text);
        doc.text(lines, M + 8, y + 4); y += lines.length * 14 + 12;
      });
      y += 6;
    });
    if (!algo) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...C.muted);
      doc.text('Sin ejercicios cargados.', M, y);
    }

    // ---- pie de página ----
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 160, 172);
      doc.text('Rutina generada desde KineApp', M, H - 26);
      doc.text(`Página ${i} de ${total}`, W - M, H - 26, { align: 'right' });
    }

    const safe = (p.nombre || 'paciente').replace(/[^\wáéíóúñ ]/gi, '').trim();
    const scopeSafe = (ctx.scopeLabel || '').replace(/[·]/g, '-').replace(/[^\wáéíóúñ -]/gi, '').replace(/\s+/g, ' ').trim();
    const filename = `Rutina${scopeSafe ? ' ' + scopeSafe : ''} - ${safe}.pdf`;
    if (ctx.output === 'blob') return { blob: doc.output('blob'), filename };
    doc.save(filename);
  }

  window.generarInformePDF = generarInformePDF;
  window.generarRutinaPDF = generarRutinaPDF;
})();
