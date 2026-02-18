const express = require("express");
const router = express.Router();
const db = require("../config/db"); // Ahora db soporta promesas

router.post("/login", async (req, res) => {
  const { id, password, role_id } = req.body;

  // 1. Usamos un bloque try-catch para manejar errores de forma limpia
  try {
    const sql = `
      SELECT 
        u.id,
        u.name,
        r.name AS role
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
      AND u.password_hash = ?
      AND r.id = ?
    `;

    // 2. Con .promise(), usamos await. El resultado viene en un array [filas, campos]
    const [rows] = await db.query(sql, [id, password, role_id]);

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Credenciales incorrectas o rol no autorizado"
      });
    }

    // 3. Respuesta exitosa
    res.json({
      success: true,
      user: {
        id: rows[0].id,
        name: rows[0].name,
        role: rows[0].role,
      },
    });

  } catch (err) {
    console.error("Error en el login:", err);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
});

module.exports = router;