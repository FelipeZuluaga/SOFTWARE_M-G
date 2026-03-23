const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Middleware de seguridad
const isAdmin = (req, res, next) => {
    const role = req.headers.role;
    if (role === "ADMINISTRADOR") {
        next();
    } else {
        res.status(403).json({ message: "No tienes permisos para esta acción" });
    }
};

/* =========================
   LISTAR USUARIOS (Async/Await)
========================= */
router.get("/", isAdmin, async (req, res) => {
    const sql = `
        SELECT u.id, u.name, r.name AS role
        FROM users u
        JOIN roles r ON u.role_id = r.id
        ORDER BY u.id DESC
    `;

    try {
        // En promise clients, usamos await y desestructuramos [rows]
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (err) {
        console.error("Error en DB:", err);
        res.status(500).json({ message: "Error al obtener usuarios" });
    }
});

/* =========================
   CREAR USUARIO (Async/Await)
========================= */
router.post("/", isAdmin, async (req, res) => {
    const { id, name, password, role } = req.body;

    if (!id || !name || !password || !role) {
        return res.status(400).json({ message: "Datos incompletos" });
    }

    try {
        // 1️⃣ Buscar el ID del rol
        const roleSql = "SELECT id FROM roles WHERE name = ?";
        const [roleRows] = await db.query(roleSql, [role]);

        if (roleRows.length === 0) {
            return res.status(400).json({ message: "El rol seleccionado no existe" });
        }

        const role_id = roleRows[0].id;

        // 2️⃣ Insertar usuario
        const insertSql = `
            INSERT INTO users (id, name, password_hash, role_id)
            VALUES (?, ?, ?, ?)
        `;

        await db.query(insertSql, [id, name,  password, role_id]);
        res.json({ message: "Usuario creado correctamente" });

    } catch (err) {
        console.error(err);
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ message: "Este código de usuario ya está registrado" });
        }
        res.status(500).json({ message: "Error al insertar usuario" });
    }
});

/* =========================
   ELIMINAR USUARIO (Async/Await)
========================= */
router.delete("/:id", isAdmin, async (req, res) => {
    const sql = "DELETE FROM users WHERE id = ?";

    try {
        await db.query(sql, [req.params.id]);
        res.json({ message: "Usuario eliminado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "No se pudo eliminar el usuario" });
    }
});

module.exports = router;