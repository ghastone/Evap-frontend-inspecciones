require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.connect()
  .then(() => console.log('✅ ¡Conectado a la base de datos PostgreSQL en', process.env.DB_HOST, '!'))
  .catch(err => console.error('❌ Error de conexión a la base de datos', err.stack));

// ==========================================
// RUTAS DE LA API (Endpoints)
// ==========================================

let currentLiveProcess = null;

app.post('/api/live', (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    currentLiveProcess = null;
  } else {
    currentLiveProcess = req.body;
  }
  res.json({ success: true });
});

app.get('/api/live', (req, res) => {
  res.json(currentLiveProcess || { status: 'waiting' });
});

// --- Tablas Maestras ---
app.get('/api/huertos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.id, h.productor, h.nombre_huerto as nombre, h.csg, e.nombre as exportadora 
      FROM huertos h JOIN exportadoras e ON h.exportadora_id = e.id ORDER BY h.productor ASC;
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los huertos' });
  }
});

app.get('/api/exportadoras', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM exportadoras ORDER BY nombre ASC;');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener exportadoras' });
  }
});

app.get('/api/variedades', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM variedades ORDER BY nombre ASC;');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener variedades' });
  }
});

// ==========================================
// 1. GUARDAR UN PROCESO NUEVO (POST)
// ==========================================
app.post('/api/inspecciones', async (req, res) => {
  console.log("¡HOLA! Recibí una petición para guardar el proceso N°:", req.body.numProceso);

  const client = await pool.connect(); 
  try {
    await client.query('BEGIN'); 
    const { numProceso, exportadora, csg, variedad, estado, cajas } = req.body;

    const expRes = await client.query('SELECT id FROM exportadoras WHERE nombre = $1', [exportadora]);
    if (expRes.rows.length === 0) throw new Error(`La exportadora "${exportadora}" no existe.`);

    const varRes = await client.query('SELECT id FROM variedades WHERE nombre = $1', [variedad]);
    if (varRes.rows.length === 0) throw new Error(`La variedad "${variedad}" no existe.`);

    const huertoRes = await client.query('SELECT id FROM huertos WHERE csg = $1', [csg]);
    if (huertoRes.rows.length === 0) throw new Error(`El huerto con CSG "${csg}" no existe.`);

    const procRes = await client.query(
      `INSERT INTO procesos (num_proceso, exportadora_id, huerto_id, variedad_id, estado) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [numProceso, expRes.rows[0].id, huertoRes.rows[0].id, varRes.rows[0].id, estado || 'Aprobado']
    );
    const procesoId = procRes.rows[0].id;

    const defRes = await client.query('SELECT id, nombre FROM defectos');
    const defectosMap = {};
    defRes.rows.forEach(d => { defectosMap[d.nombre] = d.id; });

    for (const caja of cajas) {
      const frutosVal = caja.frutos === '' ? 0 : caja.frutos;
      const brixVal = caja.brix === '' ? null : caja.brix;
      const calibreVal = caja.calibre === '' ? null : caja.calibre;

      const cajaRes = await client.query(
        `INSERT INTO cajas (proceso_id, num_caja, frutos_evaluados, calibre, brix, color_embalaje) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [procesoId, caja.numCaja || 1, frutosVal, calibreVal, brixVal, caja.color]
      );
      
      const todosLosDefectos = { ...(caja.defCalidad || {}), ...(caja.defCondicion || {}) };
      for (const [nombreDefecto, cantidad] of Object.entries(todosLosDefectos)) {
        if (cantidad > 0 && defectosMap[nombreDefecto]) {
          await client.query(
            'INSERT INTO caja_defectos (caja_id, defecto_id, cantidad) VALUES ($1, $2, $3)',
            [cajaRes.rows[0].id, defectosMap[nombreDefecto], cantidad]
          );
        }
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, procesoId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ERROR CRÍTICO GUARDANDO PROCESO:', error.message || error); 
    res.status(500).json({ error: error.message || 'Error de base de datos' });
  } finally {
    client.release();
  }
});

// ==========================================
// 2. OBTENER HISTORIAL DE PROCESOS (GET)
// ==========================================
app.get('/api/inspecciones', async (req, res) => {
  try {
    const procRes = await pool.query(`
      SELECT p.id, p.fecha, p.num_proceso as "numProceso", p.estado, e.nombre as exportadora, h.csg, h.productor, v.nombre as variedad
      FROM procesos p
      JOIN exportadoras e ON p.exportadora_id = e.id
      JOIN huertos h ON p.huerto_id = h.id
      JOIN variedades v ON p.variedad_id = v.id
      ORDER BY p.id ASC
    `);
    
    const procesos = procRes.rows;
    if (procesos.length === 0) return res.json([]);

    const procIds = procesos.map(p => p.id);
    const cajasRes = await pool.query(`
      SELECT c.id as caja_id, c.proceso_id, c.num_caja as "numCaja", c.frutos_evaluados as frutos, 
             c.calibre, c.brix, c.color_embalaje as color, d.nombre as defecto, cd.cantidad
      FROM cajas c
      LEFT JOIN caja_defectos cd ON c.id = cd.caja_id
      LEFT JOIN defectos d ON cd.defecto_id = d.id
      WHERE c.proceso_id = ANY($1::int[])
      ORDER BY c.num_caja ASC
    `, [procIds]);

    const listCalidad = [
      'Frutos deformes / dobles', 'Daños de trips', 'Golpe de sol', 'Manchas', 'Sutura (severa)', 'Herida cicatrizada',
      'Desuniformidad de color', 'Russet', 'Fruta sin pedicelo', 'Falta de color', 'Bajo calibre', 'Sobre calibre'
    ];

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
          defCalidad: {},
          defCondicion: {}
        };
      }
      if (row.defecto && row.cantidad > 0) {
        if (listCalidad.includes(row.defecto)) {
          cajasMap[row.caja_id].defCalidad[row.defecto] = row.cantidad;
        } else {
          cajasMap[row.caja_id].defCondicion[row.defecto] = row.cantidad;
        }
      }
    });

    procesos.forEach(p => {
      p.cajas = Object.values(cajasMap).filter(c => c.proceso_id === p.id);
    });

    res.json(procesos);
  } catch (error) {
    console.error('Error en GET /api/inspecciones:', error);
    res.status(500).json({ error: 'Error al obtener inspecciones' });
  }
});

// ==========================================
// 3. EDITAR/ACTUALIZAR PROCESO COMPLETO (PUT)
// ==========================================
app.put('/api/inspecciones/:id', async (req, res) => {
  const client = await pool.connect(); 
  try {
    await client.query('BEGIN'); 
    const procesoId = req.params.id;
    const { numProceso, exportadora, csg, variedad, estado, cajas } = req.body; 

    if (numProceso && exportadora && csg && variedad) {
      const expRes = await client.query('SELECT id FROM exportadoras WHERE nombre = $1', [exportadora]);
      if (expRes.rows.length === 0) throw new Error(`La exportadora "${exportadora}" no existe.`);

      const varRes = await client.query('SELECT id FROM variedades WHERE nombre = $1', [variedad]);
      if (varRes.rows.length === 0) throw new Error(`La variedad "${variedad}" no existe.`);

      const huertoRes = await client.query('SELECT id FROM huertos WHERE csg = $1', [csg]);
      if (huertoRes.rows.length === 0) throw new Error(`El huerto con CSG "${csg}" no existe.`);

      await client.query(
        `UPDATE procesos 
         SET num_proceso = $1, exportadora_id = $2, huerto_id = $3, variedad_id = $4, estado = $5
         WHERE id = $6`,
        [numProceso, expRes.rows[0].id, huertoRes.rows[0].id, varRes.rows[0].id, estado || 'Aprobado', procesoId]
      );
    }

    await client.query('DELETE FROM caja_defectos WHERE caja_id IN (SELECT id FROM cajas WHERE proceso_id = $1)', [procesoId]);
    await client.query('DELETE FROM cajas WHERE proceso_id = $1', [procesoId]);

    const defRes = await client.query('SELECT id, nombre FROM defectos');
    const defectosMap = {};
    defRes.rows.forEach(d => { defectosMap[d.nombre] = d.id; });

    for (const caja of cajas) {
      const frutosVal = caja.frutos === '' ? 0 : caja.frutos;
      const brixVal = caja.brix === '' ? null : caja.brix;
      const calibreVal = caja.calibre === '' ? null : caja.calibre;

      const cajaRes = await client.query(
        `INSERT INTO cajas (proceso_id, num_caja, frutos_evaluados, calibre, brix, color_embalaje) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [procesoId, caja.numCaja || 1, frutosVal, calibreVal, brixVal, caja.color]
      );

      const todosLosDefectos = { ...(caja.defCalidad || {}), ...(caja.defCondicion || {}) };
      for (const [nombreDefecto, cantidad] of Object.entries(todosLosDefectos)) {
        if (cantidad > 0 && defectosMap[nombreDefecto]) {
          await client.query(
            'INSERT INTO caja_defectos (caja_id, defecto_id, cantidad) VALUES ($1, $2, $3)',
            [cajaRes.rows[0].id, defectosMap[nombreDefecto], cantidad]
          );
        }
      }
    }
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Proceso e inspecciones actualizados correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en PUT /api/inspecciones:', error);
    res.status(500).json({ error: error.message || 'Error actualizando la inspección' });
  } finally {
    client.release();
  }
});

// ==========================================
// 4. ELIMINAR PROCESO COMPLETO (DELETE)
// ==========================================
app.delete('/api/inspecciones/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const procesoId = parseInt(req.params.id, 10);

    if (isNaN(procesoId)) {
      throw new Error('El ID del proceso no es válido.');
    }

    await client.query('DELETE FROM caja_defectos WHERE caja_id IN (SELECT id FROM cajas WHERE proceso_id = $1)', [procesoId]);
    await client.query('DELETE FROM cajas WHERE proceso_id = $1', [procesoId]);
    const deleteRes = await client.query('DELETE FROM procesos WHERE id = $1', [procesoId]);

    if (deleteRes.rowCount === 0) {
      throw new Error('No se encontró el proceso en la base de datos.');
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Proceso eliminado con éxito' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en DELETE /api/inspecciones:', error.message || error);
    res.status(500).json({ error: error.message || 'Error al eliminar el proceso de la base de datos' });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Backend corriendo en el puerto ${PORT} y escuchando red local`);
});