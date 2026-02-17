const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// --- RUTAS DE CREACIÓN Y CONSULTA ---

// Crear un nuevo pedido/despacho
router.post('/create', orderController.createOrder);

// Obtener historial de pedidos (filtrado por rol en el controlador)
router.get('/history', orderController.getOrdersByRole);

// Obtener los productos (ítems) específicos de un pedido
router.get('/detail/:id', orderController.getOrderDetail);

// --- RUTAS DE ACTUALIZACIÓN Y BORRADO ---

// ACTUALIZACIÓN COMPLETA: Maneja stock, precios y edición dinámica de ítems
// Esta es la que corregimos para evitar el error de "reading stock of undefined"
router.put('/update-full/:id', orderController.updateOrderItems); 

// ELIMINACIÓN: Borra el pedido y restaura el stock al inventario
router.delete('/delete/:id', orderController.deleteOrder);
/**
 * NUEVA RUTA: Procesar devolución de sobrantes
 * Esta ruta permite que al terminar una ruta, los productos no vendidos
 * regresen automáticamente al stock central de la tabla 'products'.
 */
router.post('/process-return', orderController.processReturn);
router.get('/return-history/:orderId', orderController.getReturnHistory);
router.get('/truck-inventory/:orderId', orderController.getTruckInventory);
router.post('/mark-liquidated/:orderId', orderController.markAsLiquidated);

module.exports = router;