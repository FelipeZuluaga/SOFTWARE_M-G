import api from "./api";

export const saleService = {
    /**
     * Registra la liquidación final de un despacho.
     * Envía el array de ventas (sales) y el order_id al backend.
     * @param {Object} saleData - { order_id, sales: [...] }
     */
    createSale: async (saleData) => {
        try {
            // Importante: saleData debe contener el order_id y el array de ventas individuales
            const response = await api.post("/sales/create", saleData);
            return response.data; // Retorna { success: true, message: "..." }
        } catch (error) {
            console.error("Error en saleService.createSale:", error);
            // Extraemos el mensaje de error del backend si existe
            const errorMsg = error.response?.data?.message || "Error al procesar la liquidación";
            throw new Error(errorMsg);
        }
    },

    /**
     * Obtiene el historial de rutas liquidadas (Resumen para administración)
     */
    getSalesHistory: async () => {
        try {
            const response = await api.get("/sales");
            return response.data; // Retorna la lista de órdenes liquidadas
        } catch (error) {
            console.error("Error al obtener historial:", error);
            const errorMsg = error.response?.data?.message || "Error al obtener el historial";
            throw new Error(errorMsg);
        }
    },

    /**
     * Obtiene el detalle de lo que se vendió en una ruta específica
     * @param {number|string} orderId 
     */
    getRutaCompleta: async (orderId) => {
        try {
            if (!orderId) throw new Error("ID de orden no proporcionado");

            const response = await api.get(`/sales/ruta-completa/${orderId}`);
            return response.data; // Retorna el array de clientes y sus resultados en esa ruta
        } catch (error) {
            console.error("Error en getRutaCompleta:", error);
            const errorMsg = error.response?.data?.message || "Error al obtener la planilla";
            throw new Error(errorMsg);
        }
    },
};