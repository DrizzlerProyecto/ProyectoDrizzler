const mysql = require('mysql2/promise');
require('dotenv').config();

const host = process.env.MYSQLHOST || process.env.DB_HOST || 'localhost';
const user = process.env.MYSQLUSER || process.env.DB_USER || 'root';
const password = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '';
const databaseName = process.env.MYSQLDATABASE || process.env.DB_NAME || 'caja_db';
const port = parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306', 10);

const dbUrl = process.env.MYSQL_URL || process.env.MYSQLURL || process.env.DATABASE_URL;

const dbConfig = dbUrl || {
  host,
  user,
  password,
  database: databaseName,
  port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Inicializar la base de datos y las tablas automáticamente en Railway / MySQL
async function initDb() {
  try {
    if (!dbUrl) {
      try {
        const rootConn = await mysql.createConnection({ host, user, password, port });
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await rootConn.end();
      } catch (e) {
        // Ignorar si no hay permisos para crear BD desde root
      }
    }

    const connection = await pool.getConnection();
    console.log(`⚡ Conexión exitosa a la Base de Datos MySQL (${databaseName})`);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS carpetas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        descripcion VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
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

    await connection.query(`
      CREATE TABLE IF NOT EXISTS perfil (
        id INT PRIMARY KEY DEFAULT 1,
        nombre VARCHAR(100) DEFAULT 'Administrador de Caja',
        cargo VARCHAR(100) DEFAULT 'Usuario Principal',
        avatar_url LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      INSERT IGNORE INTO perfil (id, nombre, cargo, avatar_url)
      VALUES (1, 'Administrador de Caja', 'Usuario Principal', '');
    `);

    try {
      await connection.query(`ALTER TABLE ingresos ADD COLUMN carpeta_id INT;`);
    } catch (e) {
      // Ignorar si ya existe
    }
    
    connection.release();
  } catch (err) {
    console.warn('⚠️ Nota sobre MySQL:', err.message);
    console.warn('👉 Asegúrate de que MySQL esté activo en XAMPP/MySQL Workbench.');
  }
}

initDb();

module.exports = pool;
