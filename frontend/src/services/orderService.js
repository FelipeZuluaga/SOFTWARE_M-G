import api from "./api";

export const orderService = {
    /**
     * Crear un nuevo pedido o despacho de mercancía.
     */
    createOrder: async (orderData) => {
        const response = await api.post("/orders/create", orderData);
        return response.data;
    },

    /**
     * Obtener el historial de pedidos filtrado según el rol del usuario logueado.
    */
    getOrdersHistory: async (userData) => {
        try {
            const response = await api.get("/orders/history", {
                params: {
                    user_id: userData.id,
                    role: userData.role,
                    name: userData.name
                }
            });
            return response.data;
        } catch (error) {
            throw error.response?.data?.message || "Error al obtener historial";
        }
    },
    /**
     * Obtener el detalle de productos (ítems) de un pedido específico por su ID.
     */
    getOrderDetail: async (orderId) => {
        try {
            const response = await api.get(`/orders/detail/${orderId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data?.message || "Error al obtener el detalle del pedido";
        }
    },

    /**
     * ACTUALIZAR: Modificar datos básicos (ej: nombre del receptor).
     */
    updateOrder: async (orderId, updateData) => {
        try {
            const response = await api.put(`/orders/update/${orderId}`, updateData);
            return response.data;
        } catch (error) {
            throw error.response?.data?.message || "Error al actualizar el pedido";
        }
    },

    /**
     * EDICIÓN COMPLETA Y DINÁMICA: 
     * Envía seller_name, customer_type_id y el array de items.
     * Coincide con tu ruta Backend: router.put('/update-full/:id', ...)
     */
    updateOrderFull: async (orderId, orderData) => {
        try {
            // orderData debe ser: { seller_name, customer_type_id, items: [{product_id, quantity}, ...] }
            const response = await api.put(`/orders/update-full/${orderId}`, orderData);
            return response.data;
        } catch (error) {
            // Log para depuración técnica en consola
            console.error("Error detallado en updateOrderFull:", error.response?.data);

            // Lanza el mensaje específico enviado por el controlador (ej: "Stock insuficiente")
            throw error.response?.data?.message || "Error al actualizar la orden y sincronizar stock";
        }
    },

    /**
     * ELIMINAR: Borra el pedido y el controlador restaura el stock.
     * Coincide con tu ruta Backend: router.delete('/delete/:id', ...)
     */
    deleteOrder: async (orderId) => {
        try {
            const response = await api.delete(`/orders/delete/${orderId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data?.message || "Error al eliminar el pedido y restaurar stock";
        }
    },

    /**
     * Obtener vendedores filtrados por Rol.
     */
    getVendedoresPorRol: async (roleId) => {
        try {
            const response = await api.get("/orders/vendedores-filtrados", {
                params: { role_id: roleId }
            });
            return response.data;
        } catch (error) {
            console.error("Error al obtener vendedores filtrados:", error);
            throw error.response?.data?.message || "Error al filtrar usuarios";
        }
    },
    /**
     * NUEVO: Procesar la devolución de productos sobrantes al inventario.
     * Envía: { order_id, items: [{product_id, quantity}, ...] }
     */
    processReturn: async (returnData) => {
        try {
            const response = await api.post("/orders/process-return", returnData);
            return response.data;
        } catch (error) {
            console.error("Error en processReturn:", error.response?.data);
            throw error.response?.data?.message || "Error al procesar la devolución de productos";
        }
    },
    // Dentro de orderService.js
    getReturnHistory: async (orderId) => {
        try {
            const response = await api.get(`/orders/return-history/${orderId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data?.message || "Error al obtener historial";
        }
    },
    /**
     * NUEVO - INVENTARIO ACTUAL EN CAMIÓN: 
     * Calcula: (Cantidad Despachada) - (Cantidad Vendida en Sales).
     * Esto es lo que permite que la devolución muestre los sobrantes reales.
     */
    getTruckInventory: async (orderId) => {
        try {
            const response = await api.get(`/orders/truck-inventory/${orderId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data?.message || "Error al calcular inventario del camión";
        }
    },
    markAsLiquidated: async (orderId) => {
        try {
            const response = await api.post(`/orders/mark-liquidated/${orderId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data?.message || "Error al marcar la orden como liquidada";
        }
    }  
    
};