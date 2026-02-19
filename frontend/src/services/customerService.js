import api from "./api";

export const customerService = {

    getBalances: async (sellerId) => {
        try {
            // Pasamos el sellerId como query param
            const response = await api.get(`/customers/balances?seller_id=${sellerId}`);
            return response.data.data;
        } catch (error) {
            throw error;
        }
    },
    createCustomer: async (customerData) => {
        try {
            // Asegúrate de que tu ruta en el backend coincida con "/customers/create"
            const response = await api.post("/customers/create", customerData);
            return response.data.data;
        } catch (error) {
            // Manejo de errores más descriptivo
            const message = error.response?.data?.message || "Error al conectar con el servidor";
            console.error("Error al crear cliente:", message);
            throw new Error(message);
        }
    }
};