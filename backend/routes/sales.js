const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');

// Ruta para procesar la liquidación de un despacho (con o sin abono)
// Endpoint: POST /api/sales/create
router.post('/create', saleController.createSale);
// Ruta para obtener el historial de ventas liquidadas
router.get('/', saleController.getSales);

// NUEVA RUTA: Obtiene la "Hoja de Ruta" completa filtrada por el ID de la orden
// Endpoint: GET /api/sales/ruta-completa/:orderId
router.get('/ruta-completa/:orderId', saleController.getRutaCompleta);

module.exports = router;