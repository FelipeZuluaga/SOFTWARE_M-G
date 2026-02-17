const db = require('../config/db');

// En backend/controllers/customerController.js

const getCustomersWithBalance = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                id,
                name AS customer_name, 
                address AS customer_address, 
                phone, 
                location_type,
                total_debt
            FROM customers 
            ORDER BY id ASC
        `);
        // Cambia esto para que coincida con lo que espera tu service
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
// Añadir al final del archivo
const createCustomer = async (req, res) => {
    try {
        const { name, address, phone } = req.body;
        // Insertamos el cliente. Nota: total_debt inicia en 0 por defecto
        const [result] = await db.query(
            'INSERT INTO customers (name, address, phone, total_debt, created_at) VALUES (?, ?, ?, 0, NOW())',
            [name.toUpperCase(), address.toUpperCase(), phone]
        );

        res.json({
            success: true,
            data: {
                id: result.insertId, // Importante para la planilla
                name,
                address,
                phone,
                total_debt: 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getCustomersWithBalance,
    createCustomer,// No olvides exportarlo
};