import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';
import { CAMPOS } from '../../lib/score.js';

const json = (obj, status = 200) => Response.json(obj, { status });

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const cuerpo = await req.json().catch(() => ({}));
    if (cuerpo.sitio) return json({ ok: true }); // trampa anti-spam

    const d = {};
    for (const k of CAMPOS) {
      if (cuerpo[k] !== undefined && cuerpo[k] !== null) d[k] = String(cuerpo[k]).trim().slice(0, 1000);
    }
    for (const k of ['nombre', 'apellido', 'ci', 'celular', 'ocupacion', 'personas', 'ingreso']) {
      if (!d[k]) return json({ error: 'Falta completar un campo obligatorio.' }, 400);
    }
    if (d.aceptaReglas !== 'Sí' || d.autorizaDatos !== 'Sí') {
      return json({ error: 'Es necesario aceptar las reglas y la autorización.' }, 400);
    }

    const store = getStore({ name: 'postulantes', consistency: 'strong' });

    // límite: 5 envíos por hora por IP
    const ip = (context?.ip || 'x').replace(/[^0-9a-fA-F:.]/g, '');
    const hora = Math.floor(Date.now() / 3600000);
    const kIp = `limite/${hora}/${ip}`;
    const n = ((await store.get(kIp, { type: 'json' })) || 0) + 1;
    if (n > 5) return json({ error: 'Demasiados envíos. Probá más tarde.' }, 429);
    await store.setJSON(kIp, n);

    const id = randomUUID();
    const fecha = Date.now();
    await store.setJSON('p/' + id, { id, fecha, estado: 'Nuevo', nota: '', datos: d });
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: 'No se pudo guardar. Probá de nuevo en un momento.' }, 500);
  }
};

export const config = { path: '/api/postular' };
