const db = require('../config/db');

const createSale = async (req, res) => {
    const { order_id, sales } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        for (const venta of sales) {
            const {
                customer_name, customer_address, customer_phone,
                location_type, visit_status, seller_name,
                total_amount,   // La compra de hoy (M en tu Excel)
                amount_paid,    // El pago de la compra de hoy
                credit_amount   // El abono a la deuda vieja (N en tu Excel)
            } = venta;

            const m_totalVentaHoy = Number(total_amount) || 0;
            const pagoVentaHoy = Number(amount_paid) || 0;
            const n_abonoDeudaVieja = Number(credit_amount) || 0;

            // El dinero TOTAL que entra y resta a la deuda global
            const efectivoRecibidoTotal = pagoVentaHoy + n_abonoDeudaVieja;

            // 1. ACTUALIZAR DEUDA GLOBAL EN LA TABLA CUSTOMERS
            // Fórmula: Saldo Nuevo = Saldo Anterior + Compra Hoy - (Pago Venta + Abono)
            await connection.query(
                `INSERT INTO customers (name, address, phone, location_type, total_debt)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    address = VALUES(address),
                    phone = VALUES(phone),
                    total_debt = total_debt + ? - ?`,
                [
                    customer_name, customer_address, customer_phone, location_type,
                    (m_totalVentaHoy - efectivoRecibidoTotal), // Si es nuevo
                    m_totalVentaHoy, efectivoRecibidoTotal    // Si ya existe
                ]
            );

            // 2. RECUPERAR EL ID Y EL SALDO FINAL TRAS LA OPERACIÓN
            const [custRes] = await connection.query(
                "SELECT id, total_debt FROM customers WHERE name = ?",
                [customer_name]
            );
            const customer_id = custRes[0].id;
            const saldoFinalCalculado = custRes[0].total_debt;

            // 3. REGISTRAR LA VENTA CON DESGLOSE
            // Guardamos credit_amount por separado para que el historial sepa si hubo abono
            const [saleRes] = await connection.query(
                `INSERT INTO sales (
                    order_id, customer_id, seller_name, 
                    visit_status, total_amount, amount_paid, credit_amount, balance_due
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    order_id, customer_id, seller_name,
                    visit_status, m_totalVentaHoy, pagoVentaHoy, n_abonoDeudaVieja, saldoFinalCalculado
                ]
            );

            // 4. REGISTRAR LOS PRODUCTOS (Sale Items)
            for (const item of venta.items) {
                await connection.query(
                    `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        saleRes.insertId, item.product_id, item.product_name,
                        item.quantity, item.unit_price, item.total_price
                    ]
                );
            }
        }

        await connection.query("UPDATE orders SET status = 'PAGADO' WHERE id = ?", [order_id]);
        await connection.commit();
        res.status(201).json({ success: true, message: "Venta y Abono registrados correctamente" });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};
const getSales = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT DISTINCT 
                order_id, 
                seller_name, 
                credit_amount, 
                created_at 
            FROM sales 
            GROUP BY order_id
            ORDER BY created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
const getRutaCompleta = async (req, res) => {
    const { orderId } = req.params;
    try {
        const [rows] = await db.query(`
            SELECT 
                s.order_id,
                c.name AS nombre_cliente,
                c.address AS direccion,
                s.visit_status AS estado,
                s.total_amount AS venta,
                s.amount_paid AS pago,
                s.credit_amount AS abono,
                c.phone AS telefono
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            WHERE s.order_id = ?
            ORDER BY s.id ASC
        `, [orderId]);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
module.exports = { createSale, getSales, getRutaCompleta };