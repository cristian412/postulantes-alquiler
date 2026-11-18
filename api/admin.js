import { db, CLAVES, esAdmin, leerCuerpo } from '../lib/db.js';
import { CRITERIOS, AJUSTES_POR_DEFECTO, puntuar } from '../lib/score.js';

const ESTADOS = ['Nuevo', 'Contactado', 'Visita agendada', 'Elegido', 'Descartado'];

async function leerAjustes(r) {
  const a = (await r.get(CLAVES.ajustes)) || {};
  return {
    ...AJUSTES_POR_DEFECTO, ...a,
    pesos: { ...AJUSTES_POR_DEFECTO.pesos, ...(a.pesos || {}) }
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'Falta configurar ADMIN_PASSWORD en Vercel.' });
  if (!esAdmin(req)) return res.status(401).json({ error: 'Contraseña incorrecta.' });

  try {
    const r = db();

    if (req.method === 'GET') {
      const aj = await leerAjustes(r);
      const ids = await r.zrange(CLAVES.lista, 0, -1, { rev: true });
      const items = ids.length ? await r.mget(...ids.map(CLAVES.item)) : [];
      const lista = items.filter(Boolean).map(it => ({ ...it, ...puntuar(it.datos, aj) }));
      return res.status(200).json({ ajustes: aj, criterios: CRITERIOS, estados: ESTADOS, lista });
    }

    const cuerpo = await leerCuerpo(req);

    if (req.method === 'PUT') { // guardar ponderación
      const a = cuerpo.ajustes || {};
      const pesos = {};
      for (const c of CRITERIOS) pesos[c.k] = Math.max(0, Math.min(100, Number(a.pesos?.[c.k]) || 0));
      const nuevo = {
        alquiler: Math.max(0, Number(a.alquiler) || 0),
        umbralA: Math.max(0, Math.min(100, Number(a.umbralA) || 0)),
        umbralB: Math.max(0, Math.min(100, Number(a.umbralB) || 0)),
        pesos
      };
      await r.set(CLAVES.ajustes, nuevo);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PATCH') { // cambiar estado o nota
      const it = await r.get(CLAVES.item(String(cuerpo.id)));
      if (!it) return res.status(404).json({ error: 'No existe.' });
      if (ESTADOS.includes(cuerpo.estado)) it.estado = cuerpo.estado;
      if (typeof cuerpo.nota === 'string') it.nota = cuerpo.nota.slice(0, 2000);
      await r.set(CLAVES.item(it.id), it);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = String(cuerpo.id);
      await r.del(CLAVES.item(id));
      await r.zrem(CLAVES.lista, id);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Error del servidor' });
  }
}
