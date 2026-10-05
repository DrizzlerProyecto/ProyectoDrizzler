const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const pool = require('./db');
const sqliteDb = require('./sqlite_db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Helper para intentar ejecutar consultas en MySQL
async function executeMysqlQuery(query, params = []) {
  try {
    const [rows] = await pool.query(query, params);
    return { success: true, data: rows, isDb: true };
  } catch (err) {
    console.error('❌ Error en MySQL:', err.message);
    return { success: false, error: err.message, isDb: false };
  }
}

// -------------------------------------------------------------
// ENDPOINTS DE LA API REST - CARPETAS
// -------------------------------------------------------------

// Obtener todas las carpetas con estadísticas
app.get('/api/carpetas', async (req, res) => {
  const mysqlSql = `
    SELECT 
      c.*,
      COUNT(i.id) as cantidad_registros,
      COALESCE(SUM(i.monto), 0) as total_bruto
    FROM carpetas c
    LEFT JOIN ingresos i ON i.carpeta_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `;
  const mysqlResult = await executeMysqlQuery(mysqlSql);

  if (mysqlResult.success) {
    const list = mysqlResult.data.map(r => {
      const bruto = parseFloat(r.total_bruto || 0);
      return {
        ...r,
        total_bruto: parseFloat(bruto.toFixed(2)),
        deduccion_5: parseFloat((bruto * 0.05).toFixed(2)),
        total_neto: parseFloat((bruto * 0.95).toFixed(2))
      };
    });
    return res.json({ success: true, carpetas: list, motor: 'MySQL' });
  } else {
    const list = sqliteDb.getCarpetas();
    return res.json({ success: true, carpetas: list, motor: 'SQLite' });
  }
});

// Crear una nueva carpeta
app.post('/api/carpetas', async (req, res) => {
  const { nombre, descripcion } = req.body;
  const nombreVal = nombre && nombre.trim() !== '' ? nombre.trim() : 'Nueva Carpeta';
  const descVal = descripcion ? descripcion.trim() : '';

  const sqliteRecord = sqliteDb.createCarpeta({ nombre: nombreVal, descripcion: descVal });

  const mysqlSql = 'INSERT INTO carpetas (nombre, descripcion) VALUES (?, ?)';
  const mysqlResult = await executeMysqlQuery(mysqlSql, [nombreVal, descVal]);

  return res.status(201).json({
    message: 'Carpeta creada exitosamente',
    carpeta: mysqlResult.success ? { id: mysqlResult.data.insertId, nombre: nombreVal, descripcion: descVal } : sqliteRecord,
    motor: mysqlResult.success ? 'MySQL + SQLite' : 'SQLite Local'
  });
});

// Eliminar carpeta
app.delete('/api/carpetas/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  await executeMysqlQuery('UPDATE ingresos SET carpeta_id = NULL WHERE carpeta_id = ?', [id]);
  const mysqlResult = await executeMysqlQuery('DELETE FROM carpetas WHERE id = ?', [id]);

  sqliteDb.deleteCarpeta(id);

  return res.json({ message: 'Carpeta eliminada exitosamente', id });
});

// -------------------------------------------------------------
// ENDPOINTS DE LA API REST - INGRESOS
// -------------------------------------------------------------

// 1. Obtener ingresos con filtros por período, rango de fechas o carpeta
app.get('/api/ingresos', async (req, res) => {
  const { filtro = 'todo', desde, hasta, carpeta_id } = req.query;

  let sql = 'SELECT * FROM ingresos';
  let whereClauses = [];
  let params = [];

  if (carpeta_id) {
    whereClauses.push('carpeta_id = ?');
    params.push(parseInt(carpeta_id, 10));
  }

  if (filtro === 'semana') {
    whereClauses.push('fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
  } else if (filtro === 'mes') {
    whereClauses.push('YEAR(fecha) = YEAR(CURRENT_DATE()) AND MONTH(fecha) = MONTH(CURRENT_DATE())');
  } else if (filtro === 'anio') {
    whereClauses.push('YEAR(fecha) = YEAR(CURRENT_DATE())');
  } else if (filtro === 'rango' && desde && hasta) {
    whereClauses.push('fecha >= ? AND fecha <= ?');
    params.push(`${desde} 00:00:00`, `${hasta} 23:59:59`);
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  sql += ' ORDER BY fecha DESC';

  const mysqlResult = await executeMysqlQuery(sql, params);

  let list = [];
  let motorBaseDatos = 'SQLite (Local .db)';

  if (mysqlResult.success) {
    list = mysqlResult.data;
    motorBaseDatos = 'MySQL (caja_db)';
  } else {
    list = sqliteDb.getIngresos({ filtro, desde, hasta, carpeta_id });
  }

  // Cálculos financieros
  const totalBruto = list.reduce((acc, curr) => acc + parseFloat(curr.monto || 0), 0);
  const deduccion5 = totalBruto * 0.05;
  const totalNeto = totalBruto * 0.95;

  res.json({
    filtro,
    desde: desde || null,
    hasta: hasta || null,
    carpeta_id: carpeta_id ? parseInt(carpeta_id, 10) : null,
    totalBruto: parseFloat(totalBruto.toFixed(2)),
    deduccion5: parseFloat(deduccion5.toFixed(2)),
    totalNeto: parseFloat(totalNeto.toFixed(2)),
    cantidadRegistros: list.length,
    ingresos: list,
    motorBaseDatos,
    usandoBaseDatos: true
  });
});

// 2. Registrar un nuevo ingreso de caja asignado a una carpeta opcional
app.post('/api/ingresos', async (req, res) => {
  const { monto, descripcion, categoria, fecha, carpeta_id } = req.body;

  const montoNum = parseFloat(monto);
  if (isNaN(montoNum) || montoNum <= 0) {
    return res.status(400).json({ error: 'El monto ingresado debe ser un número mayor a 0 en Soles.' });
  }

  const descFinal = descripcion && descripcion.trim() !== '' ? descripcion.trim() : 'Ingreso de Caja';
  const catFinal = categoria || 'General';
  const fechaFinal = fecha ? new Date(fecha) : new Date();
  const formattedDate = fechaFinal.toISOString().slice(0, 19).replace('T', ' ');
  const carpetaIdVal = carpeta_id ? parseInt(carpeta_id, 10) : null;

  // 1. Intentar guardar en MySQL
  const mysqlSql = 'INSERT INTO ingresos (monto, descripcion, categoria, fecha, carpeta_id) VALUES (?, ?, ?, ?, ?)';
  const mysqlResult = await executeMysqlQuery(mysqlSql, [montoNum, descFinal, catFinal, formattedDate, carpetaIdVal]);

  if (mysqlResult.success) {
    try { sqliteDb.insertIngreso({ monto: montoNum, descripcion: descFinal, categoria: catFinal, fecha: formattedDate, carpeta_id: carpetaIdVal }); } catch (e) {}

    return res.status(201).json({
      message: 'Ingreso guardado exitosamente en tabla MySQL (caja_db)',
      id: mysqlResult.data.insertId,
      monto: montoNum,
      descripcion: descFinal,
      categoria: catFinal,
      fecha: formattedDate,
      carpeta_id: carpetaIdVal,
      motor: 'MySQL'
    });
  } else {
    const sqliteRecord = sqliteDb.insertIngreso({
      monto: montoNum,
      descripcion: descFinal,
      categoria: catFinal,
      fecha: formattedDate,
      carpeta_id: carpetaIdVal
    });

    return res.status(201).json({
      message: 'Ingreso guardado en Tabla SQLite (db/caja.db)',
      ...sqliteRecord,
      motor: 'SQLite Local'
    });
  }
});

// 3. Eliminar un ingreso
app.delete('/api/ingresos/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  const mysqlResult = await executeMysqlQuery('DELETE FROM ingresos WHERE id = ?', [id]);

  if (mysqlResult.success) {
    try { sqliteDb.deleteIngreso(id); } catch (e) {}
    return res.json({ message: 'Registro eliminado de tabla MySQL', id });
  } else {
    sqliteDb.deleteIngreso(id);
    return res.json({ message: 'Registro eliminado de tabla SQLite local', id });
  }
});

// 4. Obtener datos del perfil de usuario
app.get('/api/perfil', async (req, res) => {
  const mysqlResult = await executeMysqlQuery('SELECT * FROM perfil WHERE id = 1');

  if (mysqlResult.success && mysqlResult.data.length > 0) {
    return res.json({ success: true, perfil: mysqlResult.data[0], motor: 'MySQL' });
  } else {
    const perfilSqlite = sqliteDb.getPerfil();
    return res.json({ success: true, perfil: perfilSqlite, motor: 'SQLite' });
  }
});

// 5. Actualizar datos del perfil y foto de usuario
app.post('/api/perfil', async (req, res) => {
  const { nombre, cargo, avatar_url } = req.body;

  const nombreVal = nombre && nombre.trim() !== '' ? nombre.trim() : 'Administrador de Caja';
  const cargoVal = cargo && cargo.trim() !== '' ? cargo.trim() : 'Usuario Principal';
  const avatarVal = avatar_url || '';

  const updatedSqlite = sqliteDb.updatePerfil({ nombre: nombreVal, cargo: cargoVal, avatar_url: avatarVal });

  const mysqlSql = `
    INSERT INTO perfil (id, nombre, cargo, avatar_url)
    VALUES (1, ?, ?, ?)
    ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), cargo = VALUES(cargo), avatar_url = VALUES(avatar_url)
  `;
  const mysqlResult = await executeMysqlQuery(mysqlSql, [nombreVal, cargoVal, avatarVal]);

  return res.json({
    message: 'Perfil actualizado exitosamente en base de datos',
    perfil: mysqlResult.success ? { id: 1, nombre: nombreVal, cargo: cargoVal, avatar_url: avatarVal } : updatedSqlite,
    motor: mysqlResult.success ? 'MySQL + SQLite' : 'SQLite Local'
  });
});

// 6. Estado del Servidor
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Servidor de Cajas e Ingresos activo ⚡',
    basesDatosDisponibles: ['SQLite (db/caja.db)', 'MySQL (caja_db)']
  });
});

// Redirección por defecto al frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Servidor ejecutándose en: http://localhost:${PORT}`);
    console.log(`⚡ Base de Datos SQL Activa con Módulo de Carpetas`);
    console.log(`====================================================`);
  });
}

module.exports = app;
