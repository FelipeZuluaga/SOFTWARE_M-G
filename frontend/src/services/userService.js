import api from "./api"; // Importas tu instancia de axios personalizada

// Función auxiliar para obtener el rol del localStorage
const getHeaders = () => {
    const user = JSON.parse(localStorage.getItem("user"));
    return { 
        headers: { role: user?.role?.toUpperCase() } 
    };
};

export const userService = {
    // Obtener todos los usuarios
    getAll: async () => {
        const res = await api.get("/users", getHeaders());
        return res.data;
    },

    // Crear un nuevo usuario
    create: async (userData) => {
        const res = await api.post("/users", userData, getHeaders());
        return res.data;
    },

    // Eliminar un usuario por ID
    delete: async (id) => {
        const res = await api.delete(`/users/${id}`, getHeaders());
        return res.data;
    },

    // Actualizar un usuario (opcional por si lo necesitas después)
    update: async (id, userData) => {
        const res = await api.put(`/users/${id}`, userData, getHeaders());
        return res.data;
    }
};