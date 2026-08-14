// Keepalive (Vercel Cron → vercel.json). Le pega a la API REST de Supabase cada
// pocos días para que el proyecto FREE no se pause por inactividad (que es lo que
// deja la base "offline / restoration in progress"). No toca ni cambia datos:
// solo hace un SELECT mínimo que cuenta como actividad.
//
// La anon key es pública por diseño (ya va en el frontend), así que se puede dejar
// como fallback; si querés, la movés a la env var SUPABASE_ANON_KEY en Vercel.
export default async function handler(req, res) {
  const key = process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2dHljeHN2dGxsc251anV4Z2piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTgyMDcsImV4cCI6MjA5NzM5NDIwN30.HqnkQqmifqCo-RrgxqeeSqJ7mBiy8gEA6xnjHuKezLU';
  const base = process.env.SUPABASE_URL || 'https://evtycxsvtllsnujuxgjb.supabase.co';
  const url = `${base}/rest/v1/pacientes?select=id&limit=1`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    res.status(200).json({ ok: r.ok, supabase_status: r.status, ts: new Date().toISOString() });
  } catch (err) {
    const reason = err && err.name === 'AbortError' ? 'timeout' : 'fetch_failed';
    res.status(502).json({ ok: false, error: reason });
  } finally {
    clearTimeout(timeout);
  }
}
