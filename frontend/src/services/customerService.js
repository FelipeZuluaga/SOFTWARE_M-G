import api from "./api";

export const customerService = {

    getBalances: async (sellerId, visitDay = null) => {
        try {
            // 1. Empezamos con el seller_id que es obligatorio
            let url = `/customers/balances?seller_id=${sellerId}`;

            // 2. Si se proporciona un día, lo concatenamos a la URL
            if (visitDay) {
                url += `&visit_day=${visitDay}`;
            }

            const response = await api.get(url);
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