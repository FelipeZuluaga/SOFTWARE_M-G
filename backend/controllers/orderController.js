const db = require('../config/db');

// --- CREAR PEDIDO ---
const createOrder = async (req, res) => {
    const { user_id, receptor_name, customer_type_id, items } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        // --- NUEVA LÓGICA: Obtener el nombre real del vendedor ---
        // receptor_name viene como el ID (ej: 15023) desde el frontend
        const [userData] = await connection.query("SELECT name FROM users WHERE id = ?", [receptor_name]);
        const realSellerName = userData.length > 0 ? userData[0].name : 'Desconocido';
        let totalOrderAmount = 0;
        const processedItems = [];

        for (const item of items) {
            const [priceData] = await connection.query(
                "SELECT unit_price FROM product_prices WHERE product_id = ? AND customer_type_id = ?",
                [item.product_id, customer_type_id]
            );

            if (priceData.length === 0) throw new Error(`Producto ID ${item.product_id} no tiene precio.`);

            const unitPrice = priceData[0].unit_price;
            const subtotal = unitPrice * item.quantity;
            totalOrderAmount += subtotal;

            processedItems.push({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: unitPrice,
                total_price: subtotal
            });
        }

        const [orderRes] = await connection.query(
            `INSERT INTO orders (user_id, seller_name, customer_type_id, total_amount, status, created_at) 
             VALUES (?, ?, ?, ?, 'DESPACHADO', NOW())`,
            [user_id, realSellerName, customer_type_id, totalOrderAmount]
        );

        const orderId = orderRes.insertId;

        for (const item of processedItems) {
            await connection.query(
                "INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)",
                [orderId, item.product_id, item.quantity, item.unit_price, item.total_price]
            );

            await connection.query(
                "UPDATE products SET stock = stock - ? WHERE id = ?",
                [item.quantity, item.product_id]
            );
        }

        await connection.commit();
        res.status(201).json({ success: true, message: "Despacho realizado con éxito", order_id: orderId });

    } catch (error) {
        await connection.rollback();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

const getOrdersByRole = async (req, res) => {
    const { user_id, role } = req.query;
    try {
        let query = `
            SELECT o.*, 
                   u.name as dispatcher_name, 
                   ct.name as customer_type_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN customer_types ct ON o.customer_type_id = ct.id
        `;
        let params = [];

        if (role === 'ADMINISTRADOR') {
            query += " ORDER BY o.created_at DESC";
        } else if (role === 'DESPACHADOR') {
            // El despachador (ID 4444 en tu imagen) solo ve lo que él procesó
            query += " WHERE o.user_id = ? ORDER BY o.created_at DESC";
            params = [user_id];
        } else {
            // Si es un Socio/No Socio viendo sus propios pedidos
            query += " WHERE o.seller_name = (SELECT name FROM users WHERE id = ?) ORDER BY o.created_at DESC";
            params = [user_id];
        }

        const [orders] = await db.query(query, params);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al cargar pedidos" });
    }
};

const getOrderDetail = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT 
                oi.id, 
                oi.product_id, 
                p.name AS product_name, 
                oi.quantity, 
                oi.unit_price 
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [id]
        );
        res.json(rows);
    } catch (error) {
        console.error("Error en getOrderDetail:", error);
        res.status(500).json({ message: "Error al obtener detalle" });
    }
};
// --- NUEVA: ELIMINAR PEDIDO Y DEVOLVER STOCK ---
const deleteOrder = async (req, res) => {
    const { id } = req.params;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Obtener los productos y cantidades para devolverlos al stock
        const [items] = await connection.query(
            "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
            [id]
        );

        // 2. Revertir el stock en la tabla productos
        for (const item of items) {
            await connection.query(
                "UPDATE products SET stock = stock + ? WHERE id = ?",
                [item.quantity, item.product_id]
            );
        }

        // 3. Eliminar los items (por integridad referencial)
        await connection.query("DELETE FROM order_items WHERE order_id = ?", [id]);

        // 4. Eliminar el pedido
        await connection.query("DELETE FROM orders WHERE id = ?", [id]);

        await connection.commit();
        res.json({ success: true, message: "Pedido eliminado y stock restaurado correctamente" });

    } catch (error) {
        await connection.rollback();
        console.error("Error al eliminar pedido:", error);
        res.status(500).json({ success: false, message: "No se pudo eliminar el pedido" });
    } finally {
        connection.release();
    }
};
const updateOrderItems = async (req, res) => {
    const { id } = req.params;
    const { seller_name, items, customer_type_id } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Actualizar datos generales de la orden
        await connection.query(
            "UPDATE orders SET seller_name = ? WHERE id = ?",
            [seller_name, id]
        );

        // 2. Devolver stock de los items actuales antes de borrarlos
        const [oldItems] = await connection.query(
            "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
            [id]
        );

        for (const item of oldItems) {
            await connection.query(
                "UPDATE products SET stock = stock + ? WHERE id = ?",
                [item.quantity, item.product_id]
            );
        }

        // 3. Borrar items viejos para reemplazarlos
        await connection.query("DELETE FROM order_items WHERE order_id = ?", [id]);

        // 4. Insertar nuevos items y validar stock/precios
        let newTotalAmount = 0;

        for (const item of items) {
            const pId = Number(item.product_id);
            const qty = Number(item.quantity);

            // Validación crucial para evitar el error de "undefined" o "NaN"
            if (!pId || isNaN(pId)) {
                throw new Error("Se recibió un ID de producto no válido.");
            }

            const [productResult] = await connection.query(
                "SELECT stock, name FROM products WHERE id = ?",
                [pId]
            );

            if (productResult.length === 0) {
                throw new Error(`El producto con ID ${pId} no existe en el inventario.`);
            }

            const product = productResult[0];

            if (product.stock < qty) {
                throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}`);
            }

            // Buscar precio por tipo de cliente
            const [priceData] = await connection.query(
                "SELECT unit_price FROM product_prices WHERE product_id = ? AND customer_type_id = ?",
                [pId, customer_type_id]
            );

            const unitPrice = priceData[0]?.unit_price || 0;
            const subtotal = unitPrice * qty;
            newTotalAmount += subtotal;

            // Insertar detalle y descontar del inventario
            await connection.query(
                "INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)",
                [id, pId, qty, unitPrice, subtotal]
            );

            await connection.query(
                "UPDATE products SET stock = stock - ? WHERE id = ?",
                [qty, pId]
            );
        }

        // 5. Actualizar el total de la orden original
        await connection.query("UPDATE orders SET total_amount = ? WHERE id = ?", [newTotalAmount, id]);

        await connection.commit();
        res.json({ success: true, message: "Pedido actualizado y stock sincronizado" });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        if (connection) connection.release();
    }
};
// backend/controllers/orderController.js

const processReturn = async (req, res) => {
    const { order_id, items } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        for (const item of items) {
            // USAMOS cantidad_a_devolver que es como lo envía el frontend
            // FORZAMOS el valor a número entero
            const cantADevolver = parseInt(item.cantidad_a_devolver);
            const productId = item.product_id;

            if (cantADevolver > 0) {
                //console.log(`Sumando ${cantADevolver} al producto ID: ${productId}`); // Log para depurar

                // 1. SUMAR AL INVENTARIO
                // Usamos stock = stock + ? para que SQL haga la suma matemática
                await connection.query(
                    "UPDATE products SET stock = stock + ? WHERE id = ?",
                    [cantADevolver, productId]
                );

                // 2. REGISTRAR EN HISTORIAL
                await connection.query(
                    "INSERT INTO order_returns (order_id, product_id, quantity) VALUES (?, ?, ?)",
                    [order_id, productId, cantADevolver]
                );
            }
        }

        // 3. Marcar la orden como LIQUIDADA
        await connection.query(
            "UPDATE orders SET status = 'LIQUIDADO' WHERE id = ?",
            [order_id]
        );

        await connection.commit();
        res.json({ success: true, message: "Liquidación guardada con éxito." });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error en SQL:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        if (connection) connection.release();
    }
};
// 2. NUEVA FUNCIÓN: Obtener lo que se devolvió de una orden
const getReturnHistory = async (req, res) => {
    const { orderId } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT 
                r.product_id, -- <--- TE FALTABA ESTO
                r.quantity as cantidad_devuelta, 
                p.name as product_name, 
                r.return_date 
            FROM order_returns r 
            JOIN products p ON r.product_id = p.id 
            WHERE r.order_id = ?`,
            [orderId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
const getTruckInventory = async (req, res) => {
    const { orderId } = req.params;
    try {
        // Esta consulta busca lo que se despachó y le resta lo que se vendió en esa orden
        const [rows] = await db.query(
            `SELECT 
                oi.product_id, 
                p.name as product_name, 
                oi.quantity as despachado,
                IFNULL((SELECT SUM(si.quantity) 
                        FROM sale_items si 
                        JOIN sales s ON si.sale_id = s.id 
                        WHERE s.order_id = oi.order_id 
                        AND si.product_id = oi.product_id), 0) as vendido
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [orderId]
        );

        // Calculamos el sobrante real
        const stockEnCamion = rows.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            cantidad_sobrante: item.despachado - item.vendido
        }));

        res.json(stockEnCamion);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
const markAsLiquidated = async (req, res) => {
    const { orderId } = req.params;
    try {
        await db.query("UPDATE orders SET status = 'LIQUIDADO' WHERE id = ?", [orderId]);
        res.json({ success: true, message: "Orden liquidada." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};



const settleOrder = async (req, res) => {
    const { orderId } = req.params;

    // Capturamos los datos enviados desde el frontend (React)
    const {
        user_id,
        total_recaudado,
        ventas_totales,
        cartera_anterior,
        valor_almuerzo,
        valor_gasolina,
        ganancia_vendedor,
        efectivo_fisico,
        diferencia
    } = req.body || {};

    try {
        // 1. RECAUDO Y VENTAS (Igual que lo tenías)
        const [cashData] = await db.query(`
            SELECT IFNULL(SUM(amount_paid), 0) as total_recaudado,
                   IFNULL(SUM(total_amount), 0) as ventas_totales_hoy
            FROM sales WHERE order_id = ?
        `, [orderId]);

        // 2. CARTERA (Igual que lo tenías)
        const [carteraData] = await db.query(`
            SELECT IFNULL(SUM(total_debt), 0) as cartera_anterior 
            FROM customers 
            WHERE id IN (SELECT DISTINCT customer_id FROM sales WHERE order_id = ?)
        `, [orderId]);

        // 3. OBTENER USER_ID DE LA ORDEN (Si no viene en el body)
        const [orderInfo] = await db.query("SELECT user_id FROM orders WHERE id = ?", [orderId]);

        // 4. FLUJO DE CONSULTA (Si no hay efectivo_fisico enviado)
        if (efectivo_fisico === undefined) {
            return res.json({
                user_id: orderInfo[0]?.user_id,
                total_recaudado: cashData[0].total_recaudado,
                ventas_totales_hoy: cashData[0].ventas_totales_hoy,
                cartera_anterior: carteraData[0].cartera_anterior
            });
        }

        // 5. FLUJO DE GUARDADO (POST - FINALIZAR)
        // Insertamos en la tabla m_g_settlements (según la imagen de tu DB)
        await db.query(`
            INSERT INTO m_g_settlements 
            (order_id, user_id, total_recaudado, ventas_totales, cartera_anterior, 
             valor_almuerzo, valor_gasolina, ganancia_vendedor, efectivo_fisico, diferencia)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            orderId,
            user_id || orderInfo[0]?.user_id,
            total_recaudado,
            ventas_totales,
            cartera_anterior,
            valor_almuerzo,
            valor_gasolina,
            ganancia_vendedor,
            efectivo_fisico,
            diferencia
        ]);

        // 6. ACTUALIZAR ESTADO DE LA ORDEN
        await db.query("UPDATE orders SET status = 'CERRADA' WHERE id = ?", [orderId]);

        res.json({
            success: true,
            message: "Liquidación guardada en m_g_settlements y ruta cerrada."
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
module.exports = {
    createOrder,
    getOrdersByRole,
    getOrderDetail,
    deleteOrder,
    processReturn,
    updateOrderItems,
    getReturnHistory,
    getTruckInventory,
    markAsLiquidated,
    settleOrder
};