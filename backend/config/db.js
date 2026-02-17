const mysql = require('mysql2/promise'); // 1. Importamos la versión de promesas
require('dotenv').config({ path: './.env' });

// 2. Usamos createPool en lugar de createConnection
// Un pool gestiona múltiples conexiones automáticamente, lo cual es más eficiente
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 3. Verificamos la conexión (opcional pero recomendado)
// Al usar promesas, lo hacemos con una función autoejecutada
(async () => {
  try {
    const connection = await db.getConnection();
    console.log('¡Conectado a MySQL de forma segura con Promesas!');
    connection.release(); // Liberamos la conexión de prueba
  } catch (err) {
    console.error('Error conectando a MySQL:', err.message);
  }
})();

module.exports = db;