import { Redis } from '@upstash/redis';
import { timingSafeEqual, createHash } from 'node:crypto';

let cliente;
export function db() {
  if (!cliente) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('Falta conectar la base de datos (Upstash Redis) en Vercel → Storage.');
    cliente = new Redis({ url, token });
  }
  return cliente;
}

export const CLAVES = {
  lista: 'postulantes:ids',            // sorted set: id → timestamp
  item: id => 'postulante:' + id,      // JSON de cada postulación
  ajustes: 'ajustes'
};

export function esAdmin(req) {
  const esperado = process.env.ADMIN_PASSWORD || '';
  const dado = String(req.headers['x-admin-password'] || '');
  if (!esperado) return false;
  const h = s => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(esperado), h(dado));
}

export async function leerCuerpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const partes = [];
  for await (const p of req) partes.push(p);
  return JSON.parse(Buffer.concat(partes).toString() || '{}');
}
