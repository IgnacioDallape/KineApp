// =====================================================================
// KineApp — Lógica pura (plata / sesiones / sincronización)
// =====================================================================
// Funciones SIN efectos (no tocan DOM, red ni el store). Son la ÚNICA fuente
// de verdad de estas reglas y están cubiertas por tests (test/logic.test.js).
// Se usan tanto en el navegador (window.KineLogic) como en Node (require).
//
// ⚠️ Si cambiás una regla acá, actualizá el test correspondiente.
// =====================================================================
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // Node (tests)
  if (typeof window !== 'undefined') window.KineLogic = api;                    // navegador
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Cantidad de sesiones que representa cada pack (para derivar precio/coseguro
  // "por sesión" × N cuando no se cargó el valor directo del pack).
  const PACK_SESIONES = {
    'Por sesión': 1, 'Pack 4 sesiones': 4, 'Pack 5 sesiones': 5, 'Pack 6 sesiones': 6,
    'Pack 8 sesiones': 8, 'Pack 10 sesiones': 10, 'Pack 12 sesiones': 12,
    'Pack 15 sesiones': 15, 'Pack 20 sesiones': 20,
  };

  // Coseguro (lo que paga el paciente) de un pack. Directo si está cargado (>0);
  // si no, coseguro "Por sesión" × cantidad de sesiones del pack.
  function coseguroDePack(cubre, concepto) {
    const c = cubre || {};
    if (c[concepto] > 0) return c[concepto];
    return (c['Por sesión'] || 0) * (PACK_SESIONES[concepto] || 1);
  }

  // Precio de un pack. Directo si está cargado (>0); si no, precio "Por sesión" × N.
  function precioDePack(concepto, tarifaDirecta, tarifaPorSesion) {
    if (tarifaDirecta > 0) return tarifaDirecta;
    return (tarifaPorSesion || 0) * (PACK_SESIONES[concepto] || 1);
  }

  // Estado de cuenta derivado de la deuda. Regla única usada en cobros/pagos y en
  // la función SQL kine_ajustar_deuda. Debe coincidir con esa función.
  function deudaEstado(deuda) { return (deuda > 0) ? 'pendiente' : 'pagado'; }

  // Suma/resta de un contador que nunca baja de 0 (sesiones, deuda). Igual que la
  // lógica de kine_ajustar_* y de los fallbacks de store.js.
  function clampCounter(current, delta) { return Math.max(0, (Number(current) || 0) + (Number(delta) || 0)); }

  // Decisión al subir una fila local a la nube (anti "lost update"). Nunca pisa lo
  // más nuevo de la nube.
  //   existsInCloud: ¿la fila ya está en la nube?
  //   localTs / cloudTs: timestamps en ms, o null si no se conocen.
  //   -> 'insert'  (no existe: se agrega)
  //      'skip'    (existe y no se editó local: no se toca)
  //      'update'  (edición local más nueva: se sube)
  //      'conflict'(la nube tiene algo más nuevo: NO se pisa)
  function syncDecision(existsInCloud, localTs, cloudTs) {
    if (!existsInCloud) return 'insert';
    if (localTs == null) return 'skip';
    if (cloudTs == null || localTs > cloudTs) return 'update';
    return 'conflict';
  }

  return { PACK_SESIONES, coseguroDePack, precioDePack, deudaEstado, clampCounter, syncDecision };
});
