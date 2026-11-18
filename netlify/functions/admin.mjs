import { getStore } from '@netlify/blobs';
import { timingSafeEqual, createHash } from 'node:crypto';
import { CRITERIOS, AJUSTES_POR_DEFECTO, puntuar } from '../../lib/score.js';

const ESTADOS = ['Nuevo', 'Contactado', 'Visita agendada', 'Elegido', 'Descartado'];
const json = (obj, status = 200) => Response.json(obj, { status, headers: { 'Cache-Control': 'no-store' } });

function esAdmin(req) {
  const esperado = process.env.ADMIN_PASSWORD || '';
  if (!esperado) return false;
  const h = s => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(esperado), h(req.headers.get('x-admin-password') || ''));
}

async function leerAjustes(store) {
  const a = (await store.get('ajustes', { type: 'json' })) || {};
  return { ...AJUSTES_POR_DEFECTO, ...a, pesos: { ...AJUSTES_POR_DEFECTO.pesos, ...(a.pesos || {}) } };
}

export default async (req) => {
  if (!process.env.ADMIN_PASSWORD) return json({ error: 'Falta configurar ADMIN_PASSWORD en Netlify.' }, 500);
  if (!esAdmin(req)) return json({ error: 'Contraseña incorrecta.' }, 401);

  try {
    const store = getStore({ name: 'postulantes', consistency: 'strong' });

    if (req.method === 'GET') {
      const aj = await leerAjustes(store);
      const { blobs } = await store.list({ prefix: 'p/' });
      const items = await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })));
      const lista = items.filter(Boolean)
        .map(it => ({ ...it, ...puntuar(it.datos, aj) }))
        .sort((a, b) => b.fecha - a.fecha);
      return json({ ajustes: aj, criterios: CRITERIOS, estados: ESTADOS, lista });
    }

    const cuerpo = await req.json().catch(() => ({}));

    if (req.method === 'PUT') {
      const a = cuerpo.ajustes || {};
      const pesos = {};
      for (const c of CRITERIOS) pesos[c.k] = Math.max(0, Math.min(100, Number(a.pesos?.[c.k]) || 0));
      await store.setJSON('ajustes', {
        alquiler: Math.max(0, Number(a.alquiler) || 0),
        umbralA: Math.max(0, Math.min(100, Number(a.umbralA) || 0)),
        umbralB: Math.max(0, Math.min(100, Number(a.umbralB) || 0)),
        pesos
      });
      return json({ ok: true });
    }

    const id = String(cuerpo.id || '').replace(/[^a-f0-9-]/gi, '');
    if (!id) return json({ error: 'Falta el id.' }, 400);

    if (req.method === 'PATCH') {
      const it = await store.get('p/' + id, { type: 'json' });
      if (!it) return json({ error: 'No existe.' }, 404);
      if (ESTADOS.includes(cuerpo.estado)) it.estado = cuerpo.estado;
      if (typeof cuerpo.nota === 'string') it.nota = cuerpo.nota.slice(0, 2000);
      await store.setJSON('p/' + id, it);
      return json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await store.delete('p/' + id);
      return json({ ok: true });
    }

    return json({ error: 'Método no permitido' }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: e.message || 'Error del servidor' }, 500);
  }
};

export const config = { path: '/api/admin' };
