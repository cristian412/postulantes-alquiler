import { randomUUID } from 'node:crypto';
import { db, CLAVES, leerCuerpo } from '../lib/db.js';
import { CAMPOS } from '../lib/score.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const cuerpo = await leerCuerpo(req);
    if (cuerpo.sitio) return res.status(200).json({ ok: true }); // trampa anti-spam

    const d = {};
    for (const k of CAMPOS) {
      if (cuerpo[k] !== undefined && cuerpo[k] !== null) d[k] = String(cuerpo[k]).trim().slice(0, 1000);
    }
    for (const k of ['nombre', 'apellido', 'ci', 'celular', 'ocupacion', 'personas', 'ingreso']) {
      if (!d[k]) return res.status(400).json({ error: 'Falta completar un campo obligatorio.' });
    }
    if (d.aceptaReglas !== 'Sí' || d.autorizaDatos !== 'Sí') {
      return res.status(400).json({ error: 'Es necesario aceptar las reglas y la autorización.' });
    }

    const r = db();
    // límite: 5 envíos por hora por IP
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
    const kIp = 'limite:' + ip;
    const n = await r.incr(kIp);
    if (n === 1) await r.expire(kIp, 3600);
    if (n > 5) return res.status(429).json({ error: 'Demasiados envíos. Probá más tarde.' });

    const id = randomUUID();
    const ahora = Date.now();
    await r.set(CLAVES.item(id), { id, fecha: ahora, estado: 'Nuevo', nota: '', datos: d });
    await r.zadd(CLAVES.lista, { score: ahora, member: id });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'No se pudo guardar. Probá de nuevo en un momento.' });
  }
}
