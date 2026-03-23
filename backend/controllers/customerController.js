const db = require('../config/db');

const getCustomersWithBalance = async (req, res) => {
    try {
        // 1. Extraemos también visit_day de la query
        const { seller_id, visit_day } = req.query;

        if (!seller_id) {
            return res.status(400).json({
                success: false,
                message: "seller_id es requerido"
            });
        }

        // 2. Preparamos la base de la consulta y los parámetros
        let query = `
            SELECT 
                id,
                name AS customer_name, 
                address AS customer_address,
                phone, 
                total_debt,
                visit_day,
                position,
                seller_id,
                visit_status_c
            FROM customers
            WHERE seller_id = ?
        `;
        
        const params = [seller_id];

        // 3. Si viene el día, lo agregamos al filtro dinámicamente
        if (visit_day) {
            query += " AND visit_day = ?";
            params.push(visit_day);
        }

        // 4. Mantenemos el orden por posición
        query += " ORDER BY position ASC";

        const [rows] = await db.query(query, params);

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
const getAllCustomersWithSellerName = async (req, res) => {
    try {
        const { seller_id, visit_day } = req.query;

        // Base de la consulta con el JOIN para traer el nombre del vendedor
        let query = `
            SELECT 
                c.id,
                c.name AS customer_name, 
                c.address AS customer_address,
                c.phone, 
                c.total_debt,
                c.visit_day,
                c.position,
                c.seller_id,
                c.visit_status_c,
                u.name AS seller_name
            FROM customers c
            LEFT JOIN users u ON c.seller_id = u.id
            WHERE 1=1
        `;
        
        const params = [];

        // Filtros opcionales
        if (seller_id) {
            query += " AND c.seller_id = ?";
            params.push(seller_id);
        }

        if (visit_day) {
            query += " AND c.visit_day = ?";
            params.push(visit_day);
        }

        query += " ORDER BY c.seller_id ASC, c.position ASC";

        const [rows] = await db.query(query, params);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Error al obtener lista detallada:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// No olvides exportarla al final del archivo
module.exports = {
    getCustomersWithBalance,
    createCustomer,
    getAllCustomersWithSellerName, // <--- Nueva función
};