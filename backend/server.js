// EVAP: cargar el .env del backend, no el de la carpeta de la terminal.
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const dotenv = require('dotenv');
const RUTA_ENV = path.join(__dirname, '.env');
const CLAVES_CONFIGURACION = [
  'PLANTA_ID', 'DB_HOST', 'DB_PORT', 'DB_NAME',
  'DB_USER', 'DB_PASSWORD', 'PORT', 'EVAP_ADMIN_INICIAL_PASSWORD', 'EVAP_CORS_ORIGENES'
];

// Conservar los valores previos para detectar conflictos sin sobrescribirlos.
const entornoPrevio = {};
for (const clave of CLAVES_CONFIGURACION) {
  if (Object.prototype.hasOwnProperty.call(process.env, clave)) {
    entornoPrevio[clave] = process.env[clave];
  }
}

const resultadoEnv = dotenv.config({
  path: RUTA_ENV,
  encoding: 'utf8',
  quiet: true,
  override: false
});

if (resultadoEnv.error) {
  throw new Error(
    `No se pudo leer el archivo ${RUTA_ENV} ` +
    `(${resultadoEnv.error.code || 'ERROR_LECTURA'}). ` +
    'Comprueba que exista junto a server.js, que se llame .env (no .env.txt) ' +
    'y que tengas permiso para leerlo.'
  );
}

const valoresArchivo = resultadoEnv.parsed || {};
const PLANTAS_VALIDAS = { MAQ: 'Maquehua', ROS: 'Rosario' };
const PLANTA_ID = String(process.env.PLANTA_ID || '').trim().toUpperCase();

// Diagnostico limitado: nunca imprimir process.env ni el objeto parsed completo.
console.log(`[EVAP] Archivo .env: ${RUTA_ENV}`);
console.log(`[EVAP] PLANTA_ID archivo: ${JSON.stringify(valoresArchivo.PLANTA_ID ?? null)}`);
console.log(`[EVAP] PLANTA_ID efectivo: ${JSON.stringify(PLANTA_ID)}`);

const valorComparable = (clave, valor) => clave === 'PLANTA_ID'
  ? String(valor).trim().toUpperCase()
  : String(valor);
const conflictos = CLAVES_CONFIGURACION.filter(clave =>
  Object.prototype.hasOwnProperty.call(entornoPrevio, clave) &&
  Object.prototype.hasOwnProperty.call(valoresArchivo, clave) &&
  valorComparable(clave, entornoPrevio[clave]) !== valorComparable(clave, valoresArchivo[clave])
);

if (conflictos.length) {
  throw new Error(
    `Conflicto entre las variables de la terminal/sistema y ${RUTA_ENV}: ` +
    `${conflictos.join(', ')}. ` +
    'No se sobrescribieron automaticamente. Corrige la variable indicada ' +
    'en la terminal o en .env para usar la planta y la base deseadas. ' +
    'No se ha conectado a PostgreSQL.'
  );
}

if (!Object.prototype.hasOwnProperty.call(PLANTAS_VALIDAS, PLANTA_ID)) {
  throw new Error(
    `PLANTA_ID debe ser MAQ o ROS. Revisa el archivo ${RUTA_ENV}, ` +
    'guardalo y vuelve a ejecutar. Los valores leidos aparecen arriba. ' +
    'No se ha conectado a PostgreSQL.'
  );
}
for (const variable of ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD']) {
  if (!process.env[variable]) {
    throw new Error(`Falta configurar ${variable} en ${RUTA_ENV}`);
  }
}
const PLANTA_NOMBRE = PLANTAS_VALIDAS[PLANTA_ID];

console.log(`[EVAP] Planta: ${PLANTA_NOMBRE} (${PLANTA_ID})`);
console.log(`[EVAP] DB_HOST: ${process.env.DB_HOST}`);
console.log(`[EVAP] DB_NAME: ${process.env.DB_NAME}`);

// Comprobacion local: finaliza antes de cargar Express/pg y de inicializar la BD.
if (process.argv.includes('--verificar-config')) {
  console.log('OK: configuracion valida. No se conecto a PostgreSQL ni se inicio la API.');
  process.exit(0);
}

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
// Optativo: restringir los origenes web por planta sin cambiar React.
// Si no se configura, conserva el CORS abierto de la version de pruebas.
const origenesCors = String(process.env.EVAP_CORS_ORIGENES || '').split(',').map(x => x.trim()).filter(Boolean);
app.use(cors(origenesCors.length ? {
  origin: (origin, callback) => callback(null, !origin || origenesCors.includes(origin))
} : undefined));
app.use(express.json({ limit: '12mb' }));
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
// Seguridad basica de usuarios: no requiere tokens ni cambios en el frontend.
// Las claves antiguas (texto plano) se convierten automaticamente despues de un login correcto.
const scryptAsync = promisify(crypto.scrypt);
const FORMATO_CLAVE = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
async function protegerClave(clave) {
  const sal = crypto.randomBytes(16).toString('hex');
  const claveDerivada = await scryptAsync(clave, Buffer.from(sal, 'hex'), 64);
  return `scrypt$${sal}$${claveDerivada.toString('hex')}`;
}
async function verificarClave(clave, valorGuardado) {
  if (typeof valorGuardado !== 'string') return { valido: false, antigua: false };
  const coincidencia = valorGuardado.match(FORMATO_CLAVE);
  if (coincidencia) {
    const actual = Buffer.from(coincidencia[2], 'hex');
    const calculado = await scryptAsync(clave, Buffer.from(coincidencia[1], 'hex'), actual.length);
    return { valido: crypto.timingSafeEqual(actual, calculado), antigua: false };
  }
  // No tratar como texto plano un valor con prefijo de hash malformado.
  if (valorGuardado.startsWith('scrypt$')) return { valido: false, antigua: false };
  const antigua = Buffer.from(valorGuardado, 'utf8');
  const ingresada = Buffer.from(clave, 'utf8');
  return { valido: antigua.length === ingresada.length && crypto.timingSafeEqual(antigua, ingresada), antigua: true };
}
const ROLES_VALIDOS = new Set(['admin', 'gerencia', 'qc', 'qc_avanzado']);
function validarDatosCuenta(username, role, permisos, password, requierePassword) {
  if (typeof username !== 'string' || !username.trim() || username.trim().length > 100)
    return 'El nombre de usuario es obligatorio (maximo 100 caracteres).';
  if (!ROLES_VALIDOS.has(role || 'qc')) return 'El rol seleccionado no es valido.';
  if (permisos != null && (typeof permisos !== 'object' || Array.isArray(permisos)))
    return 'Los permisos del usuario no tienen un formato valido.';
  if (requierePassword || (typeof password === 'string' && password.trim())) {
    if (typeof password !== 'string' || password.trim().length < 8 || password.trim().length > 128)
      return 'La contrasena debe tener entre 8 y 128 caracteres.';
  }
  return null;
}
const intentosLogin = new Map();
const VENTANA_LOGIN_MS = 15 * 60 * 1000;
const MAX_FALLOS_LOGIN = 8;
function obtenerRegistroLogin(clave) {
  const registro = intentosLogin.get(clave);
  if (!registro || Date.now() - registro.inicio >= VENTANA_LOGIN_MS) {
    intentosLogin.delete(clave);
    return null;
  }
  return registro;
}
function registrarFalloLogin(clave) {
  const registro = obtenerRegistroLogin(clave) || { inicio: Date.now(), fallos: 0 };
  registro.fallos += 1;
  intentosLogin.set(clave, registro);
  // Cota simple de memoria para pruebas internas.
  if (intentosLogin.size > 5000) {
    for (const [k, v] of intentosLogin) if (Date.now() - v.inicio >= VENTANA_LOGIN_MS) intentosLogin.delete(k);
    while (intentosLogin.size > 5000) intentosLogin.delete(intentosLogin.keys().next().value);
  }
}
// Identidad operativa: no publica nombres de bases, usuarios ni contraseñas.
app.get('/api/planta', (_req, res) => {
  res.json({ plantaId: PLANTA_ID, plantaNombre: PLANTA_NOMBRE });
});

const SUM_CALIDAD = 'Sumatoria de calidad';
const SUM_CONDICION = 'Sumatoria de condición';
const normalizarNombre = nombre => String(nombre || '').trim().toLocaleLowerCase('es');
const numeroValido = valor => {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const normalizarObservacionCaja = valor => {
  const texto = String(valor ?? '').replace(/\s+/g, ' ').trim();
  if (texto.length > 60) {
    const error = new Error('La observación de la caja no puede superar los 60 caracteres.');
    error.status = 400;
    throw error;
  }
  return texto || null;
};
const resolverUsuarioCaja = async (client, usuarioId, username) => {
  const id = Number(usuarioId);
  if (Number.isInteger(id) && id > 0) {
    const r = await client.query('SELECT id, username FROM usuarios WHERE id=$1', [id]);
    if (r.rows.length) return { usuarioId: r.rows[0].id, usuario: String(r.rows[0].username).slice(0, 100) };
  }
  const nombre = String(username || '').trim().slice(0, 100);
  if (nombre && nombre.toLowerCase() !== 'usuario') {
    const r = await client.query('SELECT id, username FROM usuarios WHERE LOWER(username)=LOWER($1) LIMIT 1', [nombre]);
    if (r.rows.length) return { usuarioId: r.rows[0].id, usuario: String(r.rows[0].username).slice(0, 100) };
    return { usuarioId: null, usuario: nombre };
  }
  return { usuarioId: null, usuario: null };
};
// Catálogo maestro guardado en configuraciones.
async function obtenerParametros(client = pool) {
  const result = await client.query(
    "SELECT valor FROM configuraciones WHERE clave = 'parametros_calificacion'"
  );
  if (!result.rows.length) return { calidad: [], condicion: [] };
  const valor = result.rows[0].valor || {};
  return {
    calidad: Array.isArray(valor.calidad) ? valor.calidad : [],
    condicion: Array.isArray(valor.condicion) ? valor.condicion : []
  };
}
function crearMapaTipos(parametros) {
  const mapa = new Map();
  (parametros?.calidad || []).forEach(item => {
    if (item.nombre && item.nombre !== SUM_CALIDAD)
      mapa.set(normalizarNombre(item.nombre), 'calidad');
  });
  (parametros?.condicion || []).forEach(item => {
    if (item.nombre && item.nombre !== SUM_CONDICION)
      mapa.set(normalizarNombre(item.nombre), 'condicion');
  });
  return mapa;
}
function validarParametros(calidad, condicion) {
  if (!Array.isArray(calidad) || !Array.isArray(condicion))
    throw new Error('Calidad y condición deben ser listas válidas.');
  if (!calidad.some(p => p.nombre === SUM_CALIDAD))
    throw new Error(`Falta "${SUM_CALIDAD}".`);
  if (!condicion.some(p => p.nombre === SUM_CONDICION))
    throw new Error(`Falta "${SUM_CONDICION}".`);
  const nombres = new Set();
  for (const p of calidad) {
    const nombre = String(p.nombre || '').trim();
    if (!nombre) throw new Error('Existe un parámetro de calidad sin nombre.');
    const key = normalizarNombre(nombre);
    if (nombres.has(key)) throw new Error(`El defecto "${nombre}" está repetido.`);
    nombres.add(key);
    const lim1 = numeroValido(p.limAB);
    const lim2 = numeroValido(p.limBC);
    if (lim1 === null || lim2 === null || lim1 < 0 || lim2 < 0 || lim1 > 100 || lim2 > 100)
      throw new Error(`Los límites de "${nombre}" no son válidos.`);
    if (lim1 > lim2) throw new Error(`En "${nombre}", A-B no puede superar B-C.`);
  }
  for (const p of condicion) {
    const nombre = String(p.nombre || '').trim();
    if (!nombre) throw new Error('Existe un parámetro de condición sin nombre.');
    const key = normalizarNombre(nombre);
    if (nombres.has(key)) throw new Error(`El defecto "${nombre}" está repetido.`);
    nombres.add(key);
    const lim1 = numeroValido(p.lim12);
    const lim2 = numeroValido(p.lim23);
    if (lim1 === null || lim2 === null || lim1 < 0 || lim2 < 0 || lim1 > 100 || lim2 > 100)
      throw new Error(`Los límites de "${nombre}" no son válidos.`);
    if (lim1 > lim2) throw new Error(`En "${nombre}", 1-2 no puede superar 2-3.`);
  }
}
// Sincroniza defectos activos sin borrar registros históricos.
async function sincronizarCatalogoDefectos(client, parametros) {
  const procesar = async (lista, tipo, nombreSumatoria) => {
    const resultado = [];
    for (const item of lista) {
      const nombre = String(item.nombre || '').trim();
      if (nombre === nombreSumatoria) {
        resultado.push({ ...item, nombre });
        continue;
      }
      const existente = await client.query(
        `SELECT id FROM defectos
         WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))
         ORDER BY id ASC LIMIT 1`,
        [nombre]
      );
      let id;
      if (existente.rows.length) {
        id = existente.rows[0].id;
        await client.query(
          'UPDATE defectos SET nombre = $1, tipo = $2 WHERE id = $3',
          [nombre, tipo, id]
        );
      } else {
        const nuevo = await client.query(
          'INSERT INTO defectos (nombre, tipo) VALUES ($1, $2) RETURNING id',
          [nombre, tipo]
        );
        id = nuevo.rows[0].id;
      }
      resultado.push({ ...item, id, nombre });
    }
    return resultado;
  };
  return {
    calidad: await procesar(parametros.calidad, 'calidad', SUM_CALIDAD),
    condicion: await procesar(parametros.condicion, 'condicion', SUM_CONDICION)
  };
}
// Guarda cantidades manteniendo la categoría histórica de cada registro.
async function guardarDefectosCaja(client, cajaId, caja) {
  const result = await client.query('SELECT id, nombre FROM defectos');
  const mapa = new Map(result.rows.map(d => [normalizarNombre(d.nombre), d.id]));
  const guardar = async (defectos, tipo) => {
    for (const [nombre, cantidadOriginal] of Object.entries(defectos || {})) {
      const cantidad = parseInt(cantidadOriginal, 10) || 0;
      if (cantidad <= 0) continue;
      const defectoId = mapa.get(normalizarNombre(nombre));
      if (!defectoId)
        throw new Error(`El defecto "${nombre}" no está sincronizado con el catálogo de Parámetros.`);
      await client.query(
        `INSERT INTO caja_defectos (caja_id, defecto_id, cantidad, tipo)
         VALUES ($1, $2, $3, $4)`,
        [cajaId, defectoId, cantidad, tipo]
      );
    }
  };
  await guardar(caja.defCalidad, 'calidad');
  await guardar(caja.defCondicion, 'condicion');
}
const PUNTOS_TEMPERATURA_INICIALES = [
  ['agua-variado','T° Agua Vaciado','agua',1],
  ['pulpa-ingreso','T° Pulpa Ingreso','pulpa',2],
  ['agua-cort-pedicelo','T° Agua Cort. Pedicelo','agua',3],
  ['pulpa-cort-pedicelo','T° Pulpa Cort. Pedicelo','pulpa',4],
  ['agua-est-fungicida','T° Agua Est. Fungicida','agua',5],
  ['pulpa-est-fungicida','T° Pulpa Est. Fungicida','pulpa',6],
  ['pulpa-sellado','T° Pulpa Sellado','pulpa',7],
  ['ambiente-sellado','T° Ambiente Sellado','ambiente',8],
  ['amb-palletizaje','T° Amb. Palletizaje','ambiente',9]
];

const KPI_TEMPERATURA_CONFIG = [
  { key: 'vaciado', titulo: 'VACIADO', subtitulo: 'T° PULPA', codigo: 'pulpa-ingreso', min: 2, max: 5, rangoLabel: '2 a 5 °C' },
  { key: 'cortador-pedicelo', titulo: 'CORTADOR PEDICELO', subtitulo: 'T° AGUA', codigo: 'agua-cort-pedicelo', min: 2, max: 4, rangoLabel: '2 a 4 °C' },
  { key: 'estanque-fungicida', titulo: 'ESTANQUE FUNGICIDA', subtitulo: 'T° AGUA', codigo: 'agua-est-fungicida', min: 0, max: 2, rangoLabel: '0 a 2 °C' },
  { key: 'sellado', titulo: 'SELLADO (EMBALAJE)', subtitulo: 'T° PULPA', codigo: 'pulpa-sellado', min: 4, max: 6, rangoLabel: '4 a 6 °C' },
  { key: 'sala-proceso', titulo: 'SALA PROCESO', subtitulo: 'T° AMBIENTE', codigo: 'ambiente-sellado', min: 10.1, max: 15, rangoLabel: '10,1 a 15 °C' },
  { key: 'paletizado', titulo: 'PALETIZADO', subtitulo: 'T° AMBIENTE', codigo: 'amb-palletizaje', min: 4, max: 6, rangoLabel: '4 a 6 °C' }
];

function normalizarTurnoTemperatura(valor) {
  const v = String(valor || '').trim().toLocaleLowerCase('es');
  if (v === 'dia' || v === 'día') return 'Dia';
  if (v === 'noche') return 'Noche';
  return null;
}
function normalizarHoraTemperatura(valor) {
  const m = String(valor || '').trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return m ? `${m[1]}:${m[2]}` : null;
}
function validarFechaTemperatura(fecha) {
  const v = String(fecha || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}
function construirFechaHoraTemperatura(fecha, turno, hora) {
  const f = validarFechaTemperatura(fecha);
  const t = normalizarTurnoTemperatura(turno);
  const h = normalizarHoraTemperatura(hora);
  if (!f || !t || !h) return null;
  let fechaReal = f;
  if (t === 'Noche' && Number(h.slice(0, 2)) < 12) {
    const d = new Date(`${f}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    fechaReal = d.toISOString().slice(0, 10);
  }
  return `${fechaReal} ${h}:00`;
}
function numeroTemperatura(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const n = Number(String(valor).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
async function asegurarEstructuraTemperaturas(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS puntos_temperatura (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(80) UNIQUE NOT NULL,
      nombre VARCHAR(160) UNIQUE NOT NULL,
      categoria VARCHAR(20) NOT NULL,
      orden INTEGER NOT NULL DEFAULT 0,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS temperatura_turnos (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL,
      turno VARCHAR(10) NOT NULL CHECK (turno IN ('Dia','Noche')),
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(fecha, turno)
    );
    CREATE TABLE IF NOT EXISTS temperatura_horas (
      id SERIAL PRIMARY KEY,
      turno_id INTEGER NOT NULL REFERENCES temperatura_turnos(id) ON DELETE CASCADE,
      hora TIME NOT NULL,
      fecha_hora TIMESTAMP NOT NULL,
      proceso_id INTEGER REFERENCES procesos(id) ON DELETE SET NULL,
      estado_asociacion VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(turno_id, hora)
    );
    CREATE TABLE IF NOT EXISTS temperatura_detalle (
      id SERIAL PRIMARY KEY,
      registro_hora_id INTEGER NOT NULL REFERENCES temperatura_horas(id) ON DELETE CASCADE,
      punto_temperatura_id INTEGER NOT NULL REFERENCES puntos_temperatura(id),
      valor NUMERIC(7,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(registro_hora_id, punto_temperatura_id)
    );
    CREATE INDEX IF NOT EXISTS idx_temperatura_horas_fecha_hora ON temperatura_horas(fecha_hora);
    CREATE INDEX IF NOT EXISTS idx_temperatura_horas_proceso ON temperatura_horas(proceso_id);
    CREATE INDEX IF NOT EXISTS idx_temperatura_detalle_registro ON temperatura_detalle(registro_hora_id);
  `);
  for (const [codigo, nombre, categoria, orden] of PUNTOS_TEMPERATURA_INICIALES) {
    await client.query(`
      INSERT INTO puntos_temperatura (codigo, nombre, categoria, orden, activo)
      VALUES ($1,$2,$3,$4,TRUE)
      ON CONFLICT (codigo) DO UPDATE SET nombre=EXCLUDED.nombre, categoria=EXCLUDED.categoria, orden=EXCLUDED.orden, activo=TRUE, updated_at=NOW()
    `, [codigo, nombre, categoria, orden]);
  }
}
async function resolverProcesoTemperatura(client, fechaHora) {
  const result = await client.query(`
    SELECT p.id, p.num_proceso AS "numProceso", p.estado, p.hora_inicio AS "horaInicio", p.hora_fin AS "horaFin"
    FROM procesos p
    WHERE p.estado <> 'Cancelado'
      AND p.hora_inicio IS NOT NULL
      AND p.hora_inicio <= $1::timestamp
      AND ((p.hora_fin IS NOT NULL AND p.hora_fin >= $1::timestamp) OR (p.hora_fin IS NULL AND p.estado = 'En curso'))
    ORDER BY p.hora_inicio DESC, p.id DESC
  `, [fechaHora]);
  if (!result.rows.length) return { estado: 'pendiente', procesoId: null, numProceso: null, candidatos: [] };
  if (result.rows.length > 1) return { estado: 'conflicto', procesoId: null, numProceso: null, candidatos: result.rows.map(r => ({ id: r.id, numProceso: r.numProceso })) };
  return { estado: 'asociado', procesoId: result.rows[0].id, numProceso: result.rows[0].numProceso, candidatos: [] };
}
async function actualizarAsociacionTemperaturaHora(client, registroId, fechaHora) {
  const asociacion = await resolverProcesoTemperatura(client, fechaHora);
  await client.query(`UPDATE temperatura_horas SET proceso_id=$1, estado_asociacion=$2, updated_at=NOW() WHERE id=$3`, [asociacion.procesoId, asociacion.estado, registroId]);
  return asociacion;
}
async function reasociarTemperaturasPorProceso(client, procesoId) {
  const result = await client.query(`
    SELECT th.id, TO_CHAR(th.fecha_hora,'YYYY-MM-DD HH24:MI:SS') AS "fechaHora"
    FROM temperatura_horas th
    JOIN procesos p ON p.id=$1
    WHERE th.proceso_id=$1 OR (
      p.hora_inicio IS NOT NULL AND th.fecha_hora >= p.hora_inicio AND
      ((p.hora_fin IS NOT NULL AND th.fecha_hora <= p.hora_fin) OR (p.hora_fin IS NULL AND p.estado='En curso'))
    )
    ORDER BY th.fecha_hora
  `, [procesoId]);
  for (const row of result.rows) await actualizarAsociacionTemperaturaHora(client, row.id, row.fechaHora);
  return result.rows.length;
}
async function reasociarTemperaturasTurno(client, fecha, turno) {
  const result = await client.query(`
    SELECT th.id, TO_CHAR(th.fecha_hora,'YYYY-MM-DD HH24:MI:SS') AS "fechaHora"
    FROM temperatura_horas th JOIN temperatura_turnos tt ON tt.id=th.turno_id
    WHERE tt.fecha=$1 AND tt.turno=$2 ORDER BY th.fecha_hora
  `, [fecha, turno]);
  for (const row of result.rows) await actualizarAsociacionTemperaturaHora(client, row.id, row.fechaHora);
  return result.rows.length;
}

async function obtenerTurnoTemperaturas(client, fecha, turno) {
  const turnoRes = await client.query(`
    SELECT id, TO_CHAR(fecha,'YYYY-MM-DD') AS fecha, turno, usuario_id AS "usuarioId",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM temperatura_turnos
    WHERE fecha=$1 AND turno=$2
  `, [fecha, turno]);
  if (!turnoRes.rows.length) return { fecha, turno, turnoId: null, createdAt: null, updatedAt: null, horas: [] };
  const turnoData = turnoRes.rows[0];
  const rows = await client.query(`
    SELECT th.id, TO_CHAR(th.hora,'HH24:MI') AS hora,
           TO_CHAR(th.fecha_hora,'YYYY-MM-DD HH24:MI:SS') AS "fechaHora",
           th.proceso_id AS "procesoId", th.estado_asociacion AS "estadoAsociacion",
           th.usuario_id AS "usuarioId", th.created_at AS "createdAt", th.updated_at AS "updatedAt",
           p.num_proceso AS "numProceso", pt.id AS "puntoId", pt.codigo, pt.nombre, pt.categoria, pt.orden, td.valor
    FROM temperatura_horas th
    LEFT JOIN procesos p ON p.id=th.proceso_id
    LEFT JOIN temperatura_detalle td ON td.registro_hora_id=th.id
    LEFT JOIN puntos_temperatura pt ON pt.id=td.punto_temperatura_id
    WHERE th.turno_id=$1
    ORDER BY th.fecha_hora, pt.orden, pt.id
  `, [turnoData.id]);
  const mapa = new Map();
  for (const row of rows.rows) {
    if (!mapa.has(row.id)) {
      mapa.set(row.id, {
        id: row.id, hora: row.hora, fechaHora: row.fechaHora,
        procesoId: row.procesoId, numProceso: row.numProceso,
        estadoAsociacion: row.estadoAsociacion, usuarioId: row.usuarioId,
        createdAt: row.createdAt, updatedAt: row.updatedAt, mediciones: []
      });
    }
    if (row.puntoId) {
      mapa.get(row.id).mediciones.push({
        puntoId: row.puntoId, codigo: row.codigo, nombre: row.nombre,
        categoria: row.categoria, valor: row.valor === null ? null : Number(row.valor)
      });
    }
  }
  return { ...turnoData, turnoId: turnoData.id, horas: Array.from(mapa.values()) };
}

function estadoKpiTemperatura(cumplimiento, muestras) {
  if (!muestras) return 'Sin datos';
  if (cumplimiento >= 90) return 'Óptimo';
  if (cumplimiento >= 80) return 'Regular';
  return 'Crítico';
}

function calcularKpisTemperatura(turnos) {
  const horas = [...(turnos.Dia?.horas || []), ...(turnos.Noche?.horas || [])];
  return KPI_TEMPERATURA_CONFIG.map(config => {
    const valores = [];
    for (const hora of horas) {
      const med = (hora.mediciones || []).find(m => m.codigo === config.codigo);
      const valor = numeroTemperatura(med?.valor);
      if (valor !== null) valores.push(valor);
    }
    const promedio = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
    const dentroRango = valores.filter(v =>
      (config.min === null || v >= config.min) && (config.max === null || v <= config.max)
    ).length;
    const cumplimiento = valores.length ? Number(((dentroRango / valores.length) * 100).toFixed(1)) : null;
    return {
      ...config,
      promedio: promedio === null ? null : Number(promedio.toFixed(2)),
      cumplimiento,
      estado: estadoKpiTemperatura(cumplimiento, valores.length),
      muestras: valores.length
    };
  });
}

async function guardarHoraTemperatura(client, payload = {}) {
  const fecha = validarFechaTemperatura(payload.fecha);
  const turno = normalizarTurnoTemperatura(payload.turno);
  const hora = normalizarHoraTemperatura(payload.hora);
  const fechaHora = construirFechaHoraTemperatura(fecha, turno, hora);
  const usuarioIdRaw = Number(payload.usuarioId);
  const usuarioId = Number.isInteger(usuarioIdRaw) && usuarioIdRaw > 0 ? usuarioIdRaw : null;
  const mediciones = Array.isArray(payload.mediciones) ? payload.mediciones : [];
  if (!fecha || !turno || !hora || !fechaHora) throw Object.assign(new Error('Fecha, turno y hora son obligatorios.'), { status: 400 });
  if (!mediciones.length) throw Object.assign(new Error('Debes enviar al menos una medición.'), { status: 400 });

  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`temperatura:${fecha}:${turno}:${hora}`]);
  const turnoRes = await client.query(`
    INSERT INTO temperatura_turnos (fecha, turno, usuario_id) VALUES ($1,$2,$3)
    ON CONFLICT (fecha, turno) DO UPDATE SET
      usuario_id=COALESCE(EXCLUDED.usuario_id, temperatura_turnos.usuario_id), updated_at=NOW()
    RETURNING id
  `, [fecha, turno, usuarioId]);

  const asociacion = await resolverProcesoTemperatura(client, fechaHora);
  const horaRes = await client.query(`
    INSERT INTO temperatura_horas (turno_id, hora, fecha_hora, proceso_id, estado_asociacion, usuario_id)
    VALUES ($1,$2::time,$3::timestamp,$4,$5,$6)
    ON CONFLICT (turno_id, hora) DO UPDATE SET
      fecha_hora=EXCLUDED.fecha_hora, proceso_id=EXCLUDED.proceso_id,
      estado_asociacion=EXCLUDED.estado_asociacion,
      usuario_id=COALESCE(EXCLUDED.usuario_id, temperatura_horas.usuario_id), updated_at=NOW()
    RETURNING id
  `, [turnoRes.rows[0].id, `${hora}:00`, fechaHora, asociacion.procesoId, asociacion.estado, usuarioId]);
  const registroId = horaRes.rows[0].id;

  const puntosRes = await client.query(`SELECT id, codigo, nombre FROM puntos_temperatura WHERE activo=TRUE`);
  const porId = new Map(puntosRes.rows.map(p => [String(p.id), p]));
  const porCodigo = new Map(puntosRes.rows.map(p => [String(p.codigo), p]));
  const advertencias = [];
  const normalizadas = [];
  const puntosUsados = new Set();

  for (const med of mediciones) {
    const clave = med?.puntoId ?? med?.codigo;
    const punto = porId.get(String(clave)) || porCodigo.get(String(clave));
    if (!punto) throw Object.assign(new Error(`Punto de temperatura no válido: ${clave ?? 'sin identificador'}.`), { status: 400 });
    if (puntosUsados.has(punto.id)) throw Object.assign(new Error(`El punto ${punto.nombre} está repetido en la misma hora.`), { status: 400 });
    puntosUsados.add(punto.id);
    const valor = numeroTemperatura(med?.valor);
    if (valor === null) continue;
    if (valor < -10 || valor > 40) advertencias.push(`${punto.nombre}: ${valor} °C parece fuera de un rango habitual; verifica el dato.`);
    normalizadas.push({ punto, valor });
  }
  if (!normalizadas.length) throw Object.assign(new Error('La hora no contiene mediciones válidas para guardar.'), { status: 400 });

  // Reemplazo completo de la hora: si un valor fue borrado en el frontend, no queda el valor anterior en PostgreSQL.
  await client.query(`DELETE FROM temperatura_detalle WHERE registro_hora_id=$1`, [registroId]);
  for (const { punto, valor } of normalizadas) {
    await client.query(`INSERT INTO temperatura_detalle (registro_hora_id, punto_temperatura_id, valor) VALUES ($1,$2,$3)`, [registroId, punto.id, valor]);
  }

  return {
    success: true, turnoId: turnoRes.rows[0].id, registroId,
    fecha, turno, hora, fechaHora, asociacion, advertencias,
    medicionesGuardadas: normalizadas.length
  };
}
// Conectar a la DB y asegurar que existan las tablas necesarias
pool.connect()
  .then(async (client) => {
    console.log(`✅ EVAP ${PLANTA_NOMBRE} (${PLANTA_ID}): conexión PostgreSQL establecida en ${process.env.DB_HOST}.`);
    try {
      // Auto-crear la tabla para guardar parámetros en formato JSON si no existe
      await client.query(`
        CREATE TABLE IF NOT EXISTS configuraciones (
            id SERIAL PRIMARY KEY,
            clave VARCHAR(100) UNIQUE NOT NULL,
            valor JSONB NOT NULL
        );
      `);
      console.log('✅ Tabla de configuraciones verificada/creada.');
      // Auto-crear la tabla de usuarios si no existe
      await client.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'qc',
            permisos JSONB NOT NULL DEFAULT '{}'::jsonb
        );
      `);
      console.log('✅ Tabla de usuarios verificada/creada.');
      // Catálogo dinámico y snapshot histórico de parámetros.
      await client.query(`ALTER TABLE defectos ADD COLUMN IF NOT EXISTS tipo VARCHAR(20);`);
      await client.query(`ALTER TABLE caja_defectos ADD COLUMN IF NOT EXISTS tipo VARCHAR(20);`);
      await client.query(`ALTER TABLE procesos ADD COLUMN IF NOT EXISTS parametros_snapshot JSONB;`);
      await client.query(`ALTER TABLE procesos ADD COLUMN IF NOT EXISTS foto_light TEXT;`);
      await client.query(`ALTER TABLE procesos ADD COLUMN IF NOT EXISTS foto_dark TEXT;`);
      await client.query(`ALTER TABLE cajas ADD COLUMN IF NOT EXISTS observacion VARCHAR(60);`);
      await client.query(`ALTER TABLE cajas ADD COLUMN IF NOT EXISTS usuario_id INTEGER;`);
      await client.query(`ALTER TABLE cajas ADD COLUMN IF NOT EXISTS usuario_nombre VARCHAR(100);`);
      await client.query(`UPDATE cajas c SET usuario_nombre=u.username FROM usuarios u WHERE c.usuario_id=u.id AND (c.usuario_nombre IS NULL OR BTRIM(c.usuario_nombre)='' OR LOWER(BTRIM(c.usuario_nombre))='usuario')`);
      console.log('✅ Estructura dinámica de defectos, fotografías, observaciones y usuario por caja verificada.');
      const parametrosActuales = await obtenerParametros(client);
      if (parametrosActuales.calidad.length || parametrosActuales.condicion.length) {
        const sincronizados = await sincronizarCatalogoDefectos(client, parametrosActuales);
        await client.query(
          `INSERT INTO configuraciones (clave, valor)
           VALUES ('parametros_calificacion', $1::jsonb)
           ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
          [JSON.stringify(sincronizados)]
        );
      }
      await client.query(`
        UPDATE caja_defectos cd
        SET tipo = d.tipo
        FROM defectos d
        WHERE cd.defecto_id = d.id
          AND cd.tipo IS NULL
          AND d.tipo IS NOT NULL
      `);
      // Solo crear el primer administrador si TI define una clave inicial privada en .env.
      const checkAdmin = await client.query('SELECT COUNT(*) FROM usuarios');
      if (Number(checkAdmin.rows[0].count) === 0) {
        const claveInicial = String(process.env.EVAP_ADMIN_INICIAL_PASSWORD || '').trim();
        if (claveInicial.length >= 8 && claveInicial.length <= 128) {
          const claveProtegida = await protegerClave(claveInicial);
          await client.query(`
            INSERT INTO usuarios (username, password, role, permisos)
            VALUES ('admin', $1, 'admin', '{"crear_proceso":true,"editar_informes":true,"ver_dashboard":true,"ver_historial":true,"acceder_digitacion":true,"eliminar_procesos":true,"gestionar_ajustes":true}'::jsonb)
          `, [claveProtegida]);
          console.log('Usuario administrador inicial creado mediante configuracion privada.');
        } else {
          console.warn('No hay usuarios en esta planta. Define EVAP_ADMIN_INICIAL_PASSWORD en el .env (8 a 128 caracteres) para crear el primer admin.');
        }
      }
      await client.query(`ALTER TABLE procesos ADD COLUMN IF NOT EXISTS hora_inicio TIMESTAMP;`);
      await client.query(`ALTER TABLE procesos ADD COLUMN IF NOT EXISTS hora_fin TIMESTAMP;`);
      await client.query(`ALTER TABLE procesos ADD COLUMN IF NOT EXISTS fecha DATE;`);
      console.log('✅ Columnas hora_inicio, hora_fin y fecha verificadas.');
      await asegurarEstructuraTemperaturas(client);
      console.log('✅ Estructura de Digitación / Temperatura en línea verificada.');
    } catch (err) {
      console.error('❌ Error creando/verificando tablas en PostgreSQL:', err);
    } finally {
      client.release();
    }
  })
  .catch(err => console.error('❌ Error de conexión a la base de datos', err.stack));
// ==========================================
// RUTAS DE LA API (Endpoints)
// ==========================================
const liveSessions = new Map();
const boxReservations = new Map();
const LIVE_SESSION_TTL = 20000;
const LIVE_SESSION_SUSPENDED_TTL = 2 * 60 * 60 * 1000;
const MAX_USUARIOS_PROCESO = 3;
const limpiarReservasCajas = () => {
  const ahora = Date.now();
  for (const [clientId, reserva] of boxReservations.entries()) {
    const ttl = reserva.suspended ? LIVE_SESSION_SUSPENDED_TTL : LIVE_SESSION_TTL;
    if (ahora - Number(reserva.updatedAt || 0) > ttl) boxReservations.delete(clientId);
  }
};
const obtenerReservasProceso = (procesoId, excluirClientId = null) => {
  limpiarReservasCajas();
  const excluir = excluirClientId ? String(excluirClientId) : null;
  return Array.from(boxReservations.values()).filter(r =>
    Number(r.procesoId) === Number(procesoId) && (!excluir || String(r.clientId) !== excluir)
  );
};
const reservarCajaCliente = (procesoId, clientId, numerosGuardados = [], cajaPreferida = null, meta = {}) => {
  if (!clientId) return null;
  limpiarReservasCajas();
  const idCliente = String(clientId);
  const existente = boxReservations.get(idCliente);
  if (existente && Number(existente.procesoId) === Number(procesoId)) {
    existente.updatedAt = Date.now();
    if (meta.username) existente.username = String(meta.username);
    if (meta.usuarioId) existente.usuarioId = Number(meta.usuarioId) || null;
    boxReservations.set(idCliente, existente);
    return existente.numCaja;
  }
  if (existente) boxReservations.delete(idCliente);
  const ocupados = new Set((numerosGuardados || []).map(Number).filter(n => Number.isInteger(n) && n > 0));
  obtenerReservasProceso(procesoId, idCliente).forEach(r => ocupados.add(Number(r.numCaja)));
  const preferida = Number(cajaPreferida);
  let numCaja = Number.isInteger(preferida) && preferida > 0 && !ocupados.has(preferida) ? preferida : 1;
  while (ocupados.has(numCaja)) numCaja++;
  boxReservations.set(idCliente, { clientId: idCliente, procesoId: Number(procesoId), numCaja, username: meta.username ? String(meta.username) : 'Usuario', usuarioId: Number(meta.usuarioId) || null, updatedAt: Date.now(), suspended: false });
  return numCaja;
};
const liberarReservaCliente = clientId => { if (clientId) boxReservations.delete(String(clientId)); };
const limpiarReservasProceso = procesoId => {
  for (const [clientId, reserva] of boxReservations.entries()) {
    if (Number(reserva.procesoId) === Number(procesoId)) boxReservations.delete(clientId);
  }
};
const limpiarSesionesLive = () => {
  const ahora = Date.now();
  for (const [id, sesion] of liveSessions.entries()) {
    const ttl = sesion.suspended ? LIVE_SESSION_SUSPENDED_TTL : LIVE_SESSION_TTL;
    if (ahora - Number(sesion.updatedAt || 0) > ttl) liveSessions.delete(id);
  }
};
const obtenerSesionesProceso = (procesoId, excluirClientId = null) => {
  limpiarSesionesLive();
  const excluir = excluirClientId ? String(excluirClientId) : null;
  return Array.from(liveSessions.values()).filter(sesion =>
    Number(sesion.procesoId) === Number(procesoId) && (!excluir || String(sesion.clientId) !== excluir)
  );
};
const obtenerSesionesActivasProceso = (procesoId, excluirClientId = null) => {
  limpiarSesionesLive();
  const ahora = Date.now();
  const excluir = excluirClientId ? String(excluirClientId) : null;
  return Array.from(liveSessions.values()).filter(sesion =>
    Number(sesion.procesoId) === Number(procesoId) &&
    (!excluir || String(sesion.clientId) !== excluir) &&
    sesion.suspended !== true &&
    ahora - Number(sesion.updatedAt || 0) <= LIVE_SESSION_TTL
  );
};
const limpiarSesionesProceso = procesoId => {
  for (const [id, sesion] of liveSessions.entries()) {
    if (Number(sesion.procesoId) === Number(procesoId)) liveSessions.delete(id);
  }
};
const obtenerParticipantesProceso = procesoId => {
  limpiarSesionesLive(); limpiarReservasCajas();
  const mapa = new Map();
  const agregar = item => {
    const usuarioId = Number(item.usuarioId) || null;
    const clientId = String(item.clientId || '');
    const key = usuarioId ? `u:${usuarioId}` : `c:${clientId}`;
    const previo = mapa.get(key) || {};
    mapa.set(key, { clientId: clientId || previo.clientId || '', usuarioId: usuarioId || previo.usuarioId || null, username: item.username || previo.username || 'Usuario' });
  };
  Array.from(boxReservations.values()).filter(r => Number(r.procesoId) === Number(procesoId)).forEach(agregar);
  Array.from(liveSessions.values()).filter(s => Number(s.procesoId) === Number(procesoId)).forEach(agregar);
  return Array.from(mapa.values());
};
app.post('/api/live', (req, res) => {
  const body = req.body || {};
  if (Object.keys(body).length === 0) {
    liveSessions.clear();
    return res.json({ success: true });
  }
  if (body.clearClientId) {
    liveSessions.delete(String(body.clearClientId));
    return res.json({ success: true });
  }
  const clientId = String(body.clientId || 'legacy');
  const procesoId = Number(body.procesoId);
  if (Number.isInteger(procesoId) && procesoId > 0) {
    const participantes = obtenerParticipantesProceso(procesoId);
    const yaPertenece = participantes.some(p => (Number(body.usuarioId) > 0 && Number(p.usuarioId) === Number(body.usuarioId)) || String(p.clientId) === clientId);
    if (!yaPertenece && participantes.length >= MAX_USUARIOS_PROCESO) return res.status(409).json({ success: false, code: 'LIMITE_USUARIOS', error: `Este proceso ya alcanzó el máximo de ${MAX_USUARIOS_PROCESO} usuarios.` });
  }
  const suspended = body.suspended === true;
  liveSessions.set(clientId, { ...body, clientId, username: body.username || 'Usuario', usuarioId: Number(body.usuarioId) || null, suspended, updatedAt: Date.now() });
  const reserva = boxReservations.get(clientId);
  if (reserva && (!body.procesoId || Number(reserva.procesoId) === Number(body.procesoId))) {
    reserva.updatedAt = Date.now(); reserva.suspended = suspended;
    if (body.username) reserva.username = String(body.username);
    if (body.usuarioId) reserva.usuarioId = Number(body.usuarioId) || null;
    boxReservations.set(clientId, reserva);
  }
  limpiarSesionesLive(); limpiarReservasCajas();
  res.json({ success: true });
});
app.get('/api/live', (req, res) => {
  limpiarSesionesLive();
  const sessions = Array.from(liveSessions.values());
  if (!sessions.length) return res.json({ status: 'waiting', sessions: [] });
  const latest = sessions.reduce((a, b) => Number(a.updatedAt || 0) > Number(b.updatedAt || 0) ? a : b);
  res.json({ ...latest, status: 'live', sessions });
});
// ==========================================
// AUTENTICACIÓN (LOGIN)
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' ||
        !username.trim() || !password.trim() || username.length > 100 || password.length > 256)
      return res.status(400).json({ success: false, message: 'Usuario y contrasena requeridos y validos' });
    const nombre = username.trim();
    const clave = password.trim(); // Compatibilidad con el formulario de EVAP actual.
    const identificador = `${req.ip}:${nombre.toLowerCase()}`;
    const intentos = obtenerRegistroLogin(identificador);
    if (intentos && intentos.fallos >= MAX_FALLOS_LOGIN) {
      res.set('Retry-After', String(Math.ceil((VENTANA_LOGIN_MS - (Date.now() - intentos.inicio)) / 1000)));
      return res.status(429).json({ success: false, message: 'Demasiados intentos. Intenta nuevamente en unos minutos.' });
    }
    const result = await pool.query(
      'SELECT id, username, password, role, permisos FROM usuarios WHERE LOWER(username) = LOWER($1)',
      [nombre]
    );
    const usuario = result.rows[0] || null;
    const comprobacion = usuario ? await verificarClave(clave, usuario.password) : { valido: false };
    if (!comprobacion.valido) {
      registrarFalloLogin(identificador);
      return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
    }
    intentosLogin.delete(identificador);
    if (comprobacion.antigua) {
      // Actualiza solo si otro inicio de sesion no modifico la clave primero.
      const nuevaClave = await protegerClave(clave);
      await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2 AND password = $3', [nuevaClave, usuario.id, usuario.password]);
    }
    const { id, username: usernameGuardado, role, permisos } = usuario;
    res.json({ success: true, user: { id, username: usernameGuardado, role, permisos } });
  } catch (error) {
    console.error('Error en /api/login:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor en el login' });
  }
});
// ==========================================
// GESTIÓN DE USUARIOS
// ==========================================
// Obtener todos los usuarios (excluyendo contraseñas por seguridad)
app.get('/api/usuarios', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, permisos FROM usuarios ORDER BY id ASC;');
    res.json(result.rows);
  } catch (error) {
    console.error('Error en GET /api/usuarios:', error);
    res.status(500).json({ message: 'Error al obtener los usuarios' });
  }
});
// Crear un nuevo usuario
app.post('/api/usuarios', async (req, res) => {
  try {
    const { username, password, role, permisos } = req.body || {};
    const errorCuenta = validarDatosCuenta(username, role, permisos, password, true);
    if (errorCuenta) return res.status(400).json({ message: errorCuenta });
    const permisosJson = JSON.stringify(permisos || {});
    const claveProtegida = await protegerClave(password.trim());
    const result = await pool.query(
      'INSERT INTO usuarios (username, password, role, permisos) VALUES ($1, $2, $3, $4::jsonb) RETURNING id, username, role, permisos',
      [username.trim(), claveProtegida, role || 'qc', permisosJson]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'El nombre de usuario ya existe' });
    }
    res.status(500).json({ message: 'Error interno al guardar usuario' });
  }
});
// Editar usuario existente
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, permisos } = req.body || {};
    const errorCuenta = validarDatosCuenta(username, role, permisos, password, false);
    if (errorCuenta) return res.status(400).json({ message: errorCuenta });
    const permisosJson = JSON.stringify(permisos || {});
    let result;
    if (typeof password === 'string' && password.trim() !== '') {
      const claveProtegida = await protegerClave(password.trim());
      result = await pool.query(
        'UPDATE usuarios SET username = $1, password = $2, role = $3, permisos = $4::jsonb WHERE id = $5 RETURNING id, username, role, permisos',
        [username.trim(), claveProtegida, role || 'qc', permisosJson, id]
      );
    } else {
      result = await pool.query(
        'UPDATE usuarios SET username = $1, role = $2, permisos = $3::jsonb WHERE id = $4 RETURNING id, username, role, permisos',
        [username.trim(), role || 'qc', permisosJson, id]
      );
    }
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No se encontró el usuario para editar' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'El nombre de usuario ya existe en otro registro' });
    }
    res.status(500).json({ message: 'Error interno al actualizar usuario' });
  }
});
// Eliminar usuario
app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No se encontró el usuario para eliminar' });
    }
    res.json({ success: true, message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error interno al eliminar usuario' });
  }
});
// ==========================================
// GESTIÓN DE HUERTOS (COMPLETO)
// ==========================================
// Obtener todos los huertos
app.get('/api/huertos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.id, h.productor, h.nombre_huerto as huerto, h.csg, e.nombre as exportadora
      FROM huertos h JOIN exportadoras e ON h.exportadora_id = e.id ORDER BY h.productor ASC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en GET /api/huertos:', error);
    res.status(500).json({ error: 'Error al obtener los huertos' });
  }
});
// Guardar un nuevo Huerto
app.post('/api/huertos', async (req, res) => {
  try {
    const { productor, huerto, csg, exportadora } = req.body;
    const expRes = await pool.query('SELECT id FROM exportadoras WHERE nombre = $1', [exportadora]);
    if (expRes.rows.length === 0) {
      return res.status(400).json({ error: 'La exportadora seleccionada no existe en la base de datos' });
    }
    const result = await pool.query(
      'INSERT INTO huertos (productor, nombre_huerto, csg, exportadora_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [productor, huerto, csg, expRes.rows[0].id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al guardar huerto:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El código CSG ya existe en otro huerto' });
    }
    res.status(500).json({ error: 'Error interno al guardar huerto' });
  }
});
// Editar un Huerto existente
app.put('/api/huertos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { productor, huerto, csg, exportadora } = req.body;
    const expRes = await pool.query('SELECT id FROM exportadoras WHERE nombre = $1', [exportadora]);
    if (expRes.rows.length === 0) {
      return res.status(400).json({ error: 'La exportadora seleccionada no existe' });
    }
    const result = await pool.query(
      'UPDATE huertos SET productor = $1, nombre_huerto = $2, csg = $3, exportadora_id = $4 WHERE id = $5 RETURNING *',
      [productor, huerto, csg, expRes.rows[0].id, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No se encontró el huerto para editar' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar huerto:', error);
    res.status(500).json({ error: 'Error interno al actualizar huerto' });
  }
});
// Eliminar un Huerto
app.delete('/api/huertos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM huertos WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No se encontró el huerto para eliminar' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar huerto:', error);
    res.status(500).json({ error: 'No puedes eliminar este huerto porque ya tiene inspecciones y procesos guardados en el historial.' });
  }
});
// ==========================================
// GESTIÓN DE EXPORTADORAS
// ==========================================
app.get('/api/exportadoras', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM exportadoras ORDER BY nombre ASC;');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener exportadoras' });
  }
});
app.post('/api/exportadoras', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const result = await pool.query(
      'INSERT INTO exportadoras (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al guardar exportadora:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'La exportadora ya existe en la base de datos' });
    }
    res.status(500).json({ error: 'Error interno al guardar exportadora' });
  }
});
app.delete('/api/exportadoras/:nombre', async (req, res) => {
  try {
    const { nombre } = req.params;
    const result = await pool.query(
      'DELETE FROM exportadoras WHERE nombre = $1 RETURNING *',
      [nombre]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No se encontró la exportadora para eliminar' });
    }
    res.status(200).json({ message: 'Exportadora eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar exportadora:', error);
    res.status(500).json({ error: 'Error interno al eliminar exportadora' });
  }
});
// ==========================================
// GESTIÓN DE VARIEDADES
// ==========================================
app.get('/api/variedades', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM variedades ORDER BY nombre ASC;');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener variedades' });
  }
});
app.post('/api/variedades', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const result = await pool.query(
      'INSERT INTO variedades (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al guardar variedad:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'La variedad ya existe en la base de datos' });
    }
    res.status(500).json({ error: 'Error interno al guardar variedad' });
  }
});
app.delete('/api/variedades/:nombre', async (req, res) => {
  try {
    const { nombre } = req.params;
    const result = await pool.query(
      'DELETE FROM variedades WHERE nombre = $1 RETURNING *',
      [nombre]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No se encontró la variedad para eliminar' });
    }
    res.status(200).json({ message: 'Variedad eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar variedad:', error);
    res.status(500).json({ error: 'Error interno al eliminar variedad' });
  }
});
// ==========================================
// GESTIÓN DE PARÁMETROS DE CALIFICACIÓN
// ==========================================
app.get('/api/parametros', async (req, res) => {
  try {
    res.json(await obtenerParametros());
  } catch (err) {
    console.error('Error obteniendo parámetros:', err);
    res.status(500).json({ error: 'Error interno obteniendo parámetros' });
  }
});
app.post('/api/parametros', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const calidad = Array.isArray(req.body?.calidad) ? req.body.calidad : [];
    const condicion = Array.isArray(req.body?.condicion) ? req.body.condicion : [];
    validarParametros(calidad, condicion);
    const parametros = await sincronizarCatalogoDefectos(client, { calidad, condicion });
    await client.query(
      `INSERT INTO configuraciones (clave, valor)
       VALUES ('parametros_calificacion', $1::jsonb)
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
      [JSON.stringify(parametros)]
    );
    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Catálogo y parámetros guardados correctamente',
      parametros
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error guardando parámetros:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});
// ==========================================
// DIGITACIÓN - TEMPERATURA EN LÍNEA
// ==========================================
app.get('/api/digitacion/temperaturas/puntos', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, codigo, nombre, categoria, orden, activo FROM puntos_temperatura WHERE activo=TRUE ORDER BY orden, id`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo puntos de temperatura:', error);
    res.status(500).json({ error: 'No fue posible obtener los puntos de temperatura.' });
  }
});
app.get('/api/digitacion/temperaturas', async (req, res) => {
  try {
    const fecha = validarFechaTemperatura(req.query.fecha);
    const turno = normalizarTurnoTemperatura(req.query.turno);
    if (!fecha || !turno) return res.status(400).json({ error: 'Fecha y turno son obligatorios.' });
    const data = await obtenerTurnoTemperaturas(pool, fecha, turno);
    res.json({ ...data, serverTime: new Date().toISOString() });
  } catch (error) {
    console.error('Error obteniendo temperaturas:', error);
    res.status(500).json({ error: 'No fue posible obtener el registro de temperaturas.' });
  }
});

app.get('/api/digitacion/temperaturas/resumen', async (req, res) => {
  try {
    const limiteRaw = Number(req.query.limite || 180);
    const limite = Number.isInteger(limiteRaw) ? Math.max(1, Math.min(limiteRaw, 500)) : 180;
    const result = await pool.query(`
      WITH resumen AS (
        SELECT tt.fecha,
               COUNT(th.id)::int AS mediciones,
               TO_CHAR(MIN(th.hora),'HH24:MI') AS primera_hora,
               TO_CHAR(MAX(th.hora),'HH24:MI') AS ultima_hora,
               MAX(th.updated_at) AS updated_at
        FROM temperatura_turnos tt
        JOIN temperatura_horas th ON th.turno_id=tt.id
        GROUP BY tt.fecha
      ), promedios AS (
        SELECT tt.fecha, pt.codigo, ROUND(AVG(td.valor)::numeric, 2) AS promedio
        FROM temperatura_turnos tt
        JOIN temperatura_horas th ON th.turno_id=tt.id
        JOIN temperatura_detalle td ON td.registro_hora_id=th.id
        JOIN puntos_temperatura pt ON pt.id=td.punto_temperatura_id
        GROUP BY tt.fecha, pt.codigo
      ), promedios_json AS (
        SELECT fecha, jsonb_object_agg(codigo, promedio ORDER BY codigo) AS promedios
        FROM promedios
        GROUP BY fecha
      )
      SELECT TO_CHAR(r.fecha,'YYYY-MM-DD') AS fecha,
             r.mediciones,
             r.primera_hora AS "primeraHora",
             r.ultima_hora AS "ultimaHora",
             r.updated_at AS "updatedAt",
             COALESCE(pj.promedios, '{}'::jsonb) AS promedios
      FROM resumen r
      LEFT JOIN promedios_json pj ON pj.fecha=r.fecha
      ORDER BY r.fecha DESC
      LIMIT $1
    `, [limite]);
    const ultimaActualizacion = result.rows.reduce((max, item) => {
      const valor = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      return valor > max ? valor : max;
    }, 0);
    res.json({
      items: result.rows,
      total: result.rows.length,
      ultimaActualizacion: ultimaActualizacion ? new Date(ultimaActualizacion).toISOString() : null
    });
  } catch (error) {
    console.error('Error obteniendo resumen de temperaturas:', error);
    res.status(500).json({ error: 'No fue posible obtener el resumen del historial de temperaturas.' });
  }
});


app.get('/api/digitacion/temperaturas/exportar', async (req, res) => {
  try {
    const [resumenRes, detalleRes, puntosRes] = await Promise.all([
      pool.query(`
        WITH resumen AS (
          SELECT tt.fecha,
                 COUNT(th.id)::int AS mediciones,
                 TO_CHAR(MIN(th.hora),'HH24:MI') AS primera_hora,
                 TO_CHAR(MAX(th.hora),'HH24:MI') AS ultima_hora,
                 MAX(th.updated_at) AS updated_at
          FROM temperatura_turnos tt
          JOIN temperatura_horas th ON th.turno_id=tt.id
          GROUP BY tt.fecha
        ), promedios AS (
          SELECT tt.fecha, pt.codigo, ROUND(AVG(td.valor)::numeric, 2) AS promedio
          FROM temperatura_turnos tt
          JOIN temperatura_horas th ON th.turno_id=tt.id
          JOIN temperatura_detalle td ON td.registro_hora_id=th.id
          JOIN puntos_temperatura pt ON pt.id=td.punto_temperatura_id
          GROUP BY tt.fecha, pt.codigo
        ), promedios_json AS (
          SELECT fecha, jsonb_object_agg(codigo, promedio ORDER BY codigo) AS promedios
          FROM promedios
          GROUP BY fecha
        )
        SELECT TO_CHAR(r.fecha,'YYYY-MM-DD') AS fecha,
               r.mediciones,
               r.primera_hora AS "primeraHora",
               r.ultima_hora AS "ultimaHora",
               r.updated_at AS "updatedAt",
               COALESCE(pj.promedios, '{}'::jsonb) AS promedios
        FROM resumen r
        LEFT JOIN promedios_json pj ON pj.fecha=r.fecha
        ORDER BY r.fecha DESC
      `),
      pool.query(`
        SELECT th.id, TO_CHAR(tt.fecha,'YYYY-MM-DD') AS fecha, tt.turno,
               TO_CHAR(th.hora,'HH24:MI') AS hora,
               th.proceso_id AS "procesoId", p.num_proceso AS "numProceso",
               th.estado_asociacion AS "estadoAsociacion",
               pt.codigo, pt.nombre, pt.categoria, pt.orden, td.valor
        FROM temperatura_horas th
        JOIN temperatura_turnos tt ON tt.id=th.turno_id
        LEFT JOIN procesos p ON p.id=th.proceso_id
        LEFT JOIN temperatura_detalle td ON td.registro_hora_id=th.id
        LEFT JOIN puntos_temperatura pt ON pt.id=td.punto_temperatura_id
        ORDER BY tt.fecha DESC,
                 CASE WHEN tt.turno='Dia' THEN 0 ELSE 1 END,
                 th.fecha_hora ASC, pt.orden ASC, pt.id ASC
      `),
      pool.query(`SELECT id, codigo, nombre, categoria, orden FROM puntos_temperatura ORDER BY orden, id`)
    ]);

    const detalleMap = new Map();
    for (const row of detalleRes.rows) {
      if (!detalleMap.has(row.id)) {
        detalleMap.set(row.id, {
          id: row.id,
          fecha: row.fecha,
          turno: row.turno,
          hora: row.hora,
          procesoId: row.procesoId,
          numProceso: row.numProceso,
          estadoAsociacion: row.estadoAsociacion,
          mediciones: {}
        });
      }
      if (row.codigo) detalleMap.get(row.id).mediciones[row.codigo] = row.valor === null ? null : Number(row.valor);
    }

    const ultimaActualizacion = resumenRes.rows.reduce((max, item) => {
      const valor = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      return valor > max ? valor : max;
    }, 0);

    res.json({
      resumen: resumenRes.rows,
      detalle: Array.from(detalleMap.values()),
      puntos: puntosRes.rows,
      totalRegistros: detalleMap.size,
      ultimaActualizacion: ultimaActualizacion ? new Date(ultimaActualizacion).toISOString() : null
    });
  } catch (error) {
    console.error('Error preparando exportación de temperaturas:', error);
    res.status(500).json({ error: 'No fue posible preparar la exportación completa de temperaturas.' });
  }
});

app.get('/api/digitacion/temperaturas/dia', async (req, res) => {
  try {
    const fecha = validarFechaTemperatura(req.query.fecha);
    if (!fecha) return res.status(400).json({ error: 'La fecha es obligatoria.' });
    const [Dia, Noche] = await Promise.all([
      obtenerTurnoTemperaturas(pool, fecha, 'Dia'),
      obtenerTurnoTemperaturas(pool, fecha, 'Noche')
    ]);
    const turnos = { Dia, Noche };
    const horas = [...Dia.horas, ...Noche.horas];
    const ultimaActualizacion = horas.reduce((max, h) => {
      const value = h.updatedAt ? new Date(h.updatedAt).getTime() : 0;
      return value > max ? value : max;
    }, 0);
    res.json({
      fecha,
      serverTime: new Date().toISOString(),
      ultimaActualizacion: ultimaActualizacion ? new Date(ultimaActualizacion).toISOString() : null,
      totalRegistros: horas.length,
      totalDia: Dia.horas.length,
      totalNoche: Noche.horas.length,
      kpis: calcularKpisTemperatura(turnos),
      turnos
    });
  } catch (error) {
    console.error('Error obteniendo resumen diario de temperaturas:', error);
    res.status(500).json({ error: 'No fue posible obtener el resumen diario de temperaturas.' });
  }
});

app.post('/api/digitacion/temperaturas/guardar-hora', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await guardarHoraTemperatura(client, req.body || {});
    await client.query('COMMIT');
    res.json(resultado);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error guardando temperatura horaria:', error);
    res.status(error.status || 500).json({ error: error.message || 'No fue posible guardar la temperatura.' });
  } finally {
    client.release();
  }
});

app.post('/api/digitacion/temperaturas/importar-lote', async (req, res) => {
  const client = await pool.connect();
  try {
    const registros = Array.isArray(req.body?.registros) ? req.body.registros : [];
    if (!registros.length) throw Object.assign(new Error('No se recibieron registros para importar.'), { status: 400 });
    if (registros.length > 500) throw Object.assign(new Error('La importación admite un máximo de 500 registros por lote.'), { status: 400 });
    await client.query('BEGIN');
    const resultados = [];
    for (const registro of registros) resultados.push(await guardarHoraTemperatura(client, registro));
    await client.query('COMMIT');
    res.json({ success: true, importados: resultados.length, resultados });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error importando temperaturas:', error);
    res.status(error.status || 500).json({ error: error.message || 'No fue posible importar las temperaturas.' });
  } finally {
    client.release();
  }
});

app.post('/api/digitacion/temperaturas/reasociar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fecha = validarFechaTemperatura(req.body?.fecha);
    const turno = normalizarTurnoTemperatura(req.body?.turno);
    if (!fecha || !turno) throw Object.assign(new Error('Fecha y turno son obligatorios.'), { status: 400 });
    const actualizados = await reasociarTemperaturasTurno(client, fecha, turno);
    await client.query('COMMIT');
    res.json({ success: true, fecha, turno, actualizados });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error reasociando temperaturas:', error);
    res.status(error.status || 500).json({ error: error.message || 'No fue posible recalcular las asociaciones.' });
  } finally {
    client.release();
  }
});
// =========================================================================
// MODO COLABORATIVO
// =========================================================================
async function cargarCajasProcesoColaborativo(client, procesoId) {
  const result = await client.query(`
    SELECT c.id as caja_id, c.num_caja as "numCaja", c.frutos_evaluados as frutos,
           c.calibre, c.brix, c.color_embalaje as color, c.observacion, c.usuario_id as "usuarioId",
           CASE WHEN u.username IS NOT NULL THEN u.username WHEN NULLIF(BTRIM(c.usuario_nombre),'') IS NOT NULL AND LOWER(BTRIM(c.usuario_nombre))<>'usuario' THEN c.usuario_nombre ELSE NULL END as usuario,
           d.nombre as defecto, cd.cantidad, COALESCE(cd.tipo, d.tipo) as tipo_defecto
    FROM cajas c
    LEFT JOIN usuarios u ON u.id = c.usuario_id
    LEFT JOIN caja_defectos cd ON c.id = cd.caja_id
    LEFT JOIN defectos d ON cd.defecto_id = d.id
    WHERE c.proceso_id = $1
    ORDER BY c.id ASC
  `, [procesoId]);
  const cajasMap = {};
  result.rows.forEach(row => {
    if (!cajasMap[row.caja_id]) {
      cajasMap[row.caja_id] = {
        id: row.caja_id, numCaja: row.numCaja, frutos: row.frutos,
        calibre: row.calibre || '', brix: row.brix, color: row.color, observacion: row.observacion || '', usuarioId: row.usuarioId || null, usuario: row.usuario || 'Sin registro',
        defCalidad: {}, defCondicion: {}
      };
    }
    if (!row.defecto || Number(row.cantidad) <= 0) return;
    if (row.tipo_defecto === 'calidad') cajasMap[row.caja_id].defCalidad[row.defecto] = row.cantidad;
    else if (row.tipo_defecto === 'condicion') cajasMap[row.caja_id].defCondicion[row.defecto] = row.cantidad;
  });
  return Object.values(cajasMap);
}
// Solo puede existir UN proceso colaborativo En curso a la vez.
app.get('/api/procesos/colaborativo/activos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.num_proceso as "numProceso", p.fecha, p.estado,
             p.hora_inicio as "horaInicio", e.nombre as exportadora,
             h.csg, h.productor, h.nombre_huerto as huerto, v.nombre as variedad,
             COUNT(c.id)::int as "cajasGuardadas"
      FROM procesos p
      JOIN exportadoras e ON p.exportadora_id = e.id
      JOIN huertos h ON p.huerto_id = h.id
      JOIN variedades v ON p.variedad_id = v.id
      LEFT JOIN cajas c ON c.proceso_id = p.id
      WHERE p.estado = 'En curso'
      GROUP BY p.id, e.nombre, h.csg, h.productor, h.nombre_huerto, v.nombre
      ORDER BY p.hora_inicio DESC NULLS LAST, p.id DESC
    `);
    res.json(result.rows.map(proceso => { const usuariosProceso = obtenerParticipantesProceso(proceso.id); return { ...proceso, usuariosActivos: usuariosProceso.length, usuariosProceso, maxUsuarios: MAX_USUARIOS_PROCESO }; }));
  } catch (error) {
    console.error('Error obteniendo proceso colaborativo activo:', error);
    res.status(500).json({ error: 'No fue posible obtener el proceso activo.' });
  }
});
app.get('/api/procesos/colaborativo/activo-detalle', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT p.id, p.num_proceso as "numProceso", p.fecha, p.estado,
             p.hora_inicio as "horaInicio", p.parametros_snapshot as "parametrosSnapshot",
             e.nombre as exportadora, h.csg, h.productor, h.nombre_huerto as huerto, v.nombre as variedad
      FROM procesos p
      JOIN exportadoras e ON p.exportadora_id = e.id
      JOIN huertos h ON p.huerto_id = h.id
      JOIN variedades v ON p.variedad_id = v.id
      WHERE p.estado = 'En curso'
      ORDER BY p.hora_inicio DESC NULLS LAST, p.id DESC
      LIMIT 1
    `);
    if (!result.rows.length) return res.json({ status: 'waiting' });
    const proceso = result.rows[0];
    proceso.cajas = await cargarCajasProcesoColaborativo(client, proceso.id);
    res.json(proceso);
  } catch (error) {
    console.error('Error obteniendo detalle del proceso activo:', error);
    res.status(500).json({ error: 'No fue posible obtener el proceso activo.' });
  } finally {
    client.release();
  }
});
// Crea un proceso SOLO si no existe otro En curso. Si ya existe el mismo número, se une.
app.post('/api/procesos/colaborativo/iniciar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { numProceso, exportadora, csg, variedad, fecha, horaInicio, clientId, preferredCaja, usuarioId, username } = req.body || {};
    const numero = Number(numProceso);
    if (!Number.isInteger(numero) || numero < 1) throw new Error('El número de proceso no es válido.');
    // Candado global: dos tablets no pueden crear dos procesos En curso al mismo tiempo.
    await client.query('SELECT pg_advisory_xact_lock($1)', [20261008]);
    const activos = await client.query(`
      SELECT p.id, p.num_proceso as "numProceso", p.estado,
             (SELECT COUNT(*)::int FROM cajas c WHERE c.proceso_id = p.id) as "cajasGuardadas"
      FROM procesos p
      WHERE p.estado = 'En curso'
      ORDER BY p.id DESC
      FOR UPDATE
    `);
    if (activos.rows.length > 1) {
      const error = new Error('Se detectó más de un proceso En curso. Deben regularizarse antes de continuar.');
      error.status = 409; error.code = 'MULTIPLES_PROCESOS_ACTIVOS'; throw error;
    }
    let procesoId, esUnion = false;
    const activo = activos.rows[0] || null;
    if (activo) {
      if (Number(activo.numProceso) !== numero) {
        const error = new Error(`El proceso N° ${activo.numProceso} sigue En curso. Debes finalizarlo o descartarlo antes de crear otro proceso.`);
        error.status = 409; error.code = 'PROCESO_ACTIVO'; error.procesoActivo = activo; throw error;
      }
      procesoId = activo.id;
      esUnion = true;
    } else {
      const historial = await client.query('SELECT id, estado FROM procesos WHERE num_proceso = $1 ORDER BY id DESC LIMIT 1', [numero]);
      if (historial.rows.length) {
        const error = new Error(`El proceso ${numero} ya fue finalizado (${historial.rows[0].estado}). Usa otro N° de proceso.`);
        error.status = 409; error.code = 'PROCESO_EXISTENTE'; throw error;
      }
      if (!exportadora || !csg || !variedad) throw new Error('Exportadora, CSG y variedad son obligatorios para crear un proceso nuevo.');
      const expRes = await client.query('SELECT id FROM exportadoras WHERE nombre = $1', [exportadora]);
      const varRes = await client.query('SELECT id FROM variedades WHERE nombre = $1', [variedad]);
      const huertoRes = await client.query('SELECT id FROM huertos WHERE csg = $1', [csg]);
      if (!expRes.rows.length) throw new Error(`La exportadora "${exportadora}" no existe.`);
      if (!varRes.rows.length) throw new Error(`La variedad "${variedad}" no existe.`);
      if (!huertoRes.rows.length) throw new Error(`El huerto con CSG "${csg}" no existe.`);
      const parametrosSnapshot = await obtenerParametros(client);
      const insertRes = await client.query(
        `INSERT INTO procesos (num_proceso, exportadora_id, huerto_id, variedad_id, estado, hora_inicio, fecha, parametros_snapshot)
         VALUES ($1, $2, $3, $4, 'En curso', $5, $6, $7::jsonb) RETURNING id`,
        [numero, expRes.rows[0].id, huertoRes.rows[0].id, varRes.rows[0].id,
         horaInicio || new Date().toISOString(), fecha || null, JSON.stringify(parametrosSnapshot)]
      );
      procesoId = insertRes.rows[0].id;
    }
    // Cada inspector reserva su número visual al entrar. El creador recibe Caja 1 y quienes se unen reciben la siguiente libre.
    const cajasNumRes = await client.query('SELECT num_caja FROM cajas WHERE proceso_id = $1 ORDER BY num_caja', [procesoId]);
    const numerosGuardados = cajasNumRes.rows.map(r => Number(r.num_caja));
    const nextCaja = numerosGuardados.length ? Math.max(...numerosGuardados) + 1 : 1;
    const idCliente = clientId ? String(clientId) : null;
    if (idCliente) {
      const participantes = obtenerParticipantesProceso(procesoId);
      const yaPertenece = participantes.some(p => (Number(usuarioId) > 0 && Number(p.usuarioId) === Number(usuarioId)) || String(p.clientId) === idCliente);
      if (!yaPertenece && participantes.length >= MAX_USUARIOS_PROCESO) {
        const error = new Error(`Este proceso ya alcanzó el máximo de ${MAX_USUARIOS_PROCESO} usuarios.`);
        error.status = 409; error.code = 'LIMITE_USUARIOS'; throw error;
      }
    }
    const nextCajaVisual = idCliente ? reservarCajaCliente(procesoId, idCliente, numerosGuardados, preferredCaja, { usuarioId, username }) : nextCaja;
    const cajasPrevias = await cargarCajasProcesoColaborativo(client, procesoId);
    const usuariosProceso = obtenerParticipantesProceso(procesoId);
    await client.query('COMMIT');
    res.json({ success: true, procesoId, clientId: idCliente, nextCaja, nextCajaVisual, cajasPrevias, esUnion, usuariosProceso, usuariosEnProceso: usuariosProceso.length, maxUsuarios: MAX_USUARIOS_PROCESO, mensaje: esUnion ? 'Te uniste al proceso exitosamente' : 'Proceso creado' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(error.status || 400).json({ error: error.message, code: error.code, procesoActivo: error.procesoActivo });
  } finally {
    client.release();
  }
});
app.get('/api/procesos/colaborativo/:id/estado', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Proceso no válido.' });
    const proceso = await pool.query(`SELECT estado, (foto_light IS NOT NULL) as "fotoLight", (foto_dark IS NOT NULL) as "fotoDark", (SELECT COUNT(*)::int FROM cajas WHERE proceso_id = procesos.id) as "cajasGuardadas" FROM procesos WHERE id = $1`, [id]);
    if (!proceso.rows.length) return res.status(404).json({ error: 'El proceso ya no existe.', estado: 'Eliminado' });
    const sesiones = obtenerSesionesActivasProceso(id);
    const otrosInspectoresActivos = obtenerSesionesActivasProceso(id, req.query.clientId).length;
    const inspectoresActivos = Math.max(1, sesiones.length);
    const usuariosProceso = obtenerParticipantesProceso(id);
    res.json({ success: true, estado: proceso.rows[0].estado, otrosInspectoresActivos, inspectoresActivos, usuariosEnProceso: Math.max(1, usuariosProceso.length), usuariosProceso, maxUsuarios: MAX_USUARIOS_PROCESO, cajasGuardadas: Number(proceso.rows[0].cajasGuardadas) || 0, fotoLight: Boolean(proceso.rows[0].fotoLight), fotoDark: Boolean(proceso.rows[0].fotoDark) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Consulta/mantiene la caja reservada para este inspector.
app.get('/api/procesos/colaborativo/:id/siguiente-caja', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Proceso no válido.' });
    const proceso = await pool.query('SELECT estado FROM procesos WHERE id = $1', [id]);
    if (!proceso.rows.length) return res.status(404).json({ error: 'El proceso ya no existe.' });
    if (proceso.rows[0].estado !== 'En curso') return res.status(409).json({ error: `El proceso ya fue cerrado (${proceso.rows[0].estado}).`, estado: proceso.rows[0].estado });
    const cajasRes = await pool.query('SELECT num_caja FROM cajas WHERE proceso_id = $1 ORDER BY num_caja', [id]);
    const numerosGuardados = cajasRes.rows.map(r => Number(r.num_caja));
    const nextCaja = numerosGuardados.length ? Math.max(...numerosGuardados) + 1 : 1;
    const idCliente = req.query.clientId ? String(req.query.clientId) : null;
    const preferredCaja = req.query.preferredCaja ? Number(req.query.preferredCaja) : null;
    const nextCajaVisual = idCliente ? reservarCajaCliente(id, idCliente, numerosGuardados, preferredCaja) : nextCaja;
    const otrosInspectoresActivos = obtenerSesionesActivasProceso(id, idCliente).length;
    const inspectoresActivos = Math.max(1, obtenerSesionesActivasProceso(id).length);
    const usuariosProceso = obtenerParticipantesProceso(id);
    res.json({ success: true, nextCaja, nextCajaVisual, cajasGuardadas: numerosGuardados.length, otrosInspectoresActivos, inspectoresActivos, usuariosEnProceso: Math.max(1, usuariosProceso.length), usuariosProceso, maxUsuarios: MAX_USUARIOS_PROCESO });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/procesos/colaborativo/:id/fotografias', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tipo = String(req.body?.tipo || '').toLowerCase();
    const imagen = String(req.body?.imagen || '');
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Proceso no válido.' });
    if (!['light', 'dark'].includes(tipo)) return res.status(400).json({ error: 'Tipo de fotografía no válido.' });
    if (!imagen.startsWith('data:image/')) return res.status(400).json({ error: 'La fotografía no tiene un formato válido.' });
    if (imagen.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'La fotografía es demasiado grande.' });
    const columna = tipo === 'light' ? 'foto_light' : 'foto_dark';
    const result = await pool.query(`UPDATE procesos SET ${columna} = $1 WHERE id = $2 AND estado = 'En curso' RETURNING (foto_light IS NOT NULL) as "fotoLight", (foto_dark IS NOT NULL) as "fotoDark"`, [imagen, id]);
    if (!result.rows.length) return res.status(409).json({ error: 'El proceso ya no está en curso.' });
    res.json({ success: true, fotoLight: Boolean(result.rows[0].fotoLight), fotoDark: Boolean(result.rows[0].fotoDark) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/procesos/colaborativo/abandonar', (req, res) => {
  const procesoId = Number(req.body?.procesoId);
  const clientId = req.body?.clientId ? String(req.body.clientId) : '';
  if (!Number.isInteger(procesoId) || procesoId < 1 || !clientId) return res.status(400).json({ error: 'Proceso o usuario no válido.' });
  const otrosActivos = obtenerSesionesActivasProceso(procesoId, clientId);
  if (!otrosActivos.length) return res.status(409).json({ error: 'No puedes abandonar: eres el único usuario activo en la inspección.' });
  liberarReservaCliente(clientId);
  liveSessions.delete(clientId);
  res.json({ success: true, inspectoresActivos: Math.max(1, obtenerSesionesActivasProceso(procesoId).length) });
});
// Al guardar se valida nuevamente la BD para resolver concurrencia entre tablets.
// El número mostrado antes de guardar es tentativo; solo se consume si el INSERT termina correctamente.
app.post('/api/procesos/colaborativo/caja', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { procesoId, caja, clientId, usuarioId, username } = req.body || {};
    const id = Number(procesoId);
    if (!Number.isInteger(id) || id < 1 || !caja) throw new Error('Proceso o caja no válidos.');
    await client.query('SELECT pg_advisory_xact_lock(20261007, $1)', [id]);
    const proceso = await client.query('SELECT estado FROM procesos WHERE id = $1 FOR UPDATE', [id]);
    if (!proceso.rows.length) { const error = new Error('El proceso ya no existe.'); error.status = 404; throw error; }
    if (proceso.rows[0].estado !== 'En curso') { const error = new Error(`El proceso ya fue cerrado (${proceso.rows[0].estado}).`); error.status = 409; throw error; }
    const usadosRes = await client.query('SELECT num_caja FROM cajas WHERE proceso_id = $1 ORDER BY num_caja', [id]);
    const numerosGuardados = usadosRes.rows.map(r => Number(r.num_caja));
    const idCliente = clientId ? String(clientId) : null;
    const numCajaAInsertar = numerosGuardados.length ? Math.max(...numerosGuardados) + 1 : 1;
    const observacion = normalizarObservacionCaja(caja.observacion);
    const usuarioCaja = await resolverUsuarioCaja(client, usuarioId, username);
    const cajaRes = await client.query(
      `INSERT INTO cajas (proceso_id, num_caja, frutos_evaluados, calibre, brix, color_embalaje, observacion, usuario_id, usuario_nombre)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [id, numCajaAInsertar, caja.frutos === '' ? 0 : caja.frutos, caja.calibre || null, caja.brix || null, caja.color, observacion, usuarioCaja.usuarioId, usuarioCaja.usuario]
    );
    await guardarDefectosCaja(client, cajaRes.rows[0].id, caja);
    const guardadasActualizadasRes = await client.query('SELECT num_caja FROM cajas WHERE proceso_id = $1 ORDER BY num_caja', [id]);
    const guardadasActualizadas = guardadasActualizadasRes.rows.map(r => Number(r.num_caja));
    const nextCaja = guardadasActualizadas.length ? Math.max(...guardadasActualizadas) + 1 : 1;
    await client.query('COMMIT');
    let nextCajaVisual = nextCaja;
    if (idCliente) {
      liberarReservaCliente(idCliente);
      nextCajaVisual = reservarCajaCliente(id, idCliente, guardadasActualizadas) || nextCaja;
    }
    res.json({ success: true, cajaGuardada: { ...caja, observacion: observacion || '', id: cajaRes.rows[0].id, numCaja: numCajaAInsertar, usuarioId: usuarioCaja.usuarioId, usuario: usuarioCaja.usuario }, nextCaja, nextCajaVisual });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(error.status || 500).json({ error: error.message });
  } finally {
    client.release();
  }
});
app.patch('/api/procesos/colaborativo/caja/:id/observacion', async (req, res) => {
  try {
    const cajaId = Number(req.params.id);
    if (!Number.isInteger(cajaId) || cajaId < 1) return res.status(400).json({ error: 'Caja no válida.' });
    const observacion = normalizarObservacionCaja(req.body?.observacion);
    const result = await pool.query(`
      UPDATE cajas c
      SET observacion=$1
      FROM procesos p
      WHERE c.id=$2 AND c.proceso_id=p.id AND p.estado='En curso'
      RETURNING c.id, COALESCE(c.observacion,'') AS observacion
    `, [observacion, cajaId]);
    if (!result.rows.length) return res.status(409).json({ error: 'La caja ya no puede editarse porque el proceso no está en curso.' });
    res.json({ success: true, ...result.rows[0] });
  } catch (error) {
    console.error('Error actualizando observación de caja:', error);
    res.status(error.status || 500).json({ error: error.message || 'No fue posible actualizar la observación.' });
  }
});
app.delete('/api/procesos/colaborativo/caja/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cajaId = Number(req.params.id);
    if (!Number.isInteger(cajaId) || cajaId < 1) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Caja no válida.' }); }
    const caja = await client.query(`SELECT c.id, c.proceso_id FROM cajas c JOIN procesos p ON p.id=c.proceso_id WHERE c.id=$1 AND p.estado='En curso' FOR UPDATE`, [cajaId]);
    if (!caja.rows.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'La caja ya no existe o el proceso no está en curso.' }); }
    await client.query('DELETE FROM caja_defectos WHERE caja_id=$1', [cajaId]);
    await client.query('DELETE FROM cajas WHERE id=$1', [cajaId]);
    await client.query('COMMIT');
    res.json({ success: true, procesoId: caja.rows[0].proceso_id });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: error.message });
  } finally { client.release(); }
});
// Libera únicamente la caja reservada por el inspector que sale del proceso.
app.post('/api/procesos/colaborativo/cancelar-caja', (req, res) => {
  liberarReservaCliente(req.body?.clientId);
  res.json({ success: true });
});
// Cancela un proceso En curso. Si está vacío se elimina; si ya tiene cajas, se conserva como Cancelado.
app.post('/api/procesos/colaborativo/descartar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.body?.procesoId);
    const clientId = req.body?.clientId ? String(req.body.clientId) : null;
    const forzar = req.body?.forzar === true;
    if (!Number.isInteger(id) || id < 1) throw new Error('Proceso no válido.');
    await client.query('SELECT pg_advisory_xact_lock($1)', [20261008]);
    await client.query('SELECT pg_advisory_xact_lock(20261007, $1)', [id]);
    const proceso = await client.query('SELECT estado FROM procesos WHERE id = $1 FOR UPDATE', [id]);
    if (!proceso.rows.length) { await client.query('COMMIT'); return res.json({ success: true, eliminado: false, cancelado: false, mensaje: 'El proceso ya no existe.' }); }
    if (proceso.rows[0].estado !== 'En curso') { await client.query('COMMIT'); return res.json({ success: true, eliminado: false, cancelado: false, estado: proceso.rows[0].estado, mensaje: 'El proceso ya estaba cerrado.' }); }
    const cajasRes = await client.query('SELECT COUNT(*)::int as total FROM cajas WHERE proceso_id = $1', [id]);
    const cajasGuardadas = Number(cajasRes.rows[0].total);
    const otrosInspectoresActivos = obtenerSesionesActivasProceso(id, clientId).length;
    if (otrosInspectoresActivos > 0 && !forzar) {
      await client.query('ROLLBACK');
      return res.status(409).json({ code: 'OTROS_INSPECTORES', cajasGuardadas, otrosInspectoresActivos, error: 'Hay otro usuario inspeccionando este proceso. Puedes abandonar tu sesión o cancelar el proceso explícitamente para todos los usuarios.' });
    }
    if (cajasGuardadas === 0) {
      await client.query(`UPDATE temperatura_horas SET proceso_id=NULL, estado_asociacion='pendiente', updated_at=NOW() WHERE proceso_id=$1`, [id]);
      await client.query('DELETE FROM procesos WHERE id = $1', [id]);
      await client.query('COMMIT');
      limpiarSesionesProceso(id); limpiarReservasProceso(id);
      return res.json({ success: true, eliminado: true, cancelado: false, cajasGuardadas: 0 });
    }
    await client.query(`UPDATE procesos SET estado = 'Cancelado', hora_fin = COALESCE(hora_fin, NOW()) WHERE id = $1`, [id]);
    await reasociarTemperaturasPorProceso(client, id);
    await client.query('COMMIT');
    limpiarSesionesProceso(id); limpiarReservasProceso(id);
    res.json({ success: true, eliminado: false, cancelado: true, estado: 'Cancelado', cajasGuardadas, otrosInspectoresActivos });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    res.status(error.status || 500).json({ error: error.message });
  } finally {
    client.release();
  }
});
app.post('/api/procesos/colaborativo/finalizar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { procesoId, estadoGlobal, horaFin, clientId, forzar } = req.body || {};
    const id = Number(procesoId);
    if (!Number.isInteger(id) || id < 1) throw new Error('Proceso no válido.');
    await client.query('SELECT pg_advisory_xact_lock($1)', [20261008]);
    await client.query('SELECT pg_advisory_xact_lock(20261007, $1)', [id]);
    const proceso = await client.query(`SELECT estado, (foto_light IS NOT NULL) as "fotoLight", (foto_dark IS NOT NULL) as "fotoDark" FROM procesos WHERE id = $1 FOR UPDATE`, [id]);
    if (!proceso.rows.length || proceso.rows[0].estado !== 'En curso') {
      const error = new Error(proceso.rows.length ? `El proceso ya fue cerrado (${proceso.rows[0].estado}).` : 'El proceso ya no existe.');
      error.status = 409; error.code = 'PROCESO_CERRADO'; throw error;
    }
    const faltanFotos = [];
    if (!proceso.rows[0].fotoLight) faltanFotos.push('Light');
    if (!proceso.rows[0].fotoDark) faltanFotos.push('Dark');
    if (faltanFotos.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Faltan fotografías de embalaje: ${faltanFotos.join(' y ')}.`, code: 'FOTOS_REQUERIDAS', faltanFotos });
    }
    const otrosInspectores = obtenerSesionesProceso(id, clientId);
    if (otrosInspectores.length > 0 && forzar !== true) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Hay ${otrosInspectores.length} usuario${otrosInspectores.length === 1 ? '' : 's'} actualmente en inspección.`,
        code: 'OTROS_INSPECTORES_ACTIVOS', inspectoresActivos: otrosInspectores.length
      });
    }
    const updated = await client.query(
      `UPDATE procesos SET estado = $1, hora_fin = $2 WHERE id = $3 AND estado = 'En curso' RETURNING id`,
      [estadoGlobal, horaFin || new Date().toISOString(), id]
    );
    if (!updated.rows.length) { const error = new Error('El proceso ya no está en curso o no existe.'); error.status = 409; throw error; }
    await reasociarTemperaturasPorProceso(client, id);
    await client.query('COMMIT');
    limpiarSesionesProceso(id); limpiarReservasProceso(id);
    res.json({ success: true, inspectoresDesconectados: otrosInspectores.length });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    res.status(error.status || 500).json({ error: error.message, code: error.code });
  } finally {
    client.release();
  }
});
// =========================================================================
// =========================================================================
// ==========================================
// MÉTODOS TRADICIONALES (Mantenidos por compatibilidad)
// ==========================================
app.post('/api/inspecciones', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { numProceso, exportadora, csg, variedad, estado, cajas, horaInicio, horaFin, fecha, fotoLight, fotoDark, usuarioId, username } = req.body;
    if (!fotoLight || !fotoDark) throw new Error('Debes ingresar las fotografías de embalaje Light y Dark antes de finalizar.');
    const expRes = await client.query('SELECT id FROM exportadoras WHERE nombre = $1', [exportadora]);
    if (expRes.rows.length === 0) throw new Error(`La exportadora "${exportadora}" no existe.`);
    const varRes = await client.query('SELECT id FROM variedades WHERE nombre = $1', [variedad]);
    if (varRes.rows.length === 0) throw new Error(`La variedad "${variedad}" no existe.`);
    const huertoRes = await client.query('SELECT id FROM huertos WHERE csg = $1', [csg]);
    if (huertoRes.rows.length === 0) throw new Error(`El huerto con CSG "${csg}" no existe.`);
    const parametrosSnapshot = await obtenerParametros(client);
    const procRes = await client.query(
      `INSERT INTO procesos (
        num_proceso, exportadora_id, huerto_id, variedad_id, estado,
        hora_inicio, hora_fin, fecha, parametros_snapshot, foto_light, foto_dark
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
      RETURNING id`,
      [
        numProceso,
        expRes.rows[0].id,
        huertoRes.rows[0].id,
        varRes.rows[0].id,
        estado || 'Aprobado',
        horaInicio || null,
        horaFin || null,
        fecha || null,
        JSON.stringify(parametrosSnapshot),
        fotoLight,
        fotoDark
      ]
    );
    const procesoId = procRes.rows[0].id;
    for (const caja of cajas) {
      const frutosVal = caja.frutos === '' ? 0 : caja.frutos;
      const brixVal = caja.brix === '' ? null : caja.brix;
      const calibreVal = caja.calibre === '' ? null : caja.calibre;
      const usuarioCaja = await resolverUsuarioCaja(client, caja.usuarioId || usuarioId, caja.usuario || caja.username || username);
      const cajaRes = await client.query(
        `INSERT INTO cajas (proceso_id, num_caja, frutos_evaluados, calibre, brix, color_embalaje, observacion, usuario_id, usuario_nombre) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [procesoId, caja.numCaja || 1, frutosVal, calibreVal, brixVal, caja.color, normalizarObservacionCaja(caja.observacion), usuarioCaja.usuarioId, usuarioCaja.usuario]
      );
      await guardarDefectosCaja(client, cajaRes.rows[0].id, caja);
    }
    await reasociarTemperaturasPorProceso(client, procesoId);
    await client.query('COMMIT');
    res.json({ success: true, procesoId });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Error de base de datos' });
  } finally {
    client.release();
  }
});
app.get('/api/inspecciones', async (req, res) => {
  try {
    const parametrosActuales = await obtenerParametros();
    const tiposActuales = crearMapaTipos(parametrosActuales);
    const procRes = await pool.query(`
      SELECT
        p.id,
        p.fecha,
        p.num_proceso as "numProceso",
        p.estado,
        p.hora_inicio as "horaInicio",
        p.hora_fin as "horaFin",
        p.parametros_snapshot as "parametrosSnapshot",
        e.nombre as exportadora,
        h.csg,
        h.productor,
        h.nombre_huerto as huerto,
        v.nombre as variedad
      FROM procesos p
      JOIN exportadoras e ON p.exportadora_id = e.id
      JOIN huertos h ON p.huerto_id = h.id
      JOIN variedades v ON p.variedad_id = v.id
      ORDER BY p.id ASC
    `);
    const procesos = procRes.rows;
    if (!procesos.length) return res.json([]);
    const procIds = procesos.map(p => p.id);
    const cajasRes = await pool.query(`
      SELECT
        c.id as caja_id,
        c.proceso_id,
        c.num_caja as "numCaja",
        c.frutos_evaluados as frutos,
        c.calibre,
        c.brix,
        c.color_embalaje as color,
        c.observacion,
        c.usuario_id as "usuarioId",
        CASE WHEN u.username IS NOT NULL THEN u.username WHEN NULLIF(BTRIM(c.usuario_nombre),'') IS NOT NULL AND LOWER(BTRIM(c.usuario_nombre))<>'usuario' THEN c.usuario_nombre ELSE NULL END as usuario,
        d.nombre as defecto,
        cd.cantidad,
        COALESCE(cd.tipo, d.tipo) as tipo_defecto
      FROM cajas c
      LEFT JOIN usuarios u ON u.id = c.usuario_id
      LEFT JOIN caja_defectos cd ON c.id = cd.caja_id
      LEFT JOIN defectos d ON cd.defecto_id = d.id
      WHERE c.proceso_id = ANY($1::int[])
      ORDER BY c.proceso_id ASC, c.id ASC
    `, [procIds]);
    const tiposPorProceso = new Map();
    procesos.forEach(proceso => {
      tiposPorProceso.set(
        proceso.id,
        crearMapaTipos(proceso.parametrosSnapshot || parametrosActuales)
      );
    });
    const cajasMap = {};
    cajasRes.rows.forEach(row => {
      if (!cajasMap[row.caja_id]) {
        cajasMap[row.caja_id] = {
          proceso_id: row.proceso_id,
          numCaja: row.numCaja,
          frutos: row.frutos,
          calibre: row.calibre || '',
          brix: row.brix,
          color: row.color,
          observacion: row.observacion || '',
          usuarioId: row.usuarioId || null,
          usuario: row.usuario || 'Sin registro',
          defCalidad: {},
          defCondicion: {}
        };
      }
      if (!row.defecto || row.cantidad <= 0) return;
      const mapaProceso = tiposPorProceso.get(row.proceso_id) || tiposActuales;
      const tipo = row.tipo_defecto || mapaProceso.get(normalizarNombre(row.defecto));
      if (tipo === 'calidad')
        cajasMap[row.caja_id].defCalidad[row.defecto] = row.cantidad;
      else if (tipo === 'condicion')
        cajasMap[row.caja_id].defCondicion[row.defecto] = row.cantidad;
    });
    procesos.forEach(proceso => {
      proceso.cajas = Object.values(cajasMap)
        .filter(caja => caja.proceso_id === proceso.id);
    });
    res.json(procesos);
  } catch (error) {
    console.error('Error obteniendo inspecciones:', error);
    res.status(500).json({ error: 'Error al obtener inspecciones' });
  }
});
app.put('/api/inspecciones/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const procesoId = req.params.id;
    const { numProceso, exportadora, csg, variedad, estado, cajas, horaInicio, horaFin, fecha } = req.body;
    if (numProceso && exportadora && csg && variedad) {
      const expRes = await client.query('SELECT id FROM exportadoras WHERE nombre = $1', [exportadora]);
      const varRes = await client.query('SELECT id FROM variedades WHERE nombre = $1', [variedad]);
      const huertoRes = await client.query('SELECT id FROM huertos WHERE csg = $1', [csg]);
      await client.query(
        `UPDATE procesos SET num_proceso = $1, exportadora_id = $2, huerto_id = $3, variedad_id = $4, estado = $5,
             hora_inicio = COALESCE($7, hora_inicio), hora_fin = COALESCE($8, hora_fin), fecha = COALESCE($9, fecha)
         WHERE id = $6`,
        [numProceso, expRes.rows[0].id, huertoRes.rows[0].id, varRes.rows[0].id, estado || 'Aprobado', procesoId, horaInicio || null, horaFin || null, fecha || null]
      );
    }
    await client.query('DELETE FROM caja_defectos WHERE caja_id IN (SELECT id FROM cajas WHERE proceso_id = $1)', [procesoId]);
    await client.query('DELETE FROM cajas WHERE proceso_id = $1', [procesoId]);
    for (const caja of cajas) {
      const usuarioCaja = await resolverUsuarioCaja(client, caja.usuarioId, caja.usuario || caja.username);
      const cajaRes = await client.query(
        `INSERT INTO cajas (proceso_id, num_caja, frutos_evaluados, calibre, brix, color_embalaje, observacion, usuario_id, usuario_nombre) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [procesoId, caja.numCaja || 1, caja.frutos === '' ? 0 : caja.frutos, caja.calibre === '' ? null : caja.calibre, caja.brix === '' ? null : caja.brix, caja.color, normalizarObservacionCaja(caja.observacion), usuarioCaja.usuarioId, usuarioCaja.usuario]
      );
      await guardarDefectosCaja(client, cajaRes.rows[0].id, caja);
    }
    await reasociarTemperaturasPorProceso(client, Number(procesoId));
    await client.query('COMMIT');
    res.json({ success: true, message: 'Proceso actualizado correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});
app.delete('/api/inspecciones/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const usuarioId = Number(req.body?.usuarioId || req.query?.usuarioId);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) return res.status(403).json({ error: 'No tienes permiso para eliminar procesos.' });
    const usuarioRes = await client.query('SELECT role, permisos FROM usuarios WHERE id=$1', [usuarioId]);
    if (!usuarioRes.rows.length) return res.status(403).json({ error: 'Usuario no autorizado.' });
    const usuario = usuarioRes.rows[0];
    const puedeEliminar = usuario.role === 'admin' || usuario.permisos?.eliminar_procesos === true;
    if (!puedeEliminar) return res.status(403).json({ error: 'Tu usuario no tiene permiso para eliminar procesos.' });
    await client.query('BEGIN');
    const procesoId = parseInt(req.params.id, 10);
    await client.query(`UPDATE temperatura_horas SET proceso_id=NULL, estado_asociacion='pendiente', updated_at=NOW() WHERE proceso_id=$1`, [procesoId]);
    await client.query('DELETE FROM caja_defectos WHERE caja_id IN (SELECT id FROM cajas WHERE proceso_id = $1)', [procesoId]);
    await client.query('DELETE FROM cajas WHERE proceso_id = $1', [procesoId]);
    await client.query('DELETE FROM procesos WHERE id = $1', [procesoId]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Proceso eliminado con éxito' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});
app.get('/api/procesos/:id/informe', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id AS proceso_id, p.num_proceso as "numProceso", p.fecha, p.hora_inicio as "horaInicio", p.hora_fin as "horaFin",
             h.nombre_huerto AS huerto, h.productor, h.csg, e.nombre AS exportadora, v.nombre AS variedad, p.estado AS nota_estado,
             p.parametros_snapshot as "parametrosSnapshot", p.foto_light as "fotoLight", p.foto_dark as "fotoDark"
      FROM procesos p LEFT JOIN huertos h ON p.huerto_id = h.id LEFT JOIN exportadoras e ON p.exportadora_id = e.id LEFT JOIN variedades v ON p.variedad_id = v.id WHERE p.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proceso no encontrado' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Error al obtener datos' }); }
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 EVAP ${PLANTA_NOMBRE} (${PLANTA_ID}): backend en puerto ${PORT}`);
});
