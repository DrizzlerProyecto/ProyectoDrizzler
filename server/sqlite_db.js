const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

let dbPath;
try {
  const dbDir = path.join(__dirname, '../db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  dbPath = path.join(dbDir, 'caja.db');
} catch (e) {
  dbPath = path.join('/tmp', 'caja.db');
}

let db;
try {
  db = new DatabaseSync(dbPath);
} catch (e) {
  try {
    dbPath = path.join('/tmp', 'caja.db');
    db = new DatabaseSync(dbPath);
  } catch (err) {
    db = new DatabaseSync(':memory:');
  }
}

// Inicializar tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS carpetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ingresos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monto REAL NOT NULL,
    descripcion TEXT DEFAULT 'Ingreso de Caja',
    categoria TEXT DEFAULT 'General',
    fecha TEXT NOT NULL,
    carpeta_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS perfil (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nombre TEXT DEFAULT 'Administrador de Caja',
    cargo TEXT DEFAULT 'Usuario Principal',
    avatar_url TEXT DEFAULT '',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO perfil (id, nombre, cargo, avatar_url)
  VALUES (1, 'Administrador de Caja', 'Usuario Principal', '');
`);

// Asegurar que la columna carpeta_id exista si la tabla ya existía previamente
try {
  db.exec(`ALTER TABLE ingresos ADD COLUMN carpeta_id INTEGER;`);
} catch (e) {
  // Ignorar si la columna ya existe
}

console.log(`📦 Base de datos SQLite lista en: ${dbPath}`);

function getCarpetas() {
  const stmt = db.prepare(`
    SELECT 
      c.*,
      COUNT(i.id) as cantidad_registros,
      COALESCE(SUM(i.monto), 0) as total_bruto
    FROM carpetas c
    LEFT JOIN ingresos i ON i.carpeta_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
  const rows = stmt.all();
  return rows.map(r => {
    const bruto = parseFloat(r.total_bruto || 0);
    return {
      ...r,
      total_bruto: parseFloat(bruto.toFixed(2)),
      deduccion_5: parseFloat((bruto * 0.05).toFixed(2)),
      total_neto: parseFloat((bruto * 0.95).toFixed(2))
    };
  });
}

function createCarpeta({ nombre, descripcion }) {
  const nombreVal = nombre && nombre.trim() !== '' ? nombre.trim() : 'Nueva Carpeta';
  const descVal = descripcion ? descripcion.trim() : '';

  const stmt = db.prepare(`
    INSERT INTO carpetas (nombre, descripcion)
    VALUES (?, ?)
  `);
  const result = stmt.run(nombreVal, descVal);

  return {
    id: Number(result.lastInsertRowid),
    nombre: nombreVal,
    descripcion: descVal,
    created_at: new Date().toISOString()
  };
}

function deleteCarpeta(id) {
  // Desvincular ingresos asignados a esta carpeta
  const stmtUnlink = db.prepare('UPDATE ingresos SET carpeta_id = NULL WHERE carpeta_id = ?');
  stmtUnlink.run(Number(id));

  // Eliminar carpeta
  const stmtDel = db.prepare('DELETE FROM carpetas WHERE id = ?');
  const result = stmtDel.run(Number(id));
  return result.changes > 0;
}

function getIngresos({ filtro = 'todo', desde, hasta, carpeta_id } = {}) {
  let query = 'SELECT * FROM ingresos';
  const params = [];
  const clauses = [];

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthStr = `${year}-${month}`;

  if (carpeta_id) {
    clauses.push('carpeta_id = ?');
    params.push(Number(carpeta_id));
  }

  if (filtro === 'semana') {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    clauses.push('fecha >= ?');
    params.push(sevenDaysAgo.toISOString().slice(0, 19).replace('T', ' '));
  } else if (filtro === 'mes') {
    clauses.push("strftime('%Y-%m', fecha) = ?");
    params.push(monthStr);
  } else if (filtro === 'anio') {
    clauses.push("strftime('%Y', fecha) = ?");
    params.push(String(year));
  } else if (filtro === 'rango' && desde && hasta) {
    clauses.push('fecha >= ? AND fecha <= ?');
    params.push(`${desde} 00:00:00`, `${hasta} 23:59:59`);
  }

  if (clauses.length > 0) {
    query += ' WHERE ' + clauses.join(' AND ');
  }

  query += ' ORDER BY fecha DESC';

  const stmt = db.prepare(query);
  const rows = stmt.all(...params);

  return rows.map(r => ({
    ...r,
    monto: parseFloat(r.monto)
  }));
}

function insertIngreso({ monto, descripcion, categoria, fecha, carpeta_id }) {
  const montoNum = parseFloat(monto);
  const descFinal = descripcion && descripcion.trim() !== '' ? descripcion.trim() : 'Ingreso de Caja';
  const catFinal = categoria || 'General';
  const carpetaIdVal = carpeta_id ? Number(carpeta_id) : null;
  
  let fechaFinalStr;
  if (fecha) {
    const d = new Date(fecha);
    fechaFinalStr = d.toISOString().slice(0, 19).replace('T', ' ');
  } else {
    fechaFinalStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  const stmt = db.prepare(`
    INSERT INTO ingresos (monto, descripcion, categoria, fecha, carpeta_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(montoNum, descFinal, catFinal, fechaFinalStr, carpetaIdVal);

  return {
    id: Number(result.lastInsertRowid),
    monto: montoNum,
    descripcion: descFinal,
    categoria: catFinal,
    fecha: fechaFinalStr,
    carpeta_id: carpetaIdVal
  };
}

function deleteIngreso(id) {
  const stmt = db.prepare('DELETE FROM ingresos WHERE id = ?');
  const result = stmt.run(Number(id));
  return result.changes > 0;
}

// -------------------------------------------------------------
// FUNCIONES DE PERFIL DE USUARIO
// -------------------------------------------------------------
function getPerfil() {
  const stmt = db.prepare('SELECT * FROM perfil WHERE id = 1');
  const row = stmt.get();
  return row || { id: 1, nombre: 'Administrador de Caja', cargo: 'Usuario Principal', avatar_url: '' };
}

function updatePerfil({ nombre, cargo, avatar_url }) {
  const stmt = db.prepare(`
    UPDATE perfil
    SET nombre = ?, cargo = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `);
  stmt.run(nombre || 'Administrador de Caja', cargo || 'Usuario Principal', avatar_url || '');
  return getPerfil();
}

module.exports = {
  db,
  getCarpetas,
  createCarpeta,
  deleteCarpeta,
  getIngresos,
  insertIngreso,
  deleteIngreso,
  getPerfil,
  updatePerfil
};
