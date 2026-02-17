const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Middleware de seguridad
const canManage = (req, res, next) => {
    const role = req.headers.role;
    if (role === "ADMINISTRADOR" || role === "DESPACHADOR") next();
    else res.status(403).json({ message: "No autorizado" });
};

/* ============================
   LISTAR PRODUCTOS + PRECIOS
============================ */
router.get("/", async (req, res) => {
    const sql = `
        SELECT 
            p.id, p.barcode, p.name, p.stock, 
            c.name AS category,
            pp.customer_type_id, pp.unit_price
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_prices pp ON pp.product_id = p.id
        ORDER BY p.id DESC
    `;

    try {
        const [rows] = await db.query(sql);

        // Tu lógica de agrupamiento original
        const products = {};
        rows.forEach(r => {
            if (!products[r.id]) {
                products[r.id] = {
                    id: r.id,
                    barcode: r.barcode,
                    name: r.name,
                    stock: r.stock,
                    category: r.category,
                    prices: []
                };
            }
            if (r.customer_type_id) {
                products[r.id].prices.push({
                    customer_type_id: r.customer_type_id,
                    unit_price: r.unit_price
                });
            }
        });

        res.json(Object.values(products));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al obtener inventario" });
    }
});

/* ============================
   CREAR PRODUCTO + PRECIOS
============================ */
router.post("/", canManage, async (req, res) => {
    const { barcode, name, stock, category_id, prices } = req.body;
    const connection = await db.getConnection(); // Para transacciones con promesas

    try {
        await connection.beginTransaction();

        const [result] = await connection.query(
            "INSERT INTO products (barcode, name, stock, category_id) VALUES (?, ?, ?, ?)",
            [barcode, name, stock, category_id]
        );

        const productId = result.insertId;

        if (prices && prices.length > 0) {
            const priceValues = prices.map(p => [productId, p.customer_type_id, p.unit_price]);
            await connection.query(
                "INSERT INTO product_prices (product_id, customer_type_id, unit_price) VALUES ?",
                [priceValues]
            );
        }

        await connection.commit();
        res.json({ message: "Producto y precios creados correctamente" });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: "Error al crear producto" });
    } finally {
        connection.release();
    }
});

/* ============================
   ELIMINAR PRODUCTO
============================ */
router.delete("/:id", canManage, async (req, res) => {
    const productId = req.params.id;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Eliminar precios
        await connection.query("DELETE FROM product_prices WHERE product_id = ?", [productId]);

        // 2. Eliminar producto
        const [result] = await connection.query("DELETE FROM products WHERE id = ?", [productId]);

        if (result.affectedRows === 0) {
            throw new Error("Producto no encontrado");
        }

        await connection.commit();
        res.json({ message: "Producto eliminado correctamente" });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message || "Error al eliminar" });
    } finally {
        connection.release();
    }
});

/* ============================
   LISTAR CATEGORÍAS (Para el Select)
============================ */
router.get("/categories", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id, name FROM categories ORDER BY name ASC");
        res.json(rows);
    } catch (err) {
        console.error("Error en categorías:", err);
        res.status(500).json({ message: "Error al obtener categorías" });
    }
});
/* ============================
    ACTUALIZAR PRODUCTO (PUT) - MODIFICADO PARA SUMAR STOCK
============================ */
router.put("/:id", canManage, async (req, res) => {
    const productId = req.params.id;
    const { name, stock, category_id, prices } = req.body; // 'stock' aquí será lo que el usuario escribió (ej: 5)
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Actualizar datos básicos: sumamos el stock enviado al stock actual en DB
        const [updateResult] = await connection.query(
            "UPDATE products SET name = ?, stock = stock + ?, category_id = ? WHERE id = ?",
            [name, stock, category_id, productId]
        );

        // 2. Actualizar precios (Borrar e insertar como ya tenías)
        if (prices && prices.length > 0) {
            await connection.query("DELETE FROM product_prices WHERE product_id = ?", [productId]);
            const priceValues = prices.map(p => [productId, p.customer_type_id, p.unit_price]);
            await connection.query(
                "INSERT INTO product_prices (product_id, customer_type_id, unit_price) VALUES ?",
                [priceValues]
            );
        }

        await connection.commit();
        res.json({ message: "Producto actualizado y stock incrementado con éxito" });
    } catch (err) {
        await connection.rollback();
        console.error("Error al actualizar:", err);
        res.status(500).json({ message: "Error interno al actualizar" });
    } finally {
        connection.release();
    }
});
module.exports = router;