// =====================================================================
// Tests de la lógica pura (plata / sesiones / sincronización)
// =====================================================================
// Correr con:  node test/logic.test.js   (desde la carpeta del repo)
// No usa dependencias ni package.json (para no tocar el deploy estático).
// =====================================================================
const assert = require('assert');
const L = require('../assets/js/logic.js');

let pass = 0, fail = 0; const fails = [];
function test(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; fails.push(name + '  ->  ' + e.message); }
}
const eq = (a, b, msg) => assert.strictEqual(a, b, msg);

// ---------- PACK_SESIONES ----------
test('PACK_SESIONES mapea los packs conocidos', () => {
  eq(L.PACK_SESIONES['Por sesión'], 1);
  eq(L.PACK_SESIONES['Pack 10 sesiones'], 10);
  eq(L.PACK_SESIONES['Pack 20 sesiones'], 20);
});

// ---------- coseguroDePack ----------
test('coseguroDePack: usa el valor directo del pack', () => {
  eq(L.coseguroDePack({ 'Pack 10 sesiones': 45000 }, 'Pack 10 sesiones'), 45000);
});
test('coseguroDePack: fallback por sesión × N', () => {
  eq(L.coseguroDePack({ 'Por sesión': 5000 }, 'Pack 10 sesiones'), 50000);
});
test('coseguroDePack: el directo tiene prioridad sobre el fallback', () => {
  eq(L.coseguroDePack({ 'Por sesión': 5000, 'Pack 10 sesiones': 40000 }, 'Pack 10 sesiones'), 40000);
});
test('coseguroDePack: sin datos -> 0', () => {
  eq(L.coseguroDePack(null, 'Pack 10 sesiones'), 0);
  eq(L.coseguroDePack({}, 'Por sesión'), 0);
});
test('coseguroDePack: pack directo en 0 cae al fallback', () => {
  eq(L.coseguroDePack({ 'Por sesión': 5000, 'Pack 10 sesiones': 0 }, 'Pack 10 sesiones'), 50000);
});

// ---------- precioDePack ----------
test('precioDePack: tarifa directa', () => {
  eq(L.precioDePack('Pack 10 sesiones', 45000, 5000), 45000);
});
test('precioDePack: fallback por sesión × N', () => {
  eq(L.precioDePack('Pack 10 sesiones', 0, 5000), 50000);
});
test('precioDePack: pack desconocido usa N=1', () => {
  eq(L.precioDePack('Pack inventado', 0, 5000), 5000);
});

// ---------- deudaEstado ----------
test('deudaEstado: deuda > 0 -> pendiente', () => {
  eq(L.deudaEstado(1), 'pendiente');
  eq(L.deudaEstado(15000), 'pendiente');
});
test('deudaEstado: deuda 0 o negativa -> pagado', () => {
  eq(L.deudaEstado(0), 'pagado');
  eq(L.deudaEstado(-5), 'pagado');
});

// ---------- clampCounter ----------
test('clampCounter: suma normal', () => { eq(L.clampCounter(3, 1), 4); eq(L.clampCounter(0, 1), 1); });
test('clampCounter: nunca baja de 0', () => { eq(L.clampCounter(0, -1), 0); eq(L.clampCounter(2, -5), 0); });
test('clampCounter: current nulo cuenta como 0', () => { eq(L.clampCounter(null, 1), 1); eq(L.clampCounter(undefined, 3), 3); });
test('clampCounter: resta de deuda', () => { eq(L.clampCounter(10000, -4000), 6000); eq(L.clampCounter(4000, -4000), 0); });

// ---------- syncDecision (anti lost-update) ----------
test('syncDecision: fila nueva -> insert', () => {
  eq(L.syncDecision(false, null, null), 'insert');
  eq(L.syncDecision(false, 100, 200), 'insert');
});
test('syncDecision: existe y no se editó local -> skip', () => {
  eq(L.syncDecision(true, null, 500), 'skip');
});
test('syncDecision: edición local más nueva -> update', () => {
  eq(L.syncDecision(true, 900, 500), 'update');
});
test('syncDecision: nube sin timestamp -> update', () => {
  eq(L.syncDecision(true, 900, null), 'update');
});
test('syncDecision: la nube tiene algo más nuevo -> conflict (no pisa)', () => {
  eq(L.syncDecision(true, 500, 900), 'conflict');
});
test('syncDecision: empate de timestamps -> conflict (no pisa)', () => {
  eq(L.syncDecision(true, 500, 500), 'conflict');
});

// ---------- resumen ----------
console.log(`\n${pass} pasaron, ${fail} fallaron`);
if (fail) { console.error('\nFALLAS:\n- ' + fails.join('\n- ') + '\n'); process.exit(1); }
console.log('✓ Todos los tests de lógica OK\n');
