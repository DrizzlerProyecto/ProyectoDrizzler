-- Script de creación de la Base de Datos para MySQL Local / Railway

CREATE DATABASE IF NOT EXISTS caja_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE caja_db;

CREATE TABLE IF NOT EXISTS ingresos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    monto DECIMAL(12, 2) NOT NULL,
    descripcion VARCHAR(255) DEFAULT 'Ingreso de Caja',
    categoria VARCHAR(50) DEFAULT 'General',
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Registros de prueba opcionales (descomentar si deseas probar con datos iniciales):
/*
INSERT INTO ingresos (monto, descripcion, categoria, fecha) VALUES 
(150.00, 'Caja Turno Mañana', 'Efectivo', NOW()),
(85.50, 'Cobro Yape cliente #102', 'Yape', NOW()),
(320.00, 'Cobro Venta de Repuestos', 'Transferencia', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(500.00, 'Caja Cierre Semanal', 'Efectivo', DATE_SUB(NOW(), INTERVAL 5 DAY));
*/
    