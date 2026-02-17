import api from "./api";

export const customerService = {
    /**
     * Obtiene la lista de clientes con sus deudas acumuladas
     */
    getBalances: async () => {
        try {
            const response = await api.get("/customers/balances");
            return response.data.data; // Retorna el array de clientes con saldos
        } catch (error) {
            console.error("Error en customerService:", error);
            throw error;
        }
    },
    // Nueva función
    createCustomer: async (customerData) => {
        try {
            const response = await api.post("/customers/create", customerData);
            return response.data.data; 
        } catch (error) {
            console.error("Error al crear cliente:", error);
            throw error;
        }
    }
};