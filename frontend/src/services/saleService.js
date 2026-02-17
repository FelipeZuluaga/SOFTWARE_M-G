import api from "./api";

export const saleService = {
    /**
     * Registra la liquidación final de un despacho.
     * Guarda el resumen en 'sales' y el detalle en 'sale_items'.
     * @param {Object} saleData - Incluye order_id, seller_name, total_amount, amount_paid, etc.
     */
    createSale: async (saleData) => {
        try {
            // Enviamos la información a la ruta que configuramos en server.js
            const response = await api.post("/sales/create", saleData);
            return response.data;
        } catch (error) {
            // Capturamos el error para mostrarlo en tus alertas de SweetAlert
            throw error.response?.data?.message || "Error al procesar la liquidación de venta";
        }
    },

    /**
     * Opcional: Obtener el historial de ventas liquidadas (Cartera)
     */
    getSalesHistory: async () => {
        try {
            const response = await api.get("/sales");
            return response.data;
        } catch (error) {
            throw error.response?.data?.message || "Error al obtener el historial de ventas";
        }
    },
    getRutaCompleta: async (orderId) => {
        try {
            const response = await api.get(`/sales/ruta-completa/${orderId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data?.message || "Error al obtener la planilla de la ruta";
        }
    },
};