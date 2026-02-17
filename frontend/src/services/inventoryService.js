import api from "./api";

// Función auxiliar para obtener el rol del usuario desde el almacenamiento local
const getHeaders = () => {
    const user = JSON.parse(localStorage.getItem("user"));
    return { 
        headers: { 
            role: user?.role?.toUpperCase() 
        } 
    };
};

export const inventoryService = {
    // Obtener todos los productos con sus categorías y precios agrupados
    getProducts: async () => {
        const res = await api.get("/inventory", getHeaders());
        return res.data;
    },

    // Obtener las categorías para llenar el select del formulario
    getCategories: async () => {
        const res = await api.get("/inventory/categories", getHeaders());
        return res.data;
    },

    // Crear un nuevo producto junto con su array de precios
    createProduct: async (productData) => {
        const res = await api.post("/inventory", productData, getHeaders());
        return res.data;
    },

    // Actualizar datos básicos y refrescar la tabla de precios
    updateProduct: async (id, productData) => {
        const res = await api.put(`/inventory/${id}`, productData, getHeaders());
        return res.data;
    },

    // Eliminar producto (el backend se encarga de borrar los precios por la transacción)
    deleteProduct: async (id) => {
        const res = await api.delete(`/inventory/${id}`, getHeaders());
        return res.data;
    }
};