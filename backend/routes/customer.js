const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.get('/balances', customerController.getCustomersWithBalance);
router.post('/create', customerController.createCustomer); // Nueva ruta para crear clientes

module.exports = router;