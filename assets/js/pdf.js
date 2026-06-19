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
    function header(first) {
      const hh = first ? 112 : 58;
      doc.setFillColor(...C.accent); doc.rect(0, 0, W, hh, 'F');
      const cy = first ? 48 : 30;
      // badge: círculo blanco con cruz médica azul
      doc.setFillColor(...C.white); doc.circle(M + 16, cy, 16, 'F');
      doc.setFillColor(...C.accent);
      doc.rect(M + 13, cy - 9, 6, 18, 'F');
      doc.rect(M + 7, cy - 3, 18, 6, 'F');
      // wordmark "kinesico SPORT"
      doc.setFont('helvetica', 'bold'); doc.setFontSize(first ? 22 : 16);
      const lx = M + 42, ly = cy + (first ? 2 : 1);
      doc.setTextColor(...C.white); doc.text('kinesico', lx, ly);
      const kw = doc.getTextWidth('kinesico');
      doc.setTextColor(147, 197, 253); doc.text('SPORT', lx + kw + 4, ly);
      if (first) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        doc.setTextColor(219, 234, 254);
        doc.text('CENTRO KINESIOLÓGICO', M + 43, cy + 18);
      }
      y = first ? 140 : 84;
    }

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
    doc.save(`Informe - ${safe}.pdf`);
  }

  window.generarInformePDF = generarInformePDF;
})();
