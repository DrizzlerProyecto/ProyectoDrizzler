const mysql = require('mysql2/promise');
const sqliteDb = require('../server/sqlite_db');
require('dotenv').config();

async function syncLocalDataToRailway() {
  const dbUrl = process.env.MYSQL_URL || process.env.MYSQLURL || process.env.DATABASE_URL;

  if (!dbUrl && !process.env.MYSQLHOST && !process.env.DB_HOST) {
    console.error('❌ Error: No se encontró la variable MYSQL_URL o las credenciales de Railway en .env');
    console.log('👉 Asegúrate de copiar MYSQL_URL de Railway a tu archivo .env');
    process.exit(1);
  }

  console.log('🔄 Conectando a la Base de Datos MySQL en Railway...');

  const dbConfig = dbUrl || {
    host: process.env.MYSQLHOST || process.env.DB_HOST,
    user: process.env.MYSQLUSER || process.env.DB_USER,
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.DB_NAME,
    port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306', 10)
  };

  try {
    const conn = await mysql.createConnection(dbConfig);
    console.log('⚡ Conexión exitosa a Railway MySQL.');

    // 1. Crear tablas si no existen
    await conn.query(`
      CREATE TABLE IF NOT EXISTS carpetas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        descripcion VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ingresos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        monto DECIMAL(12, 2) NOT NULL,
        descripcion VARCHAR(255) DEFAULT 'Ingreso de Caja',
        categoria VARCHAR(50) DEFAULT 'General',
        fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        carpeta_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS perfil (
        id INT PRIMARY KEY DEFAULT 1,
        nombre VARCHAR(100) DEFAULT 'Administrador de Caja',
        cargo VARCHAR(100) DEFAULT 'Usuario Principal',
        avatar_url LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Obtener datos locales de SQLite
    const localCarpetas = sqliteDb.getCarpetas();
    const localIngresos = sqliteDb.getIngresos({ filtro: 'todo' });
    const localPerfil = sqliteDb.getPerfil();

    console.log(`📦 Sincronizando ${localCarpetas.length} carpetas y ${localIngresos.length} ingresos locales...`);

    // 3. Subir carpetas
    for (const c of localCarpetas) {
      await conn.query(
        'INSERT INTO carpetas (id, nombre, descripcion, created_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), descripcion=VALUES(descripcion)',
        [c.id, c.nombre, c.descripcion || '', c.created_at || new Date()]
      );
    }

    // 4. Subir ingresos
    for (const i of localIngresos) {
      await conn.query(
        'INSERT INTO ingresos (id, monto, descripcion, categoria, fecha, carpeta_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE monto=VALUES(monto), descripcion=VALUES(descripcion), categoria=VALUES(categoria), fecha=VALUES(fecha), carpeta_id=VALUES(carpeta_id)',
        [i.id, i.monto, i.descripcion || '', i.categoria || 'General', i.fecha, i.carpeta_id || null]
      );
    }

    // 5. Subir perfil
    if (localPerfil) {
      await conn.query(
        'INSERT INTO perfil (id, nombre, cargo, avatar_url) VALUES (1, ?, ?, ?) ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), cargo=VALUES(cargo), avatar_url=VALUES(avatar_url)',
        [localPerfil.nombre, localPerfil.cargo, localPerfil.avatar_url || '']
      );
    }

    console.log('✅ ¡Sincronización completada con éxito! Todas tus tablas y datos están guardados en Railway MySQL.');
    await conn.end();
  } catch (err) {
    console.error('❌ Error migrando datos a Railway:', err.message);
  }
}

syncLocalDataToRailway();
