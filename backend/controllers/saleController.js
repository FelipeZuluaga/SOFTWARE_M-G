const db = require('../config/db');

const createSale = async (req, res) => {
    const { order_id, sales } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        for (const venta of sales) {
            const {
                customer_id,
                total_amount,   // Valor de mercancía nueva entregada hoy
                amount_paid,    // Dinero para pagar la mercancía de hoy
                credit_amount,  // Dinero para abonar a la deuda vieja
                visit_status
            } = venta;

            // Convertimos a números para evitar errores de concatenación
            const m_totalVentaHoy = Number(total_amount) || 0;
            const pagoVentaHoy = Number(amount_paid) || 0;
            const n_abonoDeudaVieja = Number(credit_amount) || 0;

            // El efectivo total que entra (se suma lo que pagó hoy + lo que abonó a lo viejo)
            const efectivoTotalRecibido = pagoVentaHoy + n_abonoDeudaVieja;

            // 1. ACTUALIZAR DEUDA EN TABLA CUSTOMERS
            // Nueva Deuda = Deuda Anterior + Lo que se le fío hoy - Todo el efectivo que entregó
            await connection.query(
                `UPDATE customers 
                 SET total_debt = total_debt + ? - ? 
                 WHERE id = ?`,
                [m_totalVentaHoy, efectivoTotalRecibido, customer_id]
            );

            // 2. Consultamos nueva deuda real
            const [clienteActualizado] = await connection.query(
                `SELECT total_debt FROM customers WHERE id = ?`,
                [customer_id]
            );

            const nuevaDeuda = Number(clienteActualizado[0].total_debt) || 0;
            // 3. LÓGICA EMPRESARIAL DE LLESO
            if (visit_status === "LLESO") {

                if (nuevaDeuda > 0) {
                    // ✅ Se mantiene LLESO
                    await connection.query(
                        `UPDATE customers SET visit_status = 'LLESO' WHERE id = ?`,
                        [customer_id]
                    );
                } else {
                    // ❌ No debe → quitar estado
                    await connection.query(
                        `UPDATE customers SET visit_status = NULL WHERE id = ?`,
                        [customer_id]
                    );
                }

            }
            // 2. REGISTRAR EN LA TABLA SALES (Solo columnas existentes en tu SQL)
            // Según tu SQL, 'sales' tiene: id, order_id, customer_id, total_amount, amount_paid, visit_status, created_at
            // Guardaremos en 'amount_paid' el TOTAL del efectivo recibido.
            const [saleRes] = await connection.query(
                `INSERT INTO sales (
                    order_id, 
                    customer_id, 
                    total_amount, 
                    amount_paid, 
                    visit_status, 
                    created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    order_id,
                    customer_id,
                    m_totalVentaHoy, // Valor de la nota/remisión
                    efectivoTotalRecibido, // Total dinero que entró a caja
                    visit_status
                ]
            );

            // 3. REGISTRAR ITEMS (Si existen)
            if (venta.items && venta.items.length > 0) {
                for (const item of venta.items) {
                    await connection.query(
                        `INSERT INTO sale_items (sale_id, quantity, unit_price, total_price) 
                         VALUES (?, ?, ?, ?)`,
                        [
                            saleRes.insertId,
                            item.quantity,
                            item.unit_price,
                            item.total_price
                        ]
                    );
                }
            }
        }

        // 4. CAMBIAR ESTADO DE LA ORDEN A 'LIQUIDADO'
        await connection.query("UPDATE orders SET status = 'LIQUIDADO' WHERE id = ?", [order_id]);

        await connection.commit();
        res.status(201).json({ success: true, message: "Liquidación completada exitosamente" });

    } catch (error) {
        await connection.rollback();
        console.error("Error en createSale:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

const getSales = async (req, res) => {
    try {
        // Obtenemos un resumen de las rutas liquidadas
        const [rows] = await db.query(`
            SELECT 
                s.order_id, 
                o.seller_name, 
                SUM(s.total_amount) as total_ruta,
                o.created_at 
            FROM sales s
            JOIN orders o ON s.order_id = o.id
            GROUP BY s.order_id
            ORDER BY o.created_at DESC
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
                s.amount_paid AS pago_total,
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