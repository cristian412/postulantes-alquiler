// Reglas y ponderación de postulantes (compartido por la API)

export const CRITERIOS = [
  { k: 'ingreso',    nombre: 'Ingresos vs. alquiler', peso: 25, como: 'Ingreso total ÷ alquiler: 3 veces o más = 100%, 2,5 = 80%, 2 = 50%, 1,5 = 20%' },
  { k: 'ocupacion',  nombre: 'Trabaja / estudia',     peso: 15, como: 'Trabaja = 100%, solo estudia = 60%, ninguna = 0%. Si son dos, se promedia' },
  { k: 'ips',        nombre: 'Tiene IPS',             peso: 15, como: 'Con IPS = 100%, sin IPS = 0%, solo estudia = 50%' },
  { k: 'personas',   nombre: 'Sola o en pareja',      peso: 10, como: 'Sola o pareja = 100%, 2 que no son pareja = 50%, 3 o más = 0%' },
  { k: 'visitas',    nombre: 'Pocas visitas',         peso: 10, como: 'Casi nunca = 100%, de vez en cuando = 60%, seguido = 0%' },
  { k: 'ruido',      nombre: 'Tranquilidad (ruido)',  peso: 10, como: 'No = 100%, a veces bajo = 60%, seguido = 0%' },
  { k: 'hijos',      nombre: 'Sin hijos',             peso: 5,  como: 'Sin hijos = 100%' },
  { k: 'mascotas',   nombre: 'Sin mascotas',          peso: 3,  como: 'Sin mascotas = 100%' },
  { k: 'fuma',       nombre: 'No fuma',               peso: 0,  como: 'No = 100%, afuera = 60%, sí = 0%' },
  { k: 'antiguedad', nombre: 'Antigüedad laboral',    peso: 0,  como: '2 años o más = 100%, 1 año = 60%, menos = 20%' }
];

export const AJUSTES_POR_DEFECTO = {
  alquiler: 2500000,
  umbralA: 80,
  umbralB: 60,
  pesos: Object.fromEntries(CRITERIOS.map(c => [c.k, c.peso]))
};

const num = s => parseInt(String(s ?? '').replace(/\D/g, ''), 10) || 0;
const trabaja = o => /trabaja/i.test(o || '');
const estudia = o => /estudia/i.test(o || '');

export function evaluar(d) {
  const obs = [];
  const p = parseInt(d.personas, 10) || 0;
  if (p > 2) obs.push('más de 2 personas');
  if (p === 2 && d.convivencia && d.convivencia !== 'En pareja') obs.push('no es pareja');
  if (d.ocupacion === 'Otro / sin ocupación') obs.push('no trabaja ni estudia');
  if (d.hijos === 'Sí') obs.push('tiene hijos');
  if (d.visitas === 'Frecuentemente') obs.push('recibe visitas seguido');
  if (d.ruido === 'Sí, con frecuencia') obs.push('música fuerte frecuente');
  if (d.mascotas === 'Sí') obs.push('tiene mascota');
  if (d.ips === 'No' && trabaja(d.ocupacion)) obs.push('trabaja sin IPS');
  return obs;
}

function fracciones(d, alquiler) {
  const dos = (parseInt(d.personas, 10) || 1) >= 2 && d.parejaOcupacion;
  const ocupVal = o => trabaja(o) ? 1 : estudia(o) ? 0.6 : 0;
  const total = num(d.ingresoTotal) || num(d.ingreso) + num(d.parejaIngreso);
  const r = alquiler > 0 ? total / alquiler : null;

  let ips = trabaja(d.ocupacion) ? (d.ips === 'Sí' ? 1 : 0) : estudia(d.ocupacion) ? 0.5 : 0;
  if (dos && trabaja(d.parejaOcupacion)) ips = (ips + (d.parejaIps === 'Sí' ? 1 : 0)) / 2;

  const p = parseInt(d.personas, 10) || 0;
  const ant = String(d.trabajoAntiguedad || '').toLowerCase();
  const anios = /a[ñn]o/.test(ant) ? (parseFloat(ant.replace(',', '.')) || 1)
    : /mes/.test(ant) ? (parseFloat(ant) || 0) / 12 : null;
  const refs = (String(d.ref1 || '').trim() ? 1 : 0) + (String(d.ref2 || '').trim() ? 1 : 0);

  return {
    ingreso: r === null ? null : r >= 3 ? 1 : r >= 2.5 ? 0.8 : r >= 2 ? 0.5 : r >= 1.5 ? 0.2 : 0,
    ocupacion: dos ? (ocupVal(d.ocupacion) + ocupVal(d.parejaOcupacion)) / 2 : ocupVal(d.ocupacion),
    ips,
    personas: p <= 1 ? 1 : p === 2 ? (d.convivencia === 'En pareja' ? 1 : 0.5) : 0,
    visitas: { 'Casi nunca': 1, 'Ocasionalmente': 0.6 }[d.visitas] ?? 0,
    ruido: { 'No': 1, 'A veces, volumen moderado': 0.6 }[d.ruido] ?? 0,
    garante: { 'Sí': 1, 'Puedo conseguir': 0.5 }[d.garante] ?? 0,
    hijos: d.hijos === 'Sí' ? 0 : 1,
    mascotas: d.mascotas === 'Sí' ? 0 : 1,
    referencias: refs / 2,
    fuma: { 'No': 1, 'Sí, fuera del departamento': 0.6 }[d.fuma] ?? 0,
    antiguedad: !trabaja(d.ocupacion) ? 0 : anios === null ? 0.2 : anios >= 2 ? 1 : anios >= 1 ? 0.6 : 0.2
  };
}

export function puntuar(d, aj) {
  const fr = fracciones(d, Number(aj.alquiler) || 0);
  let suma = 0, max = 0;
  const detalle = [];
  for (const c of CRITERIOS) {
    const peso = Number(aj.pesos?.[c.k] ?? c.peso) || 0;
    if (!peso || fr[c.k] === null) continue;
    const pts = fr[c.k] * peso;
    suma += pts; max += peso;
    detalle.push({ nombre: c.nombre, pts: Math.round(pts * 10) / 10, peso });
  }
  const puntaje = max ? Math.round((suma / max) * 100) : 0;
  const obs = evaluar(d);
  const categoria = puntaje >= aj.umbralA && obs.length === 0 ? 'A' : puntaje >= aj.umbralB ? 'B' : 'C';
  return { puntaje, categoria, obs, detalle };
}

export const CAMPOS = [
  'nombre','apellido','ci','nacimiento','nacionalidad','estadoCivil','celular','email','domicilio','motivo',
  'ocupacion','ips','trabajoLugar','trabajoCargo','trabajoAntiguedad','trabajoHorario','trabajoTelefono',
  'estudioLugar','estudioHorario','ingreso','personas','convivencia','parejaNombre','parejaCi','parejaCelular',
  'parejaOcupacion','parejaIps','parejaTrabajo','parejaHorario','parejaIngreso','ingresoTotal','hijos','hijosDetalle',
  'mascotas','mascotasDetalle','vehiculo','vehiculoDetalle','visitas','fuma','ruido','mudanza','plazo','garante',
  'ref1','ref2','canal','comentarios','aceptaReglas','autorizaDatos'
];
