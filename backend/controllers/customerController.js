const db = require('../config/db');

const getCustomersWithBalance = async (req, res) => {
    try {
        const { seller_id } = req.query;

        if (!seller_id) {
            return res.status(400).json({
                success: false,
                message: "seller_id es requerido"
            });
        }

        const [rows] = await db.query(
            `
            SELECT 
                id,
                name AS customer_name, 
                address AS customer_address,
                phone, 
                total_debt,
                visit_day,
                position,
                seller_id
            FROM customers
            WHERE seller_id = ?
            ORDER BY position ASC
            `,
            [seller_id]
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Error al obtener clientes:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const createCustomer = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const { name, address, phone, visit_day, seller_id, position } = req.body;

        if (!seller_id) {
            return res.status(400).json({
                success: false,
                message: "seller_id es obligatorio"
            });
        }

        const posicionNumerica = Number(position);

        // 1️⃣ Obtener total actual de clientes del vendedor
        const [[{ total }]] = await connection.query(
            `SELECT COUNT(*) as total 
             FROM customers 
             WHERE seller_id = ?`,
            [seller_id]
        );

        // 2️⃣ Ajustar posición si es mayor al total permitido
        const posicionFinal = posicionNumerica > total + 1
            ? total + 1
            : posicionNumerica < 1
                ? 1
                : posicionNumerica;

        // 3️⃣ Desplazar clientes hacia abajo (GLOBAL por vendedor)
        await connection.query(
            `UPDATE customers 
             SET position = position + 1 
             WHERE seller_id = ?
             AND position >= ?`,
            [seller_id, posicionFinal]
        );

        // 4️⃣ Insertar nuevo cliente
        const [result] = await connection.query(
            `INSERT INTO customers 
            (name, address, phone, visit_day, seller_id, position, total_debt)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [
                name.toUpperCase(),
                address.toUpperCase(),
                phone || "",
                visit_day,
                seller_id,
                posicionFinal
            ]
        );

        await connection.commit();

        res.json({
            success: true,
            data: {
                id: result.insertId,
                position: posicionFinal
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error("Error al crear cliente:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};


module.exports = {
    getCustomersWithBalance,
    createCustomer,
};